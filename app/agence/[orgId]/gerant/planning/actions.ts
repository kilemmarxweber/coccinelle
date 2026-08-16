"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ZodError } from "zod";
import { gerantPath } from "@/lib/agence/routes";
import { assertOrganizationPermission } from "@/lib/auth/organization-permission";
import {
  capaciteDefautPourMode,
  countPlacesOccupees,
} from "@/lib/reservation/capacite";
import { organizationIdSchema } from "@/lib/reservation/schema";
import prisma from "@/lib/prisma";

type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string };

function zodFirstMessage(err: ZodError): string {
  return err.issues[0]?.message ?? "Données invalides.";
}

function revalidatePlanning(organizationId: string) {
  revalidatePath(gerantPath(organizationId, "planning"), "page");
  revalidatePath(gerantPath(organizationId), "page");
  revalidatePath(
    `/admin/organizations/${organizationId}/agences/trajets`,
    "page",
  );
  revalidatePath(
    `/admin/organizations/${organizationId}/agences/reservations/guichet`,
    "page",
  );
}

async function findDepartInOrg(organizationId: string, departId: string) {
  return prisma.trajetDepart.findFirst({
    where: {
      id: departId,
      trajet: { organizationId },
    },
    select: {
      id: true,
      statut: true,
      capacitePlaces: true,
      trajetId: true,
    },
  });
}

const updateStatutSchema = z.object({
  organizationId: organizationIdSchema,
  departId: z.string().uuid("Départ invalide."),
  statut: z.enum(["PLANIFIE", "OUVERT", "ANNULE"]),
});

/**
 * Ouvrir / fermer / annuler un départ.
 * - OUVERT / PLANIFIE → `depart:modifier`
 * - ANNULE → `depart:annuler`
 */
export async function updateDepartStatutAction(
  input: unknown,
): Promise<ActionResult<{ id: string; statut: string }>> {
  const parsed = updateStatutSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: zodFirstMessage(parsed.error) };

  const permission =
    parsed.data.statut === "ANNULE"
      ? ({ depart: ["annuler"] } as const)
      : ({ depart: ["modifier"] } as const);

  const perm = await assertOrganizationPermission(
    parsed.data.organizationId,
    permission,
  );
  if (!perm.ok) return { ok: false, message: perm.message };

  const depart = await findDepartInOrg(
    parsed.data.organizationId,
    parsed.data.departId,
  );
  if (!depart) {
    return { ok: false, message: "Départ introuvable pour cette agence." };
  }

  if (depart.statut === parsed.data.statut) {
    return {
      ok: true,
      data: { id: depart.id, statut: depart.statut },
    };
  }

  const updated = await prisma.trajetDepart.update({
    where: { id: depart.id },
    data: { statut: parsed.data.statut },
    select: { id: true, statut: true },
  });

  revalidatePlanning(parsed.data.organizationId);
  return { ok: true, data: updated };
}

const updateCapaciteSchema = z.object({
  organizationId: organizationIdSchema,
  departId: z.string().uuid("Départ invalide."),
  capacitePlaces: z.coerce
    .number()
    .int("Capacité entière requise.")
    .min(1, "Capacité minimale : 1 place."),
});

/** Édite `capacitePlaces` — refus si sous le nb déjà vendu (places occupées). */
export async function updateDepartCapaciteAction(
  input: unknown,
): Promise<
  ActionResult<{
    id: string;
    capacitePlaces: number;
    placesOccupees: number;
    placesRestantes: number;
  }>
> {
  const parsed = updateCapaciteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: zodFirstMessage(parsed.error) };

  const perm = await assertOrganizationPermission(parsed.data.organizationId, {
    depart: ["modifier"],
  });
  if (!perm.ok) return { ok: false, message: perm.message };

  try {
    const result = await prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<
        Array<{ id: string; capacitePlaces: number }>
      >`
        SELECT td.id, td."capacitePlaces"
        FROM "TrajetDepart" td
        INNER JOIN "Trajet" t ON t.id = td."trajetId"
        WHERE td.id = ${parsed.data.departId}
          AND t."organizationId" = ${parsed.data.organizationId}
        FOR UPDATE OF td
      `;

      const depart = locked[0];
      if (!depart) {
        throw new Error("Départ introuvable pour cette agence.");
      }

      const placesOccupees = await countPlacesOccupees(depart.id, tx);
      if (parsed.data.capacitePlaces < placesOccupees) {
        throw new CapaciteSousVenduesError(
          placesOccupees,
          parsed.data.capacitePlaces,
        );
      }

      const updated = await tx.trajetDepart.update({
        where: { id: depart.id },
        data: { capacitePlaces: parsed.data.capacitePlaces },
        select: { id: true, capacitePlaces: true },
      });

      return {
        id: updated.id,
        capacitePlaces: updated.capacitePlaces,
        placesOccupees,
        placesRestantes: Math.max(
          0,
          updated.capacitePlaces - placesOccupees,
        ),
      };
    });

    revalidatePlanning(parsed.data.organizationId);
    return { ok: true, data: result };
  } catch (err) {
    if (err instanceof CapaciteSousVenduesError) {
      return { ok: false, message: err.message };
    }
    if (err instanceof Error) {
      return { ok: false, message: err.message };
    }
    return { ok: false, message: "Impossible de mettre à jour la capacité." };
  }
}

class CapaciteSousVenduesError extends Error {
  constructor(placesOccupees: number, capaciteDemandee: number) {
    super(
      `Capacité refusée : ${placesOccupees} place${placesOccupees !== 1 ? "s" : ""} déjà vendue${placesOccupees !== 1 ? "s" : ""}, impossible de descendre à ${capaciteDemandee}.`,
    );
    this.name = "CapaciteSousVenduesError";
  }
}

const createDepartSchema = z.object({
  organizationId: organizationIdSchema,
  trajetId: z.string().uuid("Trajet invalide."),
  dateDepart: z.coerce.date({ message: "Date invalide." }),
  heureDepart: z
    .string()
    .trim()
    .regex(/^\d{2}:\d{2}$/, "Heure au format HH:MM."),
  capacitePlaces: z.coerce.number().int().min(1).optional(),
});

/** Crée un départ en `PLANIFIE` (à ouvrir ensuite pour la vente). */
export async function createPlanningDepartAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = createDepartSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: zodFirstMessage(parsed.error) };

  const perm = await assertOrganizationPermission(parsed.data.organizationId, {
    depart: ["ajouter"],
  });
  if (!perm.ok) return { ok: false, message: perm.message };

  const trajet = await prisma.trajet.findFirst({
    where: {
      id: parsed.data.trajetId,
      organizationId: parsed.data.organizationId,
    },
    select: { id: true, modeTransport: true },
  });
  if (!trajet) {
    return { ok: false, message: "Trajet introuvable pour cette agence." };
  }

  const depart = await prisma.trajetDepart.create({
    data: {
      trajetId: trajet.id,
      dateDepart: parsed.data.dateDepart,
      heureDepart: parsed.data.heureDepart,
      statut: "PLANIFIE",
      capacitePlaces:
        parsed.data.capacitePlaces ??
        capaciteDefautPourMode(trajet.modeTransport),
    },
    select: { id: true },
  });

  revalidatePlanning(parsed.data.organizationId);
  return { ok: true, data: depart };
}
