import type { ModeTransport, StatutTrajetDepart } from "@/prisma/generated/prisma/client";

/**
 * Règle complétude (U05) :
 * - Par défaut, les départs à `placesRestantes === 0` sont **exclus**.
 * - Avec `includeComplets: true`, ils apparaissent avec `complet: true`
 *   (badge « Complet » côté UI).
 */
export type SearchDepartsInput = {
  /** Scope tenant obligatoire (id Better Auth). */
  organizationId?: string;
  /** Alternative à organizationId — résolu sans leak cross-tenant. */
  organizationSlug?: string;
  villeDepart: string;
  villeArrivee: string;
  /** Jour calendaire (YYYY-MM-DD ou Date). */
  date: string | Date;
  modeTransport?: ModeTransport;
  /** Inclure les départs sans place (défaut: false). */
  includeComplets?: boolean;
};

export type SearchDepartResult = {
  departId: string;
  trajetId: string;
  villeDepart: string;
  villeArrivee: string;
  modeTransport: ModeTransport;
  dateDepart: string;
  heureDepart: string;
  statut: StatutTrajetDepart;
  /** Prix de base du trajet (« à partir de »). */
  prixBase: number;
  prixParKilo: number;
  kilosGratuits: number;
  capacitePlaces: number;
  placesRestantes: number;
  complet: boolean;
};

/** Liste des départs du jour (vente express guichet) — villes optionnelles. */
export type ListDepartsDuJourInput = {
  organizationId?: string;
  organizationSlug?: string;
  date?: string | Date;
  modeTransport?: ModeTransport;
  includeComplets?: boolean;
};

export type SearchDepartsResult = {
  organizationId: string;
  results: SearchDepartResult[];
};

/** Détail départ PWA (horaires + tarifs catégories). */
export type PublicDepartDetail = SearchDepartResult & {
  dureeEstimee: number | null;
  organizationId: string;
  organizationSlug: string;
};
