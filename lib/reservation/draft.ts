import { Prisma } from "@/prisma/generated/prisma/client";
import prisma from "@/lib/prisma";
import {
  CapaciteInsuffisanteError,
  placesDemandeesFromPassagers,
  placesRestantes,
} from "@/lib/reservation/capacite";
import {
  draftPayloadPersistSchema,
  type DraftPayload,
} from "@/lib/reservation/draft-schema";
import { getDepartForOrganization } from "@/lib/search-departs";

/** Durée de vie d’un brouillon checkout (minutes). */
export const DRAFT_TTL_MINUTES = 30;

export class DraftExpiredError extends Error {
  constructor(message = "Ce brouillon de réservation a expiré.") {
    super(message);
    this.name = "DraftExpiredError";
  }
}

export class DraftNotFoundError extends Error {
  constructor(message = "Brouillon introuvable.") {
    super(message);
    this.name = "DraftNotFoundError";
  }
}

export function draftExpiresAt(from: Date = new Date()): Date {
  return new Date(from.getTime() + DRAFT_TTL_MINUTES * 60_000);
}

export function isDraftExpired(expiresAt: Date, now: Date = new Date()): boolean {
  return expiresAt.getTime() <= now.getTime();
}

export function parseDraftPayload(raw: unknown): DraftPayload {
  return draftPayloadPersistSchema.parse(raw);
}

export function emptyDraftPayload(
  trajetDepartId: string,
  trajetId: string,
): DraftPayload {
  return draftPayloadPersistSchema.parse({
    trajetDepartId,
    trajetId,
    step: "passagers",
    passagers: [
      {
        nom: "",
        prenom: "",
        sexe: "M",
        categorie: "ADULTE",
        telephone: "",
      },
    ],
    colis: { include: false },
  });
}

export type CheckoutDraftView = {
  id: string;
  draftToken: string;
  organizationId: string;
  expiresAt: Date;
  expired: boolean;
  payload: DraftPayload;
  placesRestantes: number;
};

/**
 * Crée un `ReservationDraft` pour un départ public (scope org).
 */
export async function createCheckoutDraft(input: {
  organizationId: string;
  organizationSlug: string;
  departId: string;
  userId?: string | null;
}): Promise<{ draftToken: string }> {
  const depart = await getDepartForOrganization({
    organizationId: input.organizationId,
    organizationSlug: input.organizationSlug,
    departId: input.departId,
  });

  if (!depart) {
    throw new DraftNotFoundError("Départ introuvable.");
  }
  if (depart.complet || depart.placesRestantes < 1) {
    throw new CapaciteInsuffisanteError(depart.placesRestantes, 1);
  }

  const payload = emptyDraftPayload(depart.departId, depart.trajetId);

  const draft = await prisma.reservationDraft.create({
    data: {
      organizationId: input.organizationId,
      userId: input.userId ?? null,
      expiresAt: draftExpiresAt(),
      payload: payload as Prisma.InputJsonValue,
    },
    select: { draftToken: true },
  });

  return { draftToken: draft.draftToken };
}

/**
 * Charge un brouillon par token, scopé à l’organisation.
 */
export async function getCheckoutDraft(input: {
  organizationId: string;
  draftToken: string;
}): Promise<CheckoutDraftView | null> {
  const draft = await prisma.reservationDraft.findFirst({
    where: {
      draftToken: input.draftToken.trim(),
      organizationId: input.organizationId,
    },
    select: {
      id: true,
      draftToken: true,
      organizationId: true,
      expiresAt: true,
      payload: true,
    },
  });

  if (!draft) return null;

  const payload = parseDraftPayload(draft.payload);
  const restantes = await placesRestantes(payload.trajetDepartId);
  const expired = isDraftExpired(draft.expiresAt);

  return {
    id: draft.id,
    draftToken: draft.draftToken,
    organizationId: draft.organizationId,
    expiresAt: draft.expiresAt,
    expired,
    payload,
    placesRestantes: restantes,
  };
}

/**
 * Met à jour le payload JSON (remplacement complet — pattern Prisma Json).
 * Refuse si expiré. Vérifie la capacité demandée.
 */
export async function updateCheckoutDraft(input: {
  organizationId: string;
  draftToken: string;
  payload: DraftPayload;
}): Promise<CheckoutDraftView> {
  const existing = await prisma.reservationDraft.findFirst({
    where: {
      draftToken: input.draftToken.trim(),
      organizationId: input.organizationId,
    },
    select: { id: true, expiresAt: true },
  });

  if (!existing) {
    throw new DraftNotFoundError();
  }
  if (isDraftExpired(existing.expiresAt)) {
    throw new DraftExpiredError();
  }

  const payload = draftPayloadPersistSchema.parse(input.payload);
  const demandees = placesDemandeesFromPassagers(payload.passagers);
  const restantes = await placesRestantes(payload.trajetDepartId);

  if (demandees > restantes) {
    throw new CapaciteInsuffisanteError(restantes, demandees);
  }

  const updated = await prisma.reservationDraft.update({
    where: { id: existing.id },
    data: {
      payload: payload as Prisma.InputJsonValue,
    },
    select: {
      id: true,
      draftToken: true,
      organizationId: true,
      expiresAt: true,
      payload: true,
    },
  });

  return {
    id: updated.id,
    draftToken: updated.draftToken,
    organizationId: updated.organizationId,
    expiresAt: updated.expiresAt,
    expired: false,
    payload: parseDraftPayload(updated.payload),
    placesRestantes: restantes,
  };
}

/**
 * Vérifie capacité avant d’avancer vers le paiement (sans créer la réservation).
 */
export async function assertDraftCapacity(
  payload: DraftPayload,
): Promise<{ placesRestantes: number; placesDemandees: number }> {
  const placesDemandees = placesDemandeesFromPassagers(payload.passagers);
  const restantes = await placesRestantes(payload.trajetDepartId);
  if (placesDemandees > restantes) {
    throw new CapaciteInsuffisanteError(restantes, placesDemandees);
  }
  return { placesRestantes: restantes, placesDemandees };
}

/** Associe le brouillon à l’utilisateur connecté (avant / pendant paiement). */
export async function bindCheckoutDraftUser(input: {
  organizationId: string;
  draftToken: string;
  userId: string;
}): Promise<void> {
  const existing = await prisma.reservationDraft.findFirst({
    where: {
      draftToken: input.draftToken.trim(),
      organizationId: input.organizationId,
    },
    select: { id: true, expiresAt: true },
  });
  if (!existing) throw new DraftNotFoundError();
  if (isDraftExpired(existing.expiresAt)) throw new DraftExpiredError();

  await prisma.reservationDraft.update({
    where: { id: existing.id },
    data: { userId: input.userId },
  });
}

/**
 * Invalide le brouillon après paiement réussi (consommé → plus réutilisable).
 */
export async function consumeCheckoutDraft(input: {
  organizationId: string;
  draftToken: string;
}): Promise<void> {
  const existing = await prisma.reservationDraft.findFirst({
    where: {
      draftToken: input.draftToken.trim(),
      organizationId: input.organizationId,
    },
    select: { id: true },
  });
  if (!existing) return;

  await prisma.reservationDraft.delete({ where: { id: existing.id } });
}
