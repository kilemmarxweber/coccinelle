/**
 * Convention de routage agence (U09+).
 *
 * Espace métier hors `/admin` (réservé admin plateforme) :
 *   /agence/[orgId]/gerant/...   — pilotage (gestionnaire, owner en supervision)
 *   /agence/[orgId]/guichet/...  — vente comptoir (cible ; existant encore sous /admin/.../agences)
 *
 * `orgId` = id Better Auth organization (session `activeOrganizationId`).
 * Naviguer dans ces routes doit toujours appeler `setActiveOrganization` pour
 * ne pas casser le scope org Better Auth.
 */

export function agenceBasePath(orgId: string): string {
  return `/agence/${orgId}`;
}

export function gerantBasePath(orgId: string): string {
  return `${agenceBasePath(orgId)}/gerant`;
}

export function gerantPath(
  orgId: string,
  segment:
    | ""
    | "planning"
    | "trajets"
    | "reservations"
    | "equipe"
    | "rapports" = "",
): string {
  const base = gerantBasePath(orgId);
  return segment ? `${base}/${segment}` : base;
}

/** Guichet actuel (pré-migration U07 paths) — fallback redirect pour rôles non gérant. */
export function legacyGuichetPath(orgId: string): string {
  return `/admin/organizations/${orgId}/agences/reservations/guichet`;
}
