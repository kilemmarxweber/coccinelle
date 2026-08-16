/**
 * Slugs de rôles, presets Better Auth (`adminAc`, `ownerAc`, …),
 * grilles métier pour les rôles d’organisation, et AC partagée pour `betterAuth`.
 *
 * Couches :
 * - `User.role` (plateforme) → `admin` | `user` (défaut `user`)
 * - `Member.role` (organisation) → `owner` | `admin` | `user` (défaut `user`)
 * - `BranchMember.role` → métier ops (serveur, caissier_*, …)
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

/** Rôles plateforme (`user.role`) — Better Auth admin plugin. */
export const APP_ROLE = {
  ADMIN: "admin",
  USER: "user",
} as const;

export function isAppAdminRole(role: string | null | undefined): boolean {
  return role === APP_ROLE.ADMIN;
}

/**
 * Rôles d’organisation (`member.role`).
 * Legacy acceptés en lecture : gestionnaire → admin, guichetier|parent|member → user.
 */
export const ORG_ROLE = {
  OWNER: "owner",
  ADMIN: "admin",
  USER: "user",
} as const;

export const ALL_ORG_ROLE_SLUGS = [
  ORG_ROLE.OWNER,
  ORG_ROLE.ADMIN,
  ORG_ROLE.USER,
] as const;

/** Normalise un slug org (y compris legacy) vers owner | admin | user. */
export function normalizeOrgRole(
  raw: string | null | undefined,
): (typeof ALL_ORG_ROLE_SLUGS)[number] {
  const r = (raw ?? "").trim().toLowerCase();
  if (r === ORG_ROLE.OWNER) return ORG_ROLE.OWNER;
  if (r === ORG_ROLE.ADMIN || r === "gestionnaire") return ORG_ROLE.ADMIN;
  if (
    r === ORG_ROLE.USER ||
    r === "guichetier" ||
    r === "parent" ||
    r === "member" ||
    r === ""
  ) {
    return ORG_ROLE.USER;
  }
  return ORG_ROLE.USER;
}

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
 * Grille organisation (source de vérité).
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
  [ORG_ROLE.ADMIN]: {
    ...organizationPluginMemberAc.statements,
    ...organizationPluginAdminAc.statements,
    inscription: ["share", "update", "create"],
    trajet: ["create", "update", "delete", "read"],
    depart: ["create", "update", "cancel", "read"],
    embarquement: ["scan", "update", "read"],
    rapport: ["read"],
    equipe: ["manage", "read"],
    branch: ["create", "update", "read", "assign"],
  },
  [ORG_ROLE.USER]: {
    ...organizationPluginMemberAc.statements,
    inscription: ["create", "share", "update"],
    depart: ["read"],
    embarquement: ["scan", "update", "read"],
  },
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
