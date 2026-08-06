/**
 * Chemins URL sous une branche d’organisation.
 *
 * Structure :
 *   .../branches/[branchId]              → hub dashboard
 *   .../branches/[branchId]/agence/*     → verticale voyage (AGENCE)
 *   .../branches/[branchId]/hotel/*      → verticale hôtel (HOTEL)
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
  type: "AGENCE" | "HOTEL" | "BOUTIQUE" | string,
): BranchModule {
  if (type === "HOTEL") return "hotel";
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

/** Sous-routes HOTEL. */
export const hotelRoutes = {
  root: (orgId: string, branchId: string) =>
    branchModulePath(orgId, branchId, "hotel"),
  chambres: (orgId: string, branchId: string) =>
    `${branchModulePath(orgId, branchId, "hotel")}/chambres`,
  sejours: (orgId: string, branchId: string) =>
    `${branchModulePath(orgId, branchId, "hotel")}/sejours`,
  restauration: (orgId: string, branchId: string) =>
    `${branchModulePath(orgId, branchId, "hotel")}/restauration`,
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
