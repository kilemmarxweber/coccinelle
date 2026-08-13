/**
 * Chemins URL sous une branche d’organisation.
 *
 * Structure :
 *   .../branches/[branchId]              → hub dashboard
 *   .../branches/[branchId]/agence/*     → verticale voyage (AGENCE)
 *   .../branches/[branchId]/hotel/*      → verticale hospitalité (HOTEL | RESTAURANT)
 *   .../branches/[branchId]/boutique/*   → verticale retail (BOUTIQUE)
 *   .../branches/[branchId]/caisse/*     → cashpaye partagé (toutes)
 */

export type BranchModule = "agence" | "hotel" | "boutique";

export function organizationBranchesPath(organizationId: string): string {
  return `/admin/organizations/${organizationId}/branches`;
}

export function branchDashboardPath(
  organizationId: string,
  branchId: string,
): string {
  return `/admin/organizations/${organizationId}/branches/${branchId}`;
}

export function branchBasePath(
  organizationId: string,
  branchId: string,
): string {
  return branchDashboardPath(organizationId, branchId);
}

/** Module métier selon BranchType Prisma. */
export function moduleForBranchType(
  type: "AGENCE" | "HOTEL" | "BOUTIQUE" | "RESTAURANT" | string,
): BranchModule {
  if (type === "HOTEL" || type === "RESTAURANT") return "hotel";
  if (type === "BOUTIQUE") return "boutique";
  return "agence";
}

export function branchModulePath(
  organizationId: string,
  branchId: string,
  module: BranchModule,
): string {
  return `${branchBasePath(organizationId, branchId)}/${module}`;
}

export function branchCaissePath(
  organizationId: string,
  branchId: string,
): string {
  return `${branchBasePath(organizationId, branchId)}/caisse`;
}

/** Core partagé : taux de change + rapports (tous BranchType). */
export const sharedBranchRoutes = {
  tauxChange: (orgId: string, branchId: string) =>
    `${branchBasePath(orgId, branchId)}/taux-change`,
  bonsCommande: (orgId: string, branchId: string) =>
    `${branchBasePath(orgId, branchId)}/bons-commande`,
  depenses: (orgId: string, branchId: string) =>
    `${branchBasePath(orgId, branchId)}/depenses`,
  rapports: (orgId: string, branchId: string) =>
    `${branchBasePath(orgId, branchId)}/rapports`,
  tableauBord: (orgId: string, branchId: string) =>
    `${branchBasePath(orgId, branchId)}/rapports/tableau-bord`,
  ventes: (orgId: string, branchId: string) =>
    `${branchBasePath(orgId, branchId)}/rapports/ventes`,
  achats: (orgId: string, branchId: string) =>
    `${branchBasePath(orgId, branchId)}/rapports/achats`,
  financier: (orgId: string, branchId: string) =>
    `${branchBasePath(orgId, branchId)}/rapports/financier`,
  articles: (orgId: string, branchId: string) =>
    `${branchBasePath(orgId, branchId)}/rapports/articles`,
  mesCommandes: (orgId: string, branchId: string) =>
    `${branchBasePath(orgId, branchId)}/rapports/mes-commandes`,
  rapportSejours: (orgId: string, branchId: string) =>
    `${branchBasePath(orgId, branchId)}/rapports/sejours`,
} as const;

/** Sous-routes AGENCE (voyage). */
export const agenceRoutes = {
  root: (orgId: string, branchId: string) =>
    branchModulePath(orgId, branchId, "agence"),
  reservations: (orgId: string, branchId: string) =>
    `${branchModulePath(orgId, branchId, "agence")}/reservations`,
  guichet: (orgId: string, branchId: string) =>
    `${branchModulePath(orgId, branchId, "agence")}/reservations/guichet`,
  trajets: (orgId: string, branchId: string) =>
    `${branchModulePath(orgId, branchId, "agence")}/trajets`,
  colis: (orgId: string, branchId: string) =>
    `${branchModulePath(orgId, branchId, "agence")}/colis`,
  passages: (orgId: string, branchId: string) =>
    `${branchModulePath(orgId, branchId, "agence")}/passages`,
  clients: (orgId: string, branchId: string) =>
    `${branchModulePath(orgId, branchId, "agence")}/clients`,
} as const;

/** Sous-routes hospitalité (HOTEL / RESTAURANT). */
export const hotelRoutes = {
  root: (orgId: string, branchId: string) =>
    branchModulePath(orgId, branchId, "hotel"),
  chambres: (orgId: string, branchId: string) =>
    `${branchModulePath(orgId, branchId, "hotel")}/chambres`,
  sallesReunion: (orgId: string, branchId: string) =>
    `${branchModulePath(orgId, branchId, "hotel")}/salles-reunion`,
  sejours: (orgId: string, branchId: string) =>
    `${branchModulePath(orgId, branchId, "hotel")}/sejours`,
  produits: (orgId: string, branchId: string) =>
    `${branchModulePath(orgId, branchId, "hotel")}/produits`,
  livraison: (orgId: string, branchId: string) =>
    `${branchModulePath(orgId, branchId, "hotel")}/livraison`,
  serviceStock: (orgId: string, branchId: string) =>
    `${branchModulePath(orgId, branchId, "hotel")}/service-stock`,
  restauration: (orgId: string, branchId: string) =>
    `${branchModulePath(orgId, branchId, "hotel")}/restauration`,
  cuisine: (orgId: string, branchId: string) =>
    `${branchModulePath(orgId, branchId, "hotel")}/cuisine`,
  partenaires: (orgId: string, branchId: string) =>
    `${branchModulePath(orgId, branchId, "hotel")}/partenaires`,
} as const;

export const caisseRoutes = {
  root: (orgId: string, branchId: string) => branchCaissePath(orgId, branchId),
  receipt: (orgId: string, branchId: string, paymentId: string) =>
    `${branchCaissePath(orgId, branchId)}/recu/${paymentId}`,
} as const;

/** Sous-routes BOUTIQUE. */
export const boutiqueRoutes = {
  root: (orgId: string, branchId: string) =>
    branchModulePath(orgId, branchId, "boutique"),
  produits: (orgId: string, branchId: string) =>
    `${branchModulePath(orgId, branchId, "boutique")}/produits`,
  stock: (orgId: string, branchId: string) =>
    `${branchModulePath(orgId, branchId, "boutique")}/stock`,
  pos: (orgId: string, branchId: string) =>
    `${branchModulePath(orgId, branchId, "boutique")}/pos`,
} as const;
