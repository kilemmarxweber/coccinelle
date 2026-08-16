"use server";

import { revalidatePath } from "next/cache";
import { assertOrganizationPermission } from "@/lib/auth/organization-permission";
import { boardPassenger } from "@/lib/reservation/boarding";
import { dayBounds, todayIsoLocal } from "@/lib/search-departs/day-bounds";
import prisma from "@/lib/prisma";

export type BoardingDepartOption = {
  id: string;
  heureDepart: string;
  villeDepart: string;
  villeArrivee: string;
  modeTransport: string;
  statut: string;
  label: string;
};

export type BoardingPassengerRow = {
  id: string;
  codeUnique: string;
  nom: string;
  prenom: string;
  categorie: string;
  occupePlace: boolean;
  embarqueAt: string | null;
  reservationCode: string;
  reservationStatut: string;
};

async function assertScan(organizationId: string) {
  return assertOrganizationPermission(organizationId, {
    embarquement: ["scanner"],
  });
}

export async function listBoardingDepartsAction(
  organizationId: string,
  dateIso?: string,
): Promise<
  | { ok: true; data: BoardingDepartOption[]; date: string }
  | { ok: false; message: string }
> {
  const perm = await assertScan(organizationId);
  if (!perm.ok) return { ok: false, message: perm.message };

  const date = dateIso?.trim() || todayIsoLocal();
  const { start, end } = dayBounds(date);

  const rows = await prisma.trajetDepart.findMany({
    where: {
      dateDepart: { gte: start, lt: end },
      statut: { in: ["OUVERT", "PLANIFIE"] },
      trajet: { organizationId },
    },
    include: {
      trajet: {
        select: {
          villeDepart: true,
          villeArrivee: true,
          modeTransport: true,
        },
      },
    },
    orderBy: [{ heureDepart: "asc" }],
  });

  return {
    ok: true,
    date,
    data: rows.map((d) => ({
      id: d.id,
      heureDepart: d.heureDepart,
      villeDepart: d.trajet.villeDepart,
      villeArrivee: d.trajet.villeArrivee,
      modeTransport: d.trajet.modeTransport,
      statut: d.statut,
      label: `${d.heureDepart} · ${d.trajet.villeDepart} → ${d.trajet.villeArrivee} (${d.trajet.modeTransport})`,
    })),
  };
}

export async function listBoardingPassengersAction(
  organizationId: string,
  trajetDepartId: string,
): Promise<{ ok: true; data: BoardingPassengerRow[] } | { ok: false; message: string }> {
  const perm = await assertScan(organizationId);
  if (!perm.ok) return { ok: false, message: perm.message };

  const depart = await prisma.trajetDepart.findFirst({
    where: { id: trajetDepartId, trajet: { organizationId } },
    select: { id: true },
  });
  if (!depart) return { ok: false, message: "Départ introuvable." };

  const passagers = await prisma.passager.findMany({
    where: {
      reservation: {
        trajetDepartId,
        statut: { in: ["CONFIRME", "EMBARQUE"] },
      },
    },
    include: {
      reservation: { select: { codeUnique: true, statut: true } },
    },
    orderBy: [
      { reservation: { codeUnique: "asc" } },
      { ordre: "asc" },
    ],
  });

  return {
    ok: true,
    data: passagers.map((p) => ({
      id: p.id,
      codeUnique: p.codeUnique,
      nom: p.nom,
      prenom: p.prenom,
      categorie: p.categorie,
      occupePlace: p.occupePlace,
      embarqueAt: p.embarqueAt?.toISOString() ?? null,
      reservationCode: p.reservation.codeUnique,
      reservationStatut: p.reservation.statut,
    })),
  };
}

export async function scanBoardPassengerAction(input: {
  organizationId: string;
  trajetDepartId: string;
  payload: string;
}): Promise<
  | { ok: true; message: string; allBoarded: boolean }
  | { ok: false; message: string }
> {
  const perm = await assertScan(input.organizationId);
  if (!perm.ok) return { ok: false, message: perm.message };

  const result = await boardPassenger({
    organizationId: input.organizationId,
    trajetDepartId: input.trajetDepartId,
    payload: input.payload,
  });

  if (!result.ok) return { ok: false, message: result.message };

  revalidatePath(
    `/admin/organizations/${input.organizationId}/agences/passages`,
  );

  const name = `${result.passager.prenom} ${result.passager.nom}`.trim();
  const suffix = result.reservation.allBoarded
    ? " — réservation entièrement embarquée."
    : ".";
  return {
    ok: true,
    allBoarded: result.reservation.allBoarded,
    message: `${name} embarqué (${result.passager.codeUnique})${suffix}`,
  };
}

export async function manualBoardPassengerAction(input: {
  organizationId: string;
  trajetDepartId: string;
  passagerId: string;
}): Promise<
  | { ok: true; message: string; allBoarded: boolean }
  | { ok: false; message: string }
> {
  const perm = await assertScan(input.organizationId);
  if (!perm.ok) return { ok: false, message: perm.message };

  const result = await boardPassenger({
    organizationId: input.organizationId,
    trajetDepartId: input.trajetDepartId,
    passagerId: input.passagerId,
  });

  if (!result.ok) return { ok: false, message: result.message };

  revalidatePath(
    `/admin/organizations/${input.organizationId}/agences/passages`,
  );

  const name = `${result.passager.prenom} ${result.passager.nom}`.trim();
  return {
    ok: true,
    allBoarded: result.reservation.allBoarded,
    message: `${name} embarqué manuellement (${result.passager.codeUnique}).`,
  };
}
