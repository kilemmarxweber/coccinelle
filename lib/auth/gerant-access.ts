import { gerantPath } from "@/lib/agence/routes";
import {
  assertOrganizationPermission,
  type OrganizationPermissionMap,
} from "@/lib/auth/organization-permission";

export type GerantNavKey =
  | "overview"
  | "planning"
  | "trajets"
  | "reservations"
  | "equipe"
  | "rapports";

export type GerantNavItem = {
  key: GerantNavKey;
  label: string;
  segment: "" | "planning" | "trajets" | "reservations" | "equipe" | "rapports";
  /** Permission Better Auth requise pour afficher l’entrée. */
  permission: OrganizationPermissionMap;
};

/**
 * Menu métier gérant (matrice U04).
 * Guichetier échoue typiquement sur `rapport:read` / `trajet:create` → shell refusé.
 */
export const GERANT_NAV_ITEMS: readonly GerantNavItem[] = [
  {
    key: "overview",
    label: "Vue d’ensemble",
    segment: "",
    permission: { rapport: ["read"] },
  },
  {
    key: "planning",
    label: "Planning",
    segment: "planning",
    permission: { depart: ["read"] },
  },
  {
    key: "trajets",
    label: "Trajets",
    segment: "trajets",
    permission: { trajet: ["read"] },
  },
  {
    key: "reservations",
    label: "Réservations",
    segment: "reservations",
    permission: { inscription: ["update"] },
  },
  {
    key: "equipe",
    label: "Équipe",
    segment: "equipe",
    permission: { equipe: ["read"] },
  },
  {
    key: "rapports",
    label: "Rapports",
    segment: "rapports",
    permission: { rapport: ["read"] },
  },
] as const;

/** Ticket d’entrée shell gérant : `rapport:read` (gestionnaire / owner ; pas guichetier). */
export const GERANT_SHELL_PERMISSION: OrganizationPermissionMap = {
  rapport: ["read"],
};

export type GerantNavLink = {
  key: GerantNavKey;
  label: string;
  href: string;
};

export async function canAccessGerantShell(
  organizationId: string,
): Promise<boolean> {
  const result = await assertOrganizationPermission(
    organizationId,
    GERANT_SHELL_PERMISSION,
  );
  return result.ok;
}

export async function resolveGerantNavLinks(
  organizationId: string,
): Promise<GerantNavLink[]> {
  const links: GerantNavLink[] = [];

  for (const item of GERANT_NAV_ITEMS) {
    const result = await assertOrganizationPermission(
      organizationId,
      item.permission,
    );
    if (!result.ok) continue;
    links.push({
      key: item.key,
      label: item.label,
      href: gerantPath(organizationId, item.segment),
    });
  }

  return links;
}
