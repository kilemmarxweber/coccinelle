"use server";

import { revalidatePath } from "next/cache";
import { assertOrganizationPermission } from "@/lib/auth/organization-permission";
import prisma from "@/lib/prisma";

export const COLIS_STATUTS = ["EN_ATTENTE", "EXPEDIE", "LIVRE"] as const;
export type ColisStatut = (typeof COLIS_STATUTS)[number];

const NEXT_STATUT: Partial<Record<ColisStatut, ColisStatut>> = {
  EN_ATTENTE: "EXPEDIE",
  EXPEDIE: "LIVRE",
};

export type ColisListItem = {
  id: string;
  codeUnique: string;
  statut: ColisStatut;
  poids: number;
  montantAPayer: number;
  destinataireNom: string | null;
  destinataireTel: string | null;
  destinataireId: string | null;
  type: string;
  createdAt: string;
  trajet: { villeDepart: string; villeArrivee: string };
  trajetDepartId: string | null;
  reservationId: string | null;
  reservationCode: string | null;
};

async function assertColisRead(organizationId: string) {
  return assertOrganizationPermission(organizationId, {
    inscription: ["share"],
  });
}

async function assertColisUpdate(organizationId: string) {
  return assertOrganizationPermission(organizationId, {
    inscription: ["update"],
  });
}

export async function listColisAction(
  organizationId: string,
  filters?: { statut?: string; trajetDepartId?: string },
): Promise<{ ok: true; data: ColisListItem[] } | { ok: false; message: string }> {
  const perm = await assertColisRead(organizationId);
  if (!perm.ok) return { ok: false, message: perm.message };

  const statut = filters?.statut?.trim();
  const trajetDepartId = filters?.trajetDepartId?.trim();

  const rows = await prisma.colis.findMany({
    where: {
      trajet: { organizationId },
      ...(statut && COLIS_STATUTS.includes(statut as ColisStatut)
        ? { statut: statut as ColisStatut }
        : {}),
      ...(trajetDepartId ? { trajetDepartId } : {}),
    },
    include: {
      trajet: { select: { villeDepart: true, villeArrivee: true } },
      passager: {
        select: {
          reservation: { select: { id: true, codeUnique: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return {
    ok: true,
    data: rows.map((c) => ({
      id: c.id,
      codeUnique: c.codeUnique,
      statut: c.statut as ColisStatut,
      poids: c.poids,
      montantAPayer: c.montantAPayer,
      destinataireNom: c.destinataireNom,
      destinataireTel: c.destinataireTel,
      destinataireId: c.destinataireId,
      type: c.type,
      createdAt: c.createdAt.toISOString(),
      trajet: c.trajet,
      trajetDepartId: c.trajetDepartId,
      reservationId: c.passager?.reservation.id ?? null,
      reservationCode: c.passager?.reservation.codeUnique ?? null,
    })),
  };
}

export async function advanceColisStatutAction(input: {
  organizationId: string;
  colisId: string;
}): Promise<{ ok: true; statut: ColisStatut } | { ok: false; message: string }> {
  const perm = await assertColisUpdate(input.organizationId);
  if (!perm.ok) return { ok: false, message: perm.message };

  const colis = await prisma.colis.findFirst({
    where: {
      id: input.colisId,
      trajet: { organizationId: input.organizationId },
    },
    select: { id: true, statut: true },
  });
  if (!colis) return { ok: false, message: "Colis introuvable." };

  const current = colis.statut as ColisStatut;
  const next = NEXT_STATUT[current];
  if (!next) {
    return { ok: false, message: "Ce colis est déjà livré." };
  }

  await prisma.colis.update({
    where: { id: colis.id },
    data: { statut: next },
  });

  revalidatePath(
    `/admin/organizations/${input.organizationId}/agences/colis`,
  );

  return { ok: true, statut: next };
}
