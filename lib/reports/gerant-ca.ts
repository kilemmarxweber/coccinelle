import type { MethodePaiement } from "@/prisma/generated/prisma/client";
import prisma from "@/lib/prisma";
import { dayBounds, todayIsoLocal } from "@/lib/search-departs/day-bounds";

export type GerantCaPeriod = {
  from: string;
  to: string;
};

export type GerantCaParMethode = {
  methode: MethodePaiement;
  montant: number;
  count: number;
};

export type GerantCaRapport = {
  organizationId: string;
  period: GerantCaPeriod;
  /** Somme des paiements `PAYE` sur la période (réservations non annulées). */
  caTotal: number;
  paiementsCount: number;
  parMethode: GerantCaParMethode[];
};

const METHODES: MethodePaiement[] = ["CASH", "MOBILE_MONEY", "CARTE"];

function isIsoDay(value: string | undefined): value is string {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/** Période par défaut : 1er du mois → aujourd’hui (jours locaux). */
export function defaultCaPeriod(now: Date = new Date()): GerantCaPeriod {
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  return {
    from: todayIsoLocal(from),
    to: todayIsoLocal(now),
  };
}

export function parseCaPeriod(
  sp: Record<string, string | string[] | undefined>,
): GerantCaPeriod {
  const one = (key: string) => {
    const v = sp[key];
    return typeof v === "string" ? v : undefined;
  };
  const defaults = defaultCaPeriod();
  const from = isIsoDay(one("from")) ? one("from")! : defaults.from;
  const to = isIsoDay(one("to")) ? one("to")! : defaults.to;
  return from <= to ? { from, to } : { from: to, to: from };
}

/**
 * Rapport CA V1 : total `PAYE` + répartition CASH / MOBILE_MONEY / CARTE.
 * Scope org via `reservation.trajet.organizationId`.
 */
export async function getGerantCaRapport(
  organizationId: string,
  period: GerantCaPeriod,
): Promise<GerantCaRapport> {
  const start = dayBounds(period.from).start;
  const end = dayBounds(period.to).end;

  const paiementWhere = {
    statut: "PAYE" as const,
    createdAt: { gte: start, lt: end },
    reservation: {
      statut: { not: "ANNULE" as const },
      trajet: { organizationId },
    },
  };

  const [agg, groups] = await Promise.all([
    prisma.paiement.aggregate({
      where: paiementWhere,
      _sum: { montant: true },
      _count: { _all: true },
    }),
    prisma.paiement.groupBy({
      by: ["methode"],
      where: paiementWhere,
      _sum: { montant: true },
      _count: { _all: true },
    }),
  ]);

  const byMethode = new Map(
    groups.map((g) => [
      g.methode,
      { montant: g._sum.montant ?? 0, count: g._count._all },
    ]),
  );

  const parMethode: GerantCaParMethode[] = METHODES.map((methode) => ({
    methode,
    montant: byMethode.get(methode)?.montant ?? 0,
    count: byMethode.get(methode)?.count ?? 0,
  }));

  return {
    organizationId,
    period,
    caTotal: agg._sum.montant ?? 0,
    paiementsCount: agg._count._all,
    parMethode,
  };
}

export function caRapportToCsv(rapport: GerantCaRapport): string {
  const lines = [
    "metrique,valeur",
    `periode_debut,${rapport.period.from}`,
    `periode_fin,${rapport.period.to}`,
    `ca_total,${rapport.caTotal}`,
    `paiements_count,${rapport.paiementsCount}`,
    ...rapport.parMethode.map(
      (m) => `ca_${m.methode},${m.montant}`,
    ),
    ...rapport.parMethode.map(
      (m) => `count_${m.methode},${m.count}`,
    ),
  ];
  return `\uFEFF${lines.join("\r\n")}`;
}
