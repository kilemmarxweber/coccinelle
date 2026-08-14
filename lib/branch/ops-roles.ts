/**
 * Rôles opérationnels hospitalité (métier par branche).
 * Distinct de Member.role org (owner / gestionnaire / …).
 */

export const OPS_ROLE = {
  SERVEUR: "serveur",
  CAISSIER: "caissier",
  RECEPTIONNISTE: "receptionniste",
  MANAGER: "manager",
  GERANT: "gerant",
  PROPRIETAIRE: "proprietaire",
  /** Legacy BranchMember.role */
  BRANCH_MANAGER: "branch_manager",
} as const;

export type OpsRole = (typeof OPS_ROLE)[keyof typeof OPS_ROLE];

export const OPS_ROLE_SLUGS = [
  OPS_ROLE.SERVEUR,
  OPS_ROLE.CAISSIER,
  OPS_ROLE.RECEPTIONNISTE,
  OPS_ROLE.MANAGER,
  OPS_ROLE.GERANT,
  OPS_ROLE.PROPRIETAIRE,
] as const;

export type AssignableOpsRole = (typeof OPS_ROLE_SLUGS)[number];

/** Identifiants stables des cartes hub (filtrage). */
export const DASH_CARD = {
  CAISSE: "caisse",
  TAUX_CHANGE: "taux_change",
  SEJOURS: "sejours",
  RESTAURATION: "restauration",
  CUISINE: "cuisine",
  SERVICE_STOCK: "service_stock",
  CHAMBRES: "chambres",
  SALLES: "salles",
  PRODUITS_HOTEL: "produits_hotel",
  LIVRAISON: "livraison",
  BONS_COMMANDE: "bons_commande",
  DEPENSES: "depenses",
  RAPPORT_TABLEAU: "rapport_tableau",
  RAPPORT_VENTES: "rapport_ventes",
  RAPPORT_ACHATS: "rapport_achats",
  RAPPORT_FINANCIER: "rapport_financier",
  RAPPORT_ARTICLES: "rapport_articles",
  RAPPORT_MES_COMMANDES: "rapport_mes_commandes",
  RAPPORT_SEJOURS: "rapport_sejours",
  CLIENTS_PARTENAIRES: "clients_partenaires",
  /** Boutique / agence — non filtrés en hospitalité */
  POS: "pos",
  BOUTIQUE_PRODUITS: "boutique_produits",
  BOUTIQUE_STOCK: "boutique_stock",
  GUICHET: "guichet",
  RESERVATIONS: "reservations",
  CLIENTS: "clients",
  TRAJETS: "trajets",
  COLIS: "colis",
  EMBARQUEMENT: "embarquement",
} as const;

export type DashCardId = (typeof DASH_CARD)[keyof typeof DASH_CARD];

const ALL_HOSPITALITY = new Set<string>(Object.values(DASH_CARD));

/** Cartes exclues pour gérant / manager (ops front). */
const GERANT_EXCLUDED = new Set<string>([
  DASH_CARD.CAISSE,
  DASH_CARD.RESTAURATION,
  DASH_CARD.CUISINE,
  DASH_CARD.RAPPORT_MES_COMMANDES,
]);

const ROLE_CARDS: Record<
  string,
  ReadonlySet<string> | "ALL" | "GERANT_MATRIX"
> = {
  [OPS_ROLE.PROPRIETAIRE]: "ALL",
  [OPS_ROLE.SERVEUR]: new Set([
    DASH_CARD.RESTAURATION,
    DASH_CARD.RAPPORT_MES_COMMANDES,
  ]),
  [OPS_ROLE.CAISSIER]: new Set([
    DASH_CARD.CAISSE,
    DASH_CARD.TAUX_CHANGE,
    DASH_CARD.RESTAURATION,
    DASH_CARD.CUISINE,
    DASH_CARD.SEJOURS,
    DASH_CARD.CLIENTS_PARTENAIRES,
    DASH_CARD.SERVICE_STOCK,
    DASH_CARD.RAPPORT_TABLEAU,
    DASH_CARD.RAPPORT_VENTES,
  ]),
  [OPS_ROLE.RECEPTIONNISTE]: new Set([
    DASH_CARD.SEJOURS,
    DASH_CARD.CHAMBRES,
    DASH_CARD.CLIENTS_PARTENAIRES,
    DASH_CARD.RAPPORT_TABLEAU,
    DASH_CARD.RAPPORT_SEJOURS,
  ]),
  [OPS_ROLE.GERANT]: "GERANT_MATRIX",
  [OPS_ROLE.MANAGER]: "GERANT_MATRIX",
  [OPS_ROLE.BRANCH_MANAGER]: "GERANT_MATRIX",
};

export function opsRoleLabel(role: string | null | undefined): string {
  switch (role) {
    case OPS_ROLE.SERVEUR:
      return "Serveur(euse)";
    case OPS_ROLE.CAISSIER:
      return "Caissier(ère)";
    case OPS_ROLE.RECEPTIONNISTE:
      return "Réceptionniste";
    case OPS_ROLE.MANAGER:
      return "Manager";
    case OPS_ROLE.GERANT:
    case OPS_ROLE.BRANCH_MANAGER:
      return "Gérant";
    case OPS_ROLE.PROPRIETAIRE:
      return "Propriétaire";
    default:
      return role ? role.charAt(0).toUpperCase() + role.slice(1) : "Équipe";
  }
}

export function normalizeOpsRole(raw: string | null | undefined): OpsRole {
  const r = (raw ?? "").trim().toLowerCase();
  if ((Object.values(OPS_ROLE) as string[]).includes(r)) {
    return r as OpsRole;
  }
  return OPS_ROLE.GERANT;
}

/**
 * Rôle effectif pour le hub / gardes.
 * Owner org + admin plateforme → propriétaire (full).
 */
export function resolveOpsRole(input: {
  isPlatformAdmin?: boolean;
  orgRole?: string | null;
  branchRole?: string | null;
}): OpsRole {
  if (input.isPlatformAdmin) return OPS_ROLE.PROPRIETAIRE;
  const org = (input.orgRole ?? "").trim().toLowerCase();
  if (org === "owner") return OPS_ROLE.PROPRIETAIRE;

  const branch = (input.branchRole ?? "").trim().toLowerCase();
  if (branch && (Object.values(OPS_ROLE) as string[]).includes(branch)) {
    return branch as OpsRole;
  }
  if (org === "gestionnaire") return OPS_ROLE.GERANT;
  return OPS_ROLE.GERANT;
}

export function canSeeDashCard(
  opsRole: OpsRole | string,
  cardId: string | undefined | null,
): boolean {
  if (!cardId) return true;
  const role = normalizeOpsRole(opsRole);
  const spec = ROLE_CARDS[role] ?? "GERANT_MATRIX";

  if (spec === "ALL") return true;
  if (spec === "GERANT_MATRIX") {
    return !GERANT_EXCLUDED.has(cardId);
  }
  return spec.has(cardId);
}

/** Ouverture / clôture / réassort du float — caissier (et gérant / owner), pas le serveur. */
export function canOperateServiceStock(opsRole: OpsRole | string): boolean {
  return canSeeDashCard(opsRole, DASH_CARD.SERVICE_STOCK);
}

/** Toutes les cartes hospitalité connues (tests / debug). */
export function allHospitalityCardIds(): string[] {
  return [...ALL_HOSPITALITY];
}

export function isAssignableOpsRole(value: string): value is AssignableOpsRole {
  return (OPS_ROLE_SLUGS as readonly string[]).includes(value);
}
