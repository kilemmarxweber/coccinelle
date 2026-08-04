import prisma from "@/lib/prisma";
import { dayBounds, startOfToday } from "@/lib/search-departs/day-bounds";

const SEUIL_BIENTOT_COMPLET = 0.1;
const PROCHAINS_DEPARTS_LIMIT = 8;

export type GerantDashboardKpis = {
  reservationsJour: number;
  caPayeJour: number;
  placesVenduesJour: number;
  capaciteJour: number;
  remplissagePct: number;
  colisEnAttente: number;
};

export type GerantProchainDepart = {
  id: string;
  villeDepart: string;
  villeArrivee: string;
  modeTransport: "BUS" | "AVION";
  dateDepart: string;
  heureDepart: string;
  capacitePlaces: number;
  placesOccupees: number;
  placesRestantes: number;
  remplissagePct: number;
};

export type GerantDashboardAlerte =
  | {
      kind: "bientot_complet";
      departId: string;
      label: string;
      placesRestantes: number;
      capacitePlaces: number;
    }
  | {
      kind: "paiement_en_attente";
      count: number;
      montantTotal: number;
    };

export type GerantDashboardData = {
  organizationId: string;
  dateJour: string;
  kpis: GerantDashboardKpis;
  prochainsDeparts: GerantProchainDepart[];
  alertes: GerantDashboardAlerte[];
};

function orgTrajetFilter(organizationId: string) {
  return { trajet: { organizationId } };
}

function pct(numerateur: number, denominateur: number): number {
  if (denominateur <= 0) return 0;
  return Math.round((numerateur / denominateur) * 100);
}

/**
 * KPI + prochains départs + alertes pour l’espace gérant.
 * Toutes les requêtes sont scopées `trajet.organizationId`.
 */
export async function getGerantDashboard(
  organizationId: string,
  now: Date = new Date(),
): Promise<GerantDashboardData> {
  const { start: jourStart, end: jourEnd } = dayBounds(now);
  const todayStart = startOfToday();

  const [
    reservationsJour,
    caAgg,
    colisEnAttente,
    paiementsEnAttenteAgg,
    departsJour,
    prochainsRaw,
  ] = await Promise.all([
    prisma.reservation.count({
      where: {
        ...orgTrajetFilter(organizationId),
        statut: { not: "ANNULE" },
        createdAt: { gte: jourStart, lt: jourEnd },
      },
    }),

    prisma.paiement.aggregate({
      where: {
        statut: "PAYE",
        createdAt: { gte: jourStart, lt: jourEnd },
        reservation: {
          statut: { not: "ANNULE" },
          trajet: { organizationId },
        },
      },
      _sum: { montant: true },
      _count: { _all: true },
    }),

    prisma.colis.count({
      where: {
        statut: "EN_ATTENTE",
        trajet: { organizationId },
      },
    }),

    prisma.paiement.aggregate({
      where: {
        statut: "EN_ATTENTE",
        reservation: {
          statut: { not: "ANNULE" },
          trajet: { organizationId },
        },
      },
      _sum: { montant: true },
      _count: { _all: true },
    }),

    prisma.trajetDepart.findMany({
      where: {
        statut: { not: "ANNULE" },
        dateDepart: { gte: jourStart, lt: jourEnd },
        trajet: { organizationId },
      },
      select: {
        id: true,
        capacitePlaces: true,
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
    }),

    prisma.trajetDepart.findMany({
      where: {
        statut: { not: "ANNULE" },
        dateDepart: { gte: todayStart },
        trajet: { organizationId },
      },
      select: {
        id: true,
        dateDepart: true,
        heureDepart: true,
        capacitePlaces: true,
        trajet: {
          select: {
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
      take: PROCHAINS_DEPARTS_LIMIT,
    }),
  ]);

  let placesVenduesJour = 0;
  let capaciteJour = 0;
  for (const d of departsJour) {
    capaciteJour += d.capacitePlaces;
    placesVenduesJour += d.reservations.reduce(
      (sum, r) => sum + r.passagers.length,
      0,
    );
  }

  const prochainsDeparts: GerantProchainDepart[] = prochainsRaw.map((d) => {
    const placesOccupees = d.reservations.reduce(
      (sum, r) => sum + r.passagers.length,
      0,
    );
    const placesRestantes = Math.max(0, d.capacitePlaces - placesOccupees);
    return {
      id: d.id,
      villeDepart: d.trajet.villeDepart,
      villeArrivee: d.trajet.villeArrivee,
      modeTransport: d.trajet.modeTransport,
      dateDepart: d.dateDepart.toISOString(),
      heureDepart: d.heureDepart,
      capacitePlaces: d.capacitePlaces,
      placesOccupees,
      placesRestantes,
      remplissagePct: pct(placesOccupees, d.capacitePlaces),
    };
  });

  const alertes: GerantDashboardAlerte[] = [];

  for (const d of prochainsDeparts) {
    if (d.capacitePlaces <= 0) continue;
    const ratioRestant = d.placesRestantes / d.capacitePlaces;
    if (ratioRestant < SEUIL_BIENTOT_COMPLET) {
      alertes.push({
        kind: "bientot_complet",
        departId: d.id,
        label: `${d.villeDepart} → ${d.villeArrivee} · ${d.heureDepart}`,
        placesRestantes: d.placesRestantes,
        capacitePlaces: d.capacitePlaces,
      });
    }
  }

  const paiementsEnAttenteCount = paiementsEnAttenteAgg._count._all;
  if (paiementsEnAttenteCount > 0) {
    alertes.push({
      kind: "paiement_en_attente",
      count: paiementsEnAttenteCount,
      montantTotal: paiementsEnAttenteAgg._sum.montant ?? 0,
    });
  }

  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");

  return {
    organizationId,
    dateJour: `${yyyy}-${mm}-${dd}`,
    kpis: {
      reservationsJour,
      caPayeJour: caAgg._sum.montant ?? 0,
      placesVenduesJour,
      capaciteJour,
      remplissagePct: pct(placesVenduesJour, capaciteJour),
      colisEnAttente,
    },
    prochainsDeparts,
    alertes,
  };
}
