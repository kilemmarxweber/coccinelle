/**
 * Rôles opérationnels hospitalité (métier par branche).
 * Distinct de Member.role org (owner / admin / user).
 * Matrice VIEW : seed TS (fallback) ; runtime DB via privileges.ts.
 */

import {
  seedAllows,
  seedViewResourcesForSlug,
} from "@/lib/branch/privilege-seed";

export const OPS_ROLE = {
  SERVEUR: "serveur",
  CAISSIER: "caissier",
  CAISSIER_SEJOURS: "caissier_sejours",
  CAISSIER_RESTO: "caissier_resto",
  RECEPTIONNISTE: "receptionniste",
  MANAGER: "manager",
  GERANT: "gerant",
  PROPRIETAIRE: "proprietaire",
  /** Legacy BranchMember.role */
  BRANCH_MANAGER: "branch_manager",
} as const;

export type OpsRole = (typeof OPS_ROLE)[keyof typeof OPS_ROLE];

/** Rôles proposés à l’assignation (sans legacy branch_manager). */
export const OPS_ROLE_SLUGS = [
  OPS_ROLE.SERVEUR,
  OPS_ROLE.CAISSIER_SEJOURS,
  OPS_ROLE.CAISSIER_RESTO,
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
  PARAMETRES: "parametres",
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

export function opsRoleLabel(role: string | null | undefined): string {
  switch (role) {
    case OPS_ROLE.SERVEUR:
      return "Serveur(euse)";
    case OPS_ROLE.CAISSIER_SEJOURS:
      return "Caissier séjours";
    case OPS_ROLE.CAISSIER_RESTO:
      return "Caissier restauration";
    case OPS_ROLE.CAISSIER:
      return "Caissier (legacy)";
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
      if (!role) return "Équipe";
      return role
        .split("_")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
  }
}

export function normalizeOpsRole(raw: string | null | undefined): OpsRole {
  const r = (raw ?? "").trim().toLowerCase();
  if ((Object.values(OPS_ROLE) as string[]).includes(r)) {
    return r as OpsRole;
  }
  // Slug custom BranchRole : conserver tel quel pour lookup privileges DB
  if (/^[a-z][a-z0-9_]{1,47}$/.test(r)) {
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
  if (branch) {
    if ((Object.values(OPS_ROLE) as string[]).includes(branch)) {
      return branch as OpsRole;
    }
    if (/^[a-z][a-z0-9_]{1,47}$/.test(branch)) {
      return branch as OpsRole;
    }
  }
  if (org === "admin" || org === "gestionnaire") return OPS_ROLE.GERANT;
  return OPS_ROLE.GERANT;
}

/**
 * Fallback sync (seed TS). Préférer `canSeeDashCardAsync` / allowedCardIds DB.
 */
export function canSeeDashCard(
  opsRole: OpsRole | string,
  cardId: string | undefined | null,
  allowedCardIds?: ReadonlySet<string> | "ALL" | null,
): boolean {
  if (!cardId) return true;
  if (allowedCardIds === "ALL") return true;
  if (allowedCardIds) return allowedCardIds.has(cardId);

  const role = normalizeOpsRole(opsRole);
  if (role === OPS_ROLE.PROPRIETAIRE) return true;
  const views = seedViewResourcesForSlug(role);
  if (views === "ALL") return true;
  return views.has(cardId);
}

export function canPrivilegeSync(
  opsRole: OpsRole | string,
  resource: string,
  action: "VIEW" | "READ" | "CREATE" | "UPDATE" | "DELETE",
): boolean {
  const role = normalizeOpsRole(opsRole);
  if (role === OPS_ROLE.PROPRIETAIRE) return true;
  return seedAllows(role, resource, action);
}

/** Ouverture / clôture / réassort du float. */
export function canOperateServiceStock(opsRole: OpsRole | string): boolean {
  return canSeeDashCard(opsRole, DASH_CARD.SERVICE_STOCK);
}

export function allHospitalityCardIds(): string[] {
  return [...ALL_HOSPITALITY];
}

export function isAssignableOpsRole(value: string): value is AssignableOpsRole {
  return (OPS_ROLE_SLUGS as readonly string[]).includes(value);
}

export function isLegacyCaissierRole(role: string | null | undefined): boolean {
  return (role ?? "").trim().toLowerCase() === OPS_ROLE.CAISSIER;
}
