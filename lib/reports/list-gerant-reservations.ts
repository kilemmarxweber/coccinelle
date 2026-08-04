import type {
  Prisma,
  SourceReservation,
  StatutPaiement,
  StatutReservation,
} from "@/prisma/generated/prisma/client";
import prisma from "@/lib/prisma";
import { dayBounds } from "@/lib/search-departs/day-bounds";

export type GerantReservationFilters = {
  statut?: StatutReservation;
  source?: SourceReservation;
  paiement?: StatutPaiement;
  /** Inclusive ISO day `YYYY-MM-DD` on `createdAt`. */
  from?: string;
  /** Inclusive ISO day `YYYY-MM-DD` on `createdAt`. */
  to?: string;
};

export type GerantReservationRow = {
  id: string;
  codeUnique: string;
  statut: StatutReservation;
  source: SourceReservation;
  prixTotal: number;
  nombrePlaces: number;
  dateDepart: string;
  heureDepart: string;
  createdAt: string;
  clientLabel: string;
  clientEmail: string;
  villeDepart: string;
  villeArrivee: string;
  paiementStatut: StatutPaiement;
};

const STATUTS_RESERVATION = new Set<string>([
  "CONFIRME",
  "EMBARQUE",
  "RATE",
  "REPORTE",
  "ANNULE",
]);

const SOURCES = new Set<string>(["GUICHET", "EN_LIGNE"]);

const STATUTS_PAIEMENT = new Set<string>(["EN_ATTENTE", "PAYE", "ECHOUE"]);

function isIsoDay(value: string | undefined): value is string {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function parseGerantReservationFilters(
  sp: Record<string, string | string[] | undefined>,
): GerantReservationFilters {
  const one = (key: string) => {
    const v = sp[key];
    return typeof v === "string" ? v : undefined;
  };

  const statut = one("statut");
  const source = one("source");
  const paiement = one("paiement");
  const from = one("from");
  const to = one("to");

  return {
    statut:
      statut && STATUTS_RESERVATION.has(statut)
        ? (statut as StatutReservation)
        : undefined,
    source:
      source && SOURCES.has(source) ? (source as SourceReservation) : undefined,
    paiement:
      paiement && STATUTS_PAIEMENT.has(paiement)
        ? (paiement as StatutPaiement)
        : undefined,
    from: isIsoDay(from) ? from : undefined,
    to: isIsoDay(to) ? to : undefined,
  };
}

function clientLabel(r: {
  prenom: string | null;
  postnom: string | null;
  user: { name: string | null; email: string };
}): string {
  const parts = [
    r.prenom,
    r.user.name?.split(" ")[0],
    r.postnom,
  ].filter(Boolean);
  return parts[0] ? parts.join(" ") : r.user.email;
}

function buildWhere(
  organizationId: string,
  filters: GerantReservationFilters,
): Prisma.ReservationWhereInput {
  const where: Prisma.ReservationWhereInput = {
    trajet: { organizationId },
  };

  if (filters.statut) where.statut = filters.statut;
  if (filters.source) where.source = filters.source;

  if (filters.paiement) {
    where.paiements = { some: { statut: filters.paiement } };
  }

  const from = filters.from;
  const to = filters.to;
  if (from || to) {
    const start = dayBounds(from ?? to!).start;
    const end = dayBounds(to ?? from!).end;
    where.createdAt = { gte: start, lt: end };
  }

  return where;
}

/**
 * Liste filtrable des réservations d’une org (scope `trajet.organizationId`).
 */
export async function listGerantReservations(
  organizationId: string,
  filters: GerantReservationFilters = {},
): Promise<GerantReservationRow[]> {
  const rows = await prisma.reservation.findMany({
    where: buildWhere(organizationId, filters),
    select: {
      id: true,
      codeUnique: true,
      statut: true,
      source: true,
      prixTotal: true,
      nombrePlaces: true,
      dateDepart: true,
      heureDepart: true,
      createdAt: true,
      client: {
        select: {
          prenom: true,
          postnom: true,
          user: { select: { name: true, email: true } },
        },
      },
      trajet: {
        select: { villeDepart: true, villeArrivee: true },
      },
      paiements: {
        select: { statut: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return rows.map((r) => ({
    id: r.id,
    codeUnique: r.codeUnique,
    statut: r.statut,
    source: r.source,
    prixTotal: r.prixTotal,
    nombrePlaces: r.nombrePlaces,
    dateDepart: r.dateDepart.toISOString(),
    heureDepart: r.heureDepart,
    createdAt: r.createdAt.toISOString(),
    clientLabel: clientLabel(r.client),
    clientEmail: r.client.user.email,
    villeDepart: r.trajet.villeDepart,
    villeArrivee: r.trajet.villeArrivee,
    paiementStatut: r.paiements[0]?.statut ?? "EN_ATTENTE",
  }));
}

/** CSV UTF-8 (BOM) des réservations filtrées. */
export function reservationsToCsv(rows: GerantReservationRow[]): string {
  const header = [
    "code",
    "client",
    "email",
    "trajet",
    "date_depart",
    "heure_depart",
    "montant",
    "statut",
    "source",
    "paiement",
    "cree_le",
  ];
  const escape = (v: string | number) => {
    const s = String(v);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [
    header.join(","),
    ...rows.map((r) =>
      [
        r.codeUnique,
        r.clientLabel,
        r.clientEmail,
        `${r.villeDepart} → ${r.villeArrivee}`,
        r.dateDepart.slice(0, 10),
        r.heureDepart,
        r.prixTotal,
        r.statut,
        r.source,
        r.paiementStatut,
        r.createdAt.slice(0, 10),
      ]
        .map(escape)
        .join(","),
    ),
  ];
  return `\uFEFF${lines.join("\r\n")}`;
}
