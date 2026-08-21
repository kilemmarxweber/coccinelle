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

/**
 * Ressources métier (agence / hôtel / boutique / équipe) + actions FR.
 * Utilisé par les presets DAC (`role-presets`) et le catalogue produit —
 * distinct de `accessControlStatements` (actions ASCII Better Auth).
 */
export const businessAccessControlStatements = {
  equipe: ["voir", "gerer"],
  branch: ["voir", "ajouter", "modifier", "supprimer", "assigner"],
  // Agence
  inscription: ["voir", "ajouter", "modifier", "supprimer", "partager"],
  trajet: ["voir", "ajouter", "modifier", "supprimer"],
  depart: ["voir", "ajouter", "modifier", "annuler"],
  embarquement: ["voir", "scanner", "modifier"],
  colis: ["voir", "ajouter", "modifier"],
  clients_agence: ["voir", "ajouter", "modifier"],
  rapport_agence: ["voir"],
  // Hôtel / restaurant
  caisse: ["voir", "ouvrir", "fermer", "encaisser", "modifier"],
  taux_change: ["voir", "modifier"],
  sejours: ["voir", "ajouter", "modifier", "supprimer"],
  restauration: ["voir", "ajouter", "modifier"],
  cuisine: ["voir", "modifier"],
  service_stock: ["voir", "ouvrir", "fermer", "modifier"],
  chambres: ["voir", "ajouter", "modifier"],
  salles: ["voir", "ajouter", "modifier"],
  produits_hotel: ["voir", "ajouter", "modifier"],
  livraison: ["voir", "ajouter", "modifier"],
  bons_commande: ["voir", "ajouter", "modifier"],
  depenses: ["voir", "ajouter", "modifier"],
  partenaires: ["voir", "ajouter", "modifier"],
  rapport_tableau: ["voir"],
  rapport_ventes: ["voir"],
  rapport_achats: ["voir"],
  rapport_financier: ["voir"],
  rapport_articles: ["voir"],
  rapport_mes_commandes: ["voir"],
  rapport_sejours: ["voir"],
  paie: ["voir", "pointer", "gerer", "verser"],
  // Boutique
  boutique_pos: ["voir", "ajouter", "modifier"],
  boutique_produits: ["voir", "ajouter", "modifier", "supprimer"],
  boutique_stock: ["voir", "ajouter", "modifier"],
} as const;

/**
 * Catalogue produit : presets BA org/member/invitation/ac + métier FR.
 * `team` (défaut BA) est hors catalogue produit.
 */
export const organizationProductStatements = {
  organization: organizationPluginSchemaStatements.organization,
  member: organizationPluginSchemaStatements.member,
  invitation: organizationPluginSchemaStatements.invitation,
  ac: organizationPluginSchemaStatements.ac,
  ...businessAccessControlStatements,
} as const;

export type OrganizationProductResource =
  keyof typeof organizationProductStatements;

export type OrganizationProductAction =
  (typeof organizationProductStatements)[OrganizationProductResource][number];

/** Entrées ordonnées du catalogue produit. */
export const ORGANIZATION_PRODUCT_CATALOG = Object.entries(
  organizationProductStatements,
) as Array<
  [OrganizationProductResource, readonly OrganizationProductAction[]]
>;

export function countOrganizationProductPermissions(): number {
  return ORGANIZATION_PRODUCT_CATALOG.reduce(
    (n, [, actions]) => n + actions.length,
    0,
  );
}

/** Owner métier = presets `ownerAc` + catalogue FR entier (UI rôles / DAC). */
export const ownerOrganizationStatements = {
  ...ownerAc.statements,
  ...businessAccessControlStatements,
} as const;

/**
 * Statements AC Better Auth — resources métier ASCII + presets plugins.
 * Ne pas fusionner avec `businessAccessControlStatements` (verbes FR).
 */
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
