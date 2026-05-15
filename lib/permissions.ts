/**
 * Slugs de rôles, presets Better Auth (`adminAc`, `ownerAc`, …),
 * premières grilles métier pour les rôles d’organisation, et AC partagée pour `betterAuth`.
 */

import { createAccessControl } from "better-auth/plugins/access";
import {
  adminAc as adminPluginAdminAc,
  defaultStatements as adminPluginSchemaStatements,
  userAc as adminPluginUserAc,
} from "better-auth/plugins/admin/access";
import {
  adminAc as organizationPluginAdminAc,
  defaultStatements as organizationPluginSchemaStatements,
  ownerAc,
  memberAc as organizationPluginMemberAc,
} from "better-auth/plugins/organization/access";

export const APP_ROLE = {
  ADMIN: "admin",
  USER: "user",
} as const;

export function isAppAdminRole(role: string | null | undefined): boolean {
  return role === APP_ROLE.ADMIN;
}

export const ORG_ROLE = {
  OWNER: "owner",
  GESTIONNAIRE: "gestionnaire",
  PARENT: "parent",
  MONITEUR: "moniteur",
  RESPONSABLE: "responsable",
  SURVEILLANT: "surveillant",
} as const;

export const ALL_ORG_ROLE_SLUGS = [
  ORG_ROLE.OWNER,
  ORG_ROLE.GESTIONNAIRE,
  ORG_ROLE.PARENT,
  ORG_ROLE.MONITEUR,
  ORG_ROLE.RESPONSABLE,
  ORG_ROLE.SURVEILLANT,
] as const;



export const accessControlStatements = {
  ...adminPluginSchemaStatements,
  ...organizationPluginSchemaStatements,
} as const;

type StatementShape = {
  [K in keyof typeof accessControlStatements]?: ReadonlyArray<
    (typeof accessControlStatements)[K][number]
  >;
};

/** Preset plugin Admin (`adminAc`) + même niveau organisation que `organization.adminAc`, plus domaine. */
export const applicationRoleStatements: Record<string, StatementShape> = {
  [APP_ROLE.ADMIN]: {
    ...adminPluginAdminAc.statements,
    ...organizationPluginAdminAc.statements,
  },
  [APP_ROLE.USER]: {
    ...adminPluginUserAc.statements,
  },
};

/** Preset `ownerAc` pour le créateur ; autres rôles = grille métier initiale partagée. */
export const organizationRoleStatements: Record<string, StatementShape> = {
  [ORG_ROLE.OWNER]: {
    ...ownerAc.statements,
  },
  [ORG_ROLE.GESTIONNAIRE]: {
    ...organizationPluginMemberAc.statements,
    ...organizationPluginAdminAc.statements,
  },
  [ORG_ROLE.PARENT]: { ...organizationPluginMemberAc.statements },
  [ORG_ROLE.MONITEUR]: { ...organizationPluginMemberAc.statements },
  [ORG_ROLE.RESPONSABLE]: { ...organizationPluginMemberAc.statements },
  [ORG_ROLE.SURVEILLANT]: { ...organizationPluginMemberAc.statements },
};

const authAccessControl = createAccessControl(accessControlStatements);

type NewPluginRoleArg = Parameters<typeof authAccessControl.newRole>[0];

function rolesFromStatements(defs: Record<string, StatementShape>) {
  return Object.fromEntries(
    Object.entries(defs).map(([role, statements]) => [
      role,
      authAccessControl.newRole(statements as NewPluginRoleArg),
    ]),
  );
}

/** Rôles plugin `admin` : `Record<slug, Role>` attendu par better-auth (`authorize` + `statements`). */
export const applicationRoles = rolesFromStatements(applicationRoleStatements);

/** Rôles plugin `organization` : même forme que `applicationRoles`. */
export const organizationRoles = rolesFromStatements(organizationRoleStatements);

export { authAccessControl };