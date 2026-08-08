/**
 * Catalogue des permissions de rôle d’organisation (Better Auth access control).
 * Aligné sur `accessControlStatements` / `organizationRoleStatements`.
 */

import {
  ALL_ORG_ROLE_SLUGS,
  ORG_ROLE,
  accessControlStatements,
  organizationRoleStatements,
} from "@/lib/permissions";
import { ORG_ROLE_LABEL } from "@/lib/org-role-labels";

export type OrganizationRolePermissionPayload = Record<string, readonly string[]>;

export type OrganizationRoleCatalogEntry = {
  slug: (typeof ALL_ORG_ROLE_SLUGS)[number];
  label: string;
  permissions: OrganizationRolePermissionPayload;
};

/** Resources métier déclarées dans l’AC (hors presets plugins). */
export const ORGANIZATION_BUSINESS_RESOURCES = [
  "inscription",
  "trajet",
  "depart",
  "embarquement",
  "rapport",
  "equipe",
  "branch",
  "hotel_room",
  "hotel_stay",
  "hotel_fnb",
] as const satisfies ReadonlyArray<keyof typeof accessControlStatements>;

/** Catalogue complet : un entrée par slug org connu de l’app. */
export const ORGANIZATION_ROLE_PERMISSION_CATALOG: OrganizationRoleCatalogEntry[] =
  ALL_ORG_ROLE_SLUGS.map((slug) => ({
    slug,
    label: ORG_ROLE_LABEL[slug],
    permissions: (organizationRoleStatements[slug] ?? {}) as OrganizationRolePermissionPayload,
  }));

/** Rôles produit principaux (U04 + hôtel units-03). */
export const PRODUCT_ORG_ROLES = [
  ORG_ROLE.OWNER,
  ORG_ROLE.GESTIONNAIRE,
  ORG_ROLE.GUICHETIER,
  ORG_ROLE.SERVEUR,
  ORG_ROLE.PARENT,
] as const;
