/**
 * Catalogue des permissions de rôle d’organisation (Better Auth access control).
 * Aligné sur `organizationProductStatements` / presets R02.
 */

import {
  ALL_ORG_ROLE_SLUGS,
  ORG_ROLE,
  ORGANIZATION_PRODUCT_CATALOG,
  countOrganizationProductPermissions,
  organizationProductStatements,
  organizationRoleStatements,
} from "@/lib/permissions";
import { ORG_ROLE_LABEL } from "@/lib/org-role-labels";
import {
  ORG_ROLE_PRESET_PERMISSIONS,
  isOrgRolePresetSlug,
} from "@/lib/org/role-presets";
import {
  CATALOG_PERMISSIONS_FR,
  permissionLabelFr,
} from "@/lib/permission-labels-fr";

export type OrganizationRolePermissionPayload = Record<string, readonly string[]>;

export type OrganizationRoleCatalogEntry = {
  slug: (typeof ALL_ORG_ROLE_SLUGS)[number];
  label: string;
  permissions: OrganizationRolePermissionPayload;
};

/** Ressources du catalogue produit (99) — hors admin plugin / team. */
export const ORGANIZATION_BUSINESS_RESOURCES = Object.keys(
  organizationProductStatements,
) as Array<keyof typeof organizationProductStatements>;

/** @deprecated Alias — préférer ORGANIZATION_BUSINESS_RESOURCES. */
export const ORGANIZATION_PRODUCT_RESOURCES = ORGANIZATION_BUSINESS_RESOURCES;

export {
  CATALOG_PERMISSIONS_FR,
  ORGANIZATION_PRODUCT_CATALOG,
  countOrganizationProductPermissions,
  permissionLabelFr,
};

function permissionsForSlug(
  slug: (typeof ALL_ORG_ROLE_SLUGS)[number],
): OrganizationRolePermissionPayload {
  if (slug === ORG_ROLE.OWNER) {
    return (organizationRoleStatements[ORG_ROLE.OWNER] ??
      {}) as OrganizationRolePermissionPayload;
  }
  if (isOrgRolePresetSlug(slug)) {
    return ORG_ROLE_PRESET_PERMISSIONS[slug] as OrganizationRolePermissionPayload;
  }
  return (organizationRoleStatements[slug] ??
    {}) as OrganizationRolePermissionPayload;
}

/** Catalogue : owner + presets DAC (R02). */
export const ORGANIZATION_ROLE_PERMISSION_CATALOG: OrganizationRoleCatalogEntry[] =
  ALL_ORG_ROLE_SLUGS.map((slug) => ({
    slug,
    label: ORG_ROLE_LABEL[slug],
    permissions: permissionsForSlug(slug),
  }));

/** Rôles produit (owner + presets seedés). */
export const PRODUCT_ORG_ROLES = [
  ORG_ROLE.OWNER,
  ORG_ROLE.GERANT,
  ORG_ROLE.GUICHETIER,
  ORG_ROLE.CLIENT,
] as const;
