/**
 * Slugs de rôles, presets Better Auth (`adminAc`, `ownerAc`, …),
 * catalogue permissions produit FR (99), et AC partagée pour `betterAuth`.
 *
 * R01 — Catalogue FR : actions métier en verbes ASCII FR
 * (`voir`, `ajouter`, `ouvrir`, `fermer`, `encaisser`, …).
 * Ressources plugin BA (`organization`, `member`, `invitation`, `ac`) :
 * actions officielles du plugin (create/read/update/…) ; libellés UI FR
 * dans `lib/permission-labels-fr.ts`.
 *
 * MCP Better Auth consulté (organization · Dynamic Access Control /
 * createAccessControl) avant édition des statements.
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
  /** Presets DAC (R02) */
  CAISSIER: "caissier",
  SERVEUR: "serveur",
  RECEPTIONNISTE: "receptionniste",
  GERANT: "gerant",
  GUICHETIER: "guichetier",
  CLIENT: "client",
  /** @deprecated R02 — migrer vers `gerant` */
  GESTIONNAIRE: "gestionnaire",
  /** @deprecated R02 — migrer vers `client` */
  PARENT: "parent",
} as const;

/** Slugs assignables UI / catalogue (owner + presets DAC). */
export const ALL_ORG_ROLE_SLUGS = [
  ORG_ROLE.OWNER,
  ORG_ROLE.CAISSIER,
  ORG_ROLE.SERVEUR,
  ORG_ROLE.RECEPTIONNISTE,
  ORG_ROLE.GERANT,
  ORG_ROLE.GUICHETIER,
  ORG_ROLE.CLIENT,
] as const;

/**
 * Ressources métier (agence / hôtel / boutique / équipe) + actions FR.
 * Hors presets plugin BA (`organization`, `member`, `invitation`, `ac`, `team`).
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
  // Boutique
  boutique_pos: ["voir", "ajouter", "modifier"],
  boutique_produits: ["voir", "ajouter", "modifier", "supprimer"],
  boutique_stock: ["voir", "ajouter", "modifier"],
} as const;

/**
 * Catalogue produit (99) : presets BA org/member/invitation/ac + métier FR.
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

/** Entrées ordonnées du catalogue produit (source de vérité count = 99). */
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

/** Statements AC — admin plugin + organization plugin + métier FR. */
export const accessControlStatements = {
  ...adminPluginSchemaStatements,
  ...organizationPluginSchemaStatements,
  ...businessAccessControlStatements,
} as const;

type StatementShape = {
  [K in keyof typeof accessControlStatements]?: ReadonlyArray<
    (typeof accessControlStatements)[K][number]
  >;
};

/** Owner = presets `ownerAc` + catalogue métier entier. */
export const ownerOrganizationStatements = {
  ...ownerAc.statements,
  ...businessAccessControlStatements,
} as const satisfies StatementShape;

/** Preset plugin Admin (`adminAc`) + même niveau organisation que `organization.adminAc`. */
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
 * Grille organisation figée (compat lecture U04 / gérant / guichetier).
 * @deprecated Ne plus traiter comme seule source d’autorité — les customs
 * DAC (OrganizationRole) arrivent en R02. Conserver pour repli statique.
 */
export const organizationRoleStatements: Record<string, StatementShape> = {
  [ORG_ROLE.OWNER]: { ...ownerOrganizationStatements },
  [ORG_ROLE.GESTIONNAIRE]: {
    ...organizationPluginMemberAc.statements,
    ...organizationPluginAdminAc.statements,
    // Supervision réservations (pas vente quotidienne → guichetier)
    inscription: ["partager", "modifier"],
    trajet: ["voir", "ajouter", "modifier", "supprimer"],
    depart: ["voir", "ajouter", "modifier", "annuler"],
    rapport_agence: ["voir"],
    equipe: ["voir", "gerer"],
    branch: ["voir", "ajouter", "modifier", "assigner"],
  },
  [ORG_ROLE.GUICHETIER]: {
    ...organizationPluginMemberAc.statements,
    inscription: ["ajouter", "partager", "modifier"],
    depart: ["voir"],
    embarquement: ["voir", "scanner", "modifier"],
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

/** Rôles plugin `admin` : `Record<slug, Role>` attendu par better-auth. */
export const applicationRoles = rolesFromStatements(applicationRoleStatements);

/** Rôles plugin `organization` : même forme que `applicationRoles`. */
export const organizationRoles = rolesFromStatements(organizationRoleStatements);

export { authAccessControl };
