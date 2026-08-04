import type { ModeTransport, Prisma } from "@/prisma/generated/prisma/client";
import prisma from "@/lib/prisma";
import { dayBounds, startOfToday } from "./day-bounds";
import type {
  ListDepartsDuJourInput,
  PublicDepartDetail,
  SearchDepartResult,
  SearchDepartsInput,
  SearchDepartsResult,
} from "./types";

export class OrganizationScopeError extends Error {
  constructor(message = "Organisation introuvable.") {
    super(message);
    this.name = "OrganizationScopeError";
  }
}

/**
 * Résout le scope org depuis id et/ou slug.
 * Une mauvaise combinaison (id ≠ slug) ou une org inconnue → erreur (pas de leak).
 */
export async function resolveOrganizationScope(input: {
  organizationId?: string;
  organizationSlug?: string;
}): Promise<{ id: string; slug: string }> {
  const id = input.organizationId?.trim();
  const slug = input.organizationSlug?.trim();

  if (!id && !slug) {
    throw new OrganizationScopeError("Organisation requise (id ou slug).");
  }

  if (id && slug) {
    const org = await prisma.organization.findFirst({
      where: { id, slug },
      select: { id: true, slug: true },
    });
    if (!org) {
      throw new OrganizationScopeError("Organisation introuvable.");
    }
    return org;
  }

  if (id) {
    const org = await prisma.organization.findUnique({
      where: { id },
      select: { id: true, slug: true },
    });
    if (!org) {
      throw new OrganizationScopeError("Organisation introuvable.");
    }
    return org;
  }

  const org = await prisma.organization.findUnique({
    where: { slug: slug! },
    select: { id: true, slug: true },
  });
  if (!org) {
    throw new OrganizationScopeError("Organisation introuvable.");
  }
  return org;
}

/**
 * Recherche de départs réutilisable (guichet / PWA).
 * Toujours scopée à une organisation ; seuls les départs `OUVERT` ;
 * dates passées exclues ; complets exclus sauf `includeComplets`.
 */
export async function searchDeparts(
  input: SearchDepartsInput,
): Promise<SearchDepartsResult> {
  const org = await resolveOrganizationScope({
    organizationId: input.organizationId,
    organizationSlug: input.organizationSlug,
  });

  const villeDepart = input.villeDepart.trim();
  const villeArrivee = input.villeArrivee.trim();
  if (!villeDepart || !villeArrivee) {
    throw new Error("Ville de départ et d'arrivée requises.");
  }

  const { start, end } = dayBounds(input.date);
  const todayStart = startOfToday();

  // Uniquement futurs / du jour — une date strictement passée → liste vide.
  if (end <= todayStart) {
    return { organizationId: org.id, results: [] };
  }

  const dayStart = start < todayStart ? todayStart : start;

  const trajetFilter: Prisma.TrajetWhereInput = {
    organizationId: org.id,
    villeDepart: { equals: villeDepart, mode: "insensitive" },
    villeArrivee: { equals: villeArrivee, mode: "insensitive" },
  };
  if (input.modeTransport) {
    trajetFilter.modeTransport = input.modeTransport;
  }

  const rows = await prisma.trajetDepart.findMany({
    where: {
      statut: "OUVERT",
      dateDepart: { gte: dayStart, lt: end },
      trajet: trajetFilter,
    },
    include: {
      trajet: {
        select: {
          id: true,
          villeDepart: true,
          villeArrivee: true,
          modeTransport: true,
          prixBase: true,
          prixParKilo: true,
          kilosGratuits: true,
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

  return {
    organizationId: org.id,
    results: mapDepartRows(rows, input.includeComplets === true),
  };
}

/**
 * Départs du jour pour la vente express guichet (toutes destinations).
 * Même règles que `searchDeparts` (`OUVERT` seuls, complets selon flag).
 */
export async function listDepartsDuJour(
  input: ListDepartsDuJourInput,
): Promise<SearchDepartsResult> {
  const org = await resolveOrganizationScope({
    organizationId: input.organizationId,
    organizationSlug: input.organizationSlug,
  });

  const { start, end } = dayBounds(input.date ?? new Date());
  const todayStart = startOfToday();

  if (end <= todayStart) {
    return { organizationId: org.id, results: [] };
  }

  const dayStart = start < todayStart ? todayStart : start;

  const trajetFilter: Prisma.TrajetWhereInput = {
    organizationId: org.id,
  };
  if (input.modeTransport) {
    trajetFilter.modeTransport = input.modeTransport;
  }

  const rows = await prisma.trajetDepart.findMany({
    where: {
      statut: "OUVERT",
      dateDepart: { gte: dayStart, lt: end },
      trajet: trajetFilter,
    },
    include: {
      trajet: {
        select: {
          id: true,
          villeDepart: true,
          villeArrivee: true,
          modeTransport: true,
          prixBase: true,
          prixParKilo: true,
          kilosGratuits: true,
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

  return {
    organizationId: org.id,
    results: mapDepartRows(rows, input.includeComplets === true),
  };
}

type DepartRow = {
  id: string;
  dateDepart: Date;
  heureDepart: string;
  statut: SearchDepartResult["statut"];
  capacitePlaces: number;
  trajet: {
    id: string;
    villeDepart: string;
    villeArrivee: string;
    modeTransport: ModeTransport;
    prixBase: number;
    prixParKilo: number;
    kilosGratuits: number;
  };
  reservations: Array<{ passagers: Array<{ id: string }> }>;
};

function mapDepartRows(
  rows: DepartRow[],
  includeComplets: boolean,
): SearchDepartResult[] {
  const results: SearchDepartResult[] = [];
  for (const d of rows) {
    const mapped = mapDepartRow(d);
    if (mapped.complet && !includeComplets) continue;
    results.push(mapped);
  }
  return results;
}

function mapDepartRow(d: DepartRow): SearchDepartResult {
  const placesOccupees = d.reservations.reduce(
    (sum, r) => sum + r.passagers.length,
    0,
  );
  const placesRestantes = Math.max(0, d.capacitePlaces - placesOccupees);
  return {
    departId: d.id,
    trajetId: d.trajet.id,
    villeDepart: d.trajet.villeDepart,
    villeArrivee: d.trajet.villeArrivee,
    modeTransport: d.trajet.modeTransport as ModeTransport,
    dateDepart: d.dateDepart.toISOString(),
    heureDepart: d.heureDepart,
    statut: d.statut,
    prixBase: d.trajet.prixBase,
    prixParKilo: d.trajet.prixParKilo,
    kilosGratuits: d.trajet.kilosGratuits,
    capacitePlaces: d.capacitePlaces,
    placesRestantes,
    complet: placesRestantes === 0,
  };
}

/**
 * Détail d’un départ pour la PWA — scopé org (slug ou id).
 * Inconnu / autre org → `null` (pas de leak).
 */
export async function getDepartForOrganization(input: {
  departId: string;
  organizationId?: string;
  organizationSlug?: string;
}): Promise<PublicDepartDetail | null> {
  const org = await resolveOrganizationScope({
    organizationId: input.organizationId,
    organizationSlug: input.organizationSlug,
  });

  const departId = input.departId.trim();
  if (!departId) return null;

  const row = await prisma.trajetDepart.findFirst({
    where: {
      id: departId,
      statut: { not: "ANNULE" },
      trajet: { organizationId: org.id },
    },
    include: {
      trajet: {
        select: {
          id: true,
          villeDepart: true,
          villeArrivee: true,
          modeTransport: true,
          prixBase: true,
          prixParKilo: true,
          kilosGratuits: true,
          dureeEstimee: true,
          organizationId: true,
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
  });

  if (!row) return null;

  const base = mapDepartRow(row);
  return {
    ...base,
    dureeEstimee: row.trajet.dureeEstimee,
    organizationId: org.id,
    organizationSlug: org.slug,
  };
}
