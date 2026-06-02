"use server";

import { assertInscriptionPermission } from "@/lib/auth/inscription-permission";
import prisma from "@/lib/prisma";

type ActionSuccess<T> = { ok: true; data: T };
type ActionFailure = { ok: false; message: string };
type ActionResult<T> = ActionSuccess<T> | ActionFailure;

function errMessage(err: unknown): string {
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

export async function getColisAction(
  organizationId: string
): Promise<ActionResult<Awaited<ReturnType<typeof listColis>>>> {
  const perm = await assertInscriptionPermission(organizationId, "share");
  if (!perm.ok) return { ok: false, message: perm.message };

  try {
    const data = await listColis(organizationId);
    return { ok: true, data };
  } catch (e) {
    return { ok: false, message: errMessage(e) };
  }
}

async function listColis(organizationId: string) {
  return prisma.colis.findMany({
    where: { trajet: { organizationId } },
    include: {
      client: { include: { user: { select: { id: true, name: true, email: true } } } },
      trajet: {
        select: {
          id: true,
          organizationId: true,
          villeDepart: true,
          villeArrivee: true,
        },
      },
      trajetDepart: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getColisDetailAction(
  organizationId: string,
  colisId: string
): Promise<ActionResult<Awaited<ReturnType<typeof findColis>>>> {
  const perm = await assertInscriptionPermission(organizationId, "share");
  if (!perm.ok) return { ok: false, message: perm.message };

  try {
    const data = await findColis(organizationId, colisId);
    if (!data) return { ok: false, message: "Colis introuvable." };
    return { ok: true, data };
  } catch (e) {
    return { ok: false, message: errMessage(e) };
  }
}

async function findColis(organizationId: string, colisId: string) {
  return prisma.colis.findFirst({
    where: { id: colisId, trajet: { organizationId } },
    include: {
      client: { include: { user: { select: { id: true, name: true, email: true } } } },
      trajet: { select: { id: true, villeDepart: true, villeArrivee: true } },
      trajetDepart: true,
    },
  });
}

export async function updateColisAction(input: {
  organizationId: string;
  colisId: string;
  statut: "EN_ATTENTE" | "EXPEDIE" | "LIVRE";
}): Promise<ActionResult<{ id: string }>> {
  const { organizationId, colisId, statut } = input;
  const perm = await assertInscriptionPermission(organizationId, "share");
  if (!perm.ok) return { ok: false, message: perm.message };

  try {
    const colis = await prisma.colis.findFirst({
      where: { id: colisId },
      include: { trajet: { select: { organizationId: true } } },
    });
    if (!colis) return { ok: false, message: "Colis introuvable." };
    if (colis.trajet.organizationId !== organizationId)
      return { ok: false, message: "Accès refusé." };
    if (colis.statut === "LIVRE" && statut !== "LIVRE") {
      return { ok: false, message: "Impossible de modifier un colis déjà livré." };
    }

    await prisma.colis.update({ where: { id: colisId }, data: { statut } });
    return { ok: true, data: { id: colisId } };
  } catch (e) {
    return { ok: false, message: errMessage(e) };
  }
}
