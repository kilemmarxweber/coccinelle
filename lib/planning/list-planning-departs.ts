import type { ModeTransport, StatutTrajetDepart } from "@/prisma/generated/prisma/client";
import prisma from "@/lib/prisma";
import { dayBounds } from "@/lib/search-departs/day-bounds";

export type PlanningDepartRow = {
  id: string;
  trajetId: string;
  villeDepart: string;
  villeArrivee: string;
  modeTransport: ModeTransport;
  dateDepart: string;
  heureDepart: string;
  statut: StatutTrajetDepart;
  capacitePlaces: number;
  placesOccupees: number;
  placesRestantes: number;
  remplissagePct: number;
};

export type PlanningTrajetOption = {
  id: string;
  label: string;
  modeTransport: ModeTransport;
};

export type PlanningPeriod = {
  from: string;
  to: string;
};

function pct(numerateur: number, denominateur: number): number {
  if (denominateur <= 0) return 0;
  return Math.round((numerateur / denominateur) * 100);
}

/** Période par défaut : aujourd’hui → +14 jours (bornes locales). */
export function defaultPlanningPeriod(now: Date = new Date()): PlanningPeriod {
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const to = new Date(from);
  to.setDate(to.getDate() + 14);
  return {
    from: toIsoDay(from),
    to: toIsoDay(to),
  };
}

function toIsoDay(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Liste des `TrajetDepart` d’une org sur une période (inclusif).
 * Inclut ANNULE pour le gérant (contrairement à la recherche U05).
 */
export async function listPlanningDeparts(
  organizationId: string,
  period: PlanningPeriod,
): Promise<PlanningDepartRow[]> {
  const { start } = dayBounds(period.from);
  const { end } = dayBounds(period.to);

  const rows = await prisma.trajetDepart.findMany({
    where: {
      dateDepart: { gte: start, lt: end },
      trajet: { organizationId },
    },
    include: {
      trajet: {
        select: {
          id: true,
          villeDepart: true,
          villeArrivee: true,
          modeTransport: true,
        },
      },
      reservations: {
        where: { statut: { not: "ANNULE" } },
        select: {
          passagers: {
            where: { occupePlace: true },
            select: { id: true },
          },
        },
      },
    },
    orderBy: [{ dateDepart: "asc" }, { heureDepart: "asc" }],
  });

  return rows.map((d) => {
    const placesOccupees = d.reservations.reduce(
      (sum, r) => sum + r.passagers.length,
      0,
    );
    const placesRestantes = Math.max(0, d.capacitePlaces - placesOccupees);
    return {
      id: d.id,
      trajetId: d.trajet.id,
      villeDepart: d.trajet.villeDepart,
      villeArrivee: d.trajet.villeArrivee,
      modeTransport: d.trajet.modeTransport,
      dateDepart: d.dateDepart.toISOString(),
      heureDepart: d.heureDepart,
      statut: d.statut,
      capacitePlaces: d.capacitePlaces,
      placesOccupees,
      placesRestantes,
      remplissagePct: pct(placesOccupees, d.capacitePlaces),
    };
  });
}

export async function listPlanningTrajetOptions(
  organizationId: string,
): Promise<PlanningTrajetOption[]> {
  const trajets = await prisma.trajet.findMany({
    where: { organizationId },
    select: {
      id: true,
      villeDepart: true,
      villeArrivee: true,
      modeTransport: true,
    },
    orderBy: [{ villeDepart: "asc" }, { villeArrivee: "asc" }],
  });

  return trajets.map((t) => ({
    id: t.id,
    label: `${t.villeDepart} → ${t.villeArrivee}`,
    modeTransport: t.modeTransport,
  }));
}
