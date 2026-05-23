"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import type { ZodError } from "zod";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { assertInscriptionPermission } from "@/lib/auth/inscription-permission";
import { ORG_ROLE } from "@/lib/permissions";
import { generateSecurePassword } from "@/lib/generate-password";
import { createReservationInDatabase } from "@/lib/reservation/create-reservation";
import {
  findReservationForOrganization,
  ReservationScopeError,
  reservationListInclude,
} from "@/lib/reservation/org-scope";
import {
  createReservationSchema,
  deleteReservationSchema,
  organizationIdSchema,
  reservationIdParamsSchema,
  updateReservationSchema,
  type CreateReservationInput,
} from "@/lib/reservation/schema";
import prisma from "@/lib/prisma";

const createGuichetClientSchema = z.object({
  organizationId: organizationIdSchema,
  nom: z.string().trim().min(1, "Nom requis.").max(80),
  prenom: z.string().trim().max(80).optional(),
  postnom: z.string().trim().max(80).optional(),
  telephone: z.string().trim().min(6, "Téléphone requis.").max(30),
  email: z.string().trim().email("Email invalide."),
  societe: z.string().trim().max(120).optional(),
  adresse: z.string().trim().max(200).optional(),
});

type ActionSuccess<T> = { ok: true; data: T };
type ActionFailure = { ok: false; message: string };
type ActionResult<T> = ActionSuccess<T> | ActionFailure;

function zodFirstMessage(err: ZodError): string {
  return err.issues[0]?.message ?? "Données invalides.";
}

function errMessage(err: unknown): string {
  if (err instanceof ReservationScopeError) return err.message;
  if (
    typeof err === "object" &&
    err !== null &&
    "message" in err &&
    typeof (err as { message: unknown }).message === "string"
  ) {
    return (err as { message: string }).message;
  }
  return "Une erreur est survenue.";
}

function reservationsPath(organizationId: string) {
  return `/admin/organizations/${organizationId}/agences/reservations`;
}

function revalidateReservations(organizationId: string) {
  revalidatePath(reservationsPath(organizationId), "page");
}

/** Création client au guichet (compte + profil + membre agence, sans OTP). */
export async function createGuichetClientAction(
  input: unknown,
): Promise<ActionResult<{ id: string; label: string }>> {
  const parsed = createGuichetClientSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: zodFirstMessage(parsed.error) };
  }

  const {
    organizationId,
    nom,
    prenom,
    postnom,
    telephone,
    email,
    societe,
    adresse,
  } = parsed.data;

  const perm = await assertInscriptionPermission(organizationId, "create");
  if (!perm.ok) return { ok: false, message: perm.message };

  const h = await headers();
  const emailLower = email.toLowerCase();
  const displayName = [prenom, nom, postnom].filter(Boolean).join(" ").trim() || nom;
  const password = generateSecurePassword(16);

  let userId: string | null = null;
  try {
    const existing = await prisma.user.findUnique({
      where: { email: emailLower },
      include: { client: true, members: { where: { organizationId } } },
    });

    if (existing?.client) {
      if (!existing.members.length) {
        await auth.api.addMember({
          body: { userId: existing.id, role: ORG_ROLE.PARENT, organizationId },
          headers: h,
        });
      }
      return {
        ok: true,
        data: {
          id: existing.client.id,
          label: existing.name ?? displayName,
        },
      };
    }

    if (existing && !existing.client) {
      return {
        ok: false,
        message: "Cet email est déjà utilisé par un compte non client.",
      };
    }

    const created = await auth.api.createUser({
      body: {
        email: emailLower,
        name: displayName,
        password,
        role: "user",
      },
      headers: h,
    });
    const user = (created as { user?: { id: string } } | null)?.user;
    if (!user?.id) {
      return { ok: false, message: "Création du compte impossible." };
    }
    userId = user.id;

    const client = await prisma.client.create({
      data: {
        userId: user.id,
        telephone,
        prenom: prenom ?? null,
        postnom: postnom ?? null,
        societe: societe ?? null,
        adresse: adresse ?? null,
      },
    });

    await auth.api.addMember({
      body: { userId: user.id, role: ORG_ROLE.PARENT, organizationId },
      headers: h,
    });

    return { ok: true, data: { id: client.id, label: displayName } };
  } catch (e) {
    if (userId) {
      await prisma.user.delete({ where: { id: userId } }).catch(() => undefined);
    }
    return { ok: false, message: errMessage(e) };
  }
}

/** Recherche clients membres de l’agence (guichet). */
export async function searchClientsAction(
  organizationId: string,
  query: string,
): Promise<
  Array<{
    id: string;
    nom: string;
    prenom: string;
    postnom: string;
    adresse: string;
    telephone: string;
    email: string;
    societe: string;
    dateInscription: string;
  }>
> {
  const perm = await assertInscriptionPermission(organizationId, "share");
  if (!perm.ok) return [];

  if (!query?.trim()) return [];

  const q = query.trim();

  const clients = await prisma.client.findMany({
    where: {
      user: { members: { some: { organizationId } } },
      OR: [
        { user: { name: { contains: q, mode: "insensitive" } } },
        { user: { email: { contains: q, mode: "insensitive" } } },
        { telephone: { contains: q } },
        { societe: { contains: q, mode: "insensitive" } },
      ],
    },
    include: { user: true },
    take: 10,
  });

  return clients.map((c) => {
    const nameParts = c.user.name?.split(" ") ?? [];
    return {
      id: c.id,
      nom: nameParts[0] ?? "",
      prenom: c.prenom ?? "",
      postnom: c.postnom ?? "",
      adresse: c.adresse ?? "",
      telephone: c.telephone ?? "",
      email: c.user.email ?? "",
      societe: c.societe ?? "",
      dateInscription: c.dateInscription
        ? new Date(c.dateInscription).toISOString().split("T")[0]
        : "",
    };
  });
}

/** Liste des réservations de l’agence (via trajets liés à `organizationId`). */
export async function getReservationsAction(
  organizationId: string,
): Promise<ActionResult<Awaited<ReturnType<typeof listReservations>>>> {
  const perm = await assertInscriptionPermission(organizationId, "share");
  if (!perm.ok) return { ok: false, message: perm.message };

  try {
    const data = await listReservations(organizationId);
    return { ok: true, data };
  } catch (e) {
    return { ok: false, message: errMessage(e) };
  }
}

async function listReservations(organizationId: string) {
  return prisma.reservation.findMany({
    where: { trajet: { organizationId } },
    include: reservationListInclude,
    orderBy: { createdAt: "desc" },
  });
}

/** Détail d’une réservation scoped à l’agence. */
export async function getReservationAction(
  organizationId: string,
  reservationId: string,
): Promise<ActionResult<NonNullable<Awaited<ReturnType<typeof findReservationForOrganization>>>>> {
  const perm = await assertInscriptionPermission(organizationId, "share");
  if (!perm.ok) return { ok: false, message: perm.message };

  const parsed = reservationIdParamsSchema.safeParse({ organizationId, reservationId });
  if (!parsed.success) {
    return { ok: false, message: zodFirstMessage(parsed.error) };
  }

  const reservation = await findReservationForOrganization(
    parsed.data.organizationId,
    parsed.data.reservationId,
  );
  if (!reservation) {
    return { ok: false, message: "Réservation introuvable." };
  }

  return { ok: true, data: reservation };
}

/** Création guichet (`source: GUICHET`). */
export async function createReservationAction(
  organizationId: string,
  payload: unknown,
): Promise<ActionResult<Awaited<ReturnType<typeof createReservationInDatabase>>>> {
  const perm = await assertInscriptionPermission(organizationId, "create");
  if (!perm.ok) return { ok: false, message: perm.message };

  const parsed = createReservationSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, message: zodFirstMessage(parsed.error) };
  }

  try {
    const data: CreateReservationInput = parsed.data;
    const paiementStatut = data.modePaiement === "CASH" ? "PAYE" : "EN_ATTENTE";
    const reservation = await createReservationInDatabase(data, {
      organizationId,
      source: "GUICHET",
      paiementStatut,
    });
    revalidateReservations(organizationId);
    return { ok: true, data: reservation };
  } catch (e) {
    return { ok: false, message: errMessage(e) };
  }
}

/** Mise à jour partielle (statut, pénalité, report, paiement). */
export async function updateReservationAction(
  input: unknown,
): Promise<ActionResult<Awaited<ReturnType<typeof findReservationForOrganization>>>> {
  const parsed = updateReservationSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: zodFirstMessage(parsed.error) };
  }

  const { organizationId, reservationId, statutPaiement, ...fields } = parsed.data;

  const perm = await assertInscriptionPermission(organizationId, "update");
  if (!perm.ok) return { ok: false, message: perm.message };

  const existing = await findReservationForOrganization(organizationId, reservationId);
  if (!existing) {
    return { ok: false, message: "Réservation introuvable." };
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.reservation.update({
        where: { id: reservationId },
        data: {
          ...(fields.statut !== undefined ? { statut: fields.statut } : {}),
          ...(fields.penalite !== undefined ? { penalite: fields.penalite } : {}),
          ...(fields.peutReporter !== undefined
            ? { peutReporter: fields.peutReporter }
            : {}),
          ...(fields.dateLimiteReport !== undefined
            ? { dateLimiteReport: fields.dateLimiteReport }
            : {}),
        },
      });

      if (statutPaiement !== undefined) {
        const paiement = await tx.paiement.findFirst({
          where: { reservationId },
          orderBy: { createdAt: "desc" },
        });
        if (paiement) {
          await tx.paiement.update({
            where: { id: paiement.id },
            data: { statut: statutPaiement },
          });
        }
      }
    });

    revalidateReservations(organizationId);
    const updated = await findReservationForOrganization(organizationId, reservationId);
    if (!updated) {
      return { ok: false, message: "Réservation introuvable après mise à jour." };
    }
    return { ok: true, data: updated };
  } catch (e) {
    return { ok: false, message: errMessage(e) };
  }
}

/** Suppression réservation et entités liées (passagers, paiements, pénalités, colis du départ). */
export async function deleteReservationAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = deleteReservationSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: zodFirstMessage(parsed.error) };
  }

  const { organizationId, reservationId } = parsed.data;

  const perm = await assertInscriptionPermission(organizationId, "delete");
  if (!perm.ok) return { ok: false, message: perm.message };

  const existing = await findReservationForOrganization(organizationId, reservationId);
  if (!existing) {
    return { ok: false, message: "Réservation introuvable." };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const passagerIds = existing.passagers.map((p) => p.id);

      if (passagerIds.length) {
        await tx.colis.deleteMany({ where: { passagerId: { in: passagerIds } } });
      }

      await tx.colis.deleteMany({
        where: {
          clientId: existing.clientId,
          trajetId: existing.trajetId,
          trajetDepartId: existing.trajetDepartId,
        },
      });

      await tx.penalite.deleteMany({ where: { reservationId } });
      await tx.paiement.deleteMany({ where: { reservationId } });
      await tx.passager.deleteMany({ where: { reservationId } });
      await tx.reservation.delete({ where: { id: reservationId } });
    });

    revalidateReservations(organizationId);
    return { ok: true, data: { id: reservationId } };
  } catch (e) {
    return { ok: false, message: errMessage(e) };
  }
}
