/**
 * Slugs de rôles, presets Better Auth (`adminAc`, `ownerAc`, …),
 * grilles métier pour les rôles d’organisation, et AC partagée pour `betterAuth`.
 *
 * Mapping produit → Better Auth :
 * - Owner → `owner` (crée / supervise l’org)
 * - Gérant → `gestionnaire` (agence ; ne crée pas d’org)
 * - Guichetier → `guichetier` (vente comptoir)
 * - Client → `parent` (self-service)
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
  GUICHETIER: "guichetier",
  PARENT: "parent",
} as const;

export const ALL_ORG_ROLE_SLUGS = [
  ORG_ROLE.OWNER,
  ORG_ROLE.GESTIONNAIRE,
  ORG_ROLE.GUICHETIER,
  ORG_ROLE.PARENT,
] as const;

/** Statements AC — resources métier + presets plugins admin / organization. */
export const accessControlStatements = {
  ...adminPluginSchemaStatements,
  ...organizationPluginSchemaStatements,
  inscription: ["create", "share", "update", "delete"],
  trajet: ["create", "update", "delete", "read"],
  depart: ["create", "update", "cancel", "read"],
  embarquement: ["scan", "update", "read"],
  rapport: ["read"],
  equipe: ["manage", "read"],
  branch: ["create", "update", "delete", "read", "assign"],
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

/**
 * Grille organisation (source de vérité U04).
 * La permission décide ; le slug alimente uniquement cette matrice.
 */
export const organizationRoleStatements: Record<string, StatementShape> = {
  [ORG_ROLE.OWNER]: {
    ...ownerAc.statements,
    inscription: ["create", "share", "update", "delete"],
    trajet: ["create", "update", "delete", "read"],
    depart: ["create", "update", "cancel", "read"],
    embarquement: ["scan", "update", "read"],
    rapport: ["read"],
    equipe: ["manage", "read"],
    branch: ["create", "update", "delete", "read", "assign"],
  },
  [ORG_ROLE.GESTIONNAIRE]: {
    ...organizationPluginMemberAc.statements,
    ...organizationPluginAdminAc.statements,
    // Supervision réservations (pas vente quotidienne → guichetier)
    inscription: ["share", "update"],
    trajet: ["create", "update", "delete", "read"],
    depart: ["create", "update", "cancel", "read"],
    rapport: ["read"],
    equipe: ["manage", "read"],
    branch: ["create", "update", "read", "assign"],
  },
  [ORG_ROLE.GUICHETIER]: {
    ...organizationPluginMemberAc.statements,
    inscription: ["create", "share", "update"],
    depart: ["read"],
    embarquement: ["scan", "update", "read"],
  },
  [ORG_ROLE.PARENT]: { ...organizationPluginMemberAc.statements },
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
