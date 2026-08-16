/**
 * Presets OrganizationRole (R02) — templates seedés en DAC, pas des rôles
 * runtime figés dans `organizationRoles` (sauf compat U04 pour guichetier).
 *
 * MCP Better Auth : `createOrgRole` stocke `permission` en JSON
 * (`Record<string, string[]>`). Owner reste `creatorRole` système — hors presets.
 */

import { businessAccessControlStatements } from "@/lib/permissions";

export const ORG_ROLE_PRESET = {
  CAISSIER: "caissier",
  SERVEUR: "serveur",
  RECEPTIONNISTE: "receptionniste",
  GERANT: "gerant",
  GUICHETIER: "guichetier",
  CLIENT: "client",
} as const;

export type OrgRolePresetSlug =
  (typeof ORG_ROLE_PRESET)[keyof typeof ORG_ROLE_PRESET];

export const ORG_ROLE_PRESET_SLUGS = [
  ORG_ROLE_PRESET.CAISSIER,
  ORG_ROLE_PRESET.SERVEUR,
  ORG_ROLE_PRESET.RECEPTIONNISTE,
  ORG_ROLE_PRESET.GERANT,
  ORG_ROLE_PRESET.GUICHETIER,
  ORG_ROLE_PRESET.CLIENT,
] as const satisfies readonly OrgRolePresetSlug[];

export type OrgRolePermissionMap = Record<string, readonly string[]>;

const B = businessAccessControlStatements;

/** Hôtel complet sauf Caisse / Restauration / Cuisine / Rapport mes commandes. */
const GERANT_PERMISSIONS: OrgRolePermissionMap = {
  taux_change: [...B.taux_change],
  sejours: [...B.sejours],
  service_stock: [...B.service_stock],
  chambres: [...B.chambres],
  salles: [...B.salles],
  produits_hotel: [...B.produits_hotel],
  livraison: [...B.livraison],
  bons_commande: [...B.bons_commande],
  depenses: [...B.depenses],
  partenaires: [...B.partenaires],
  rapport_tableau: [...B.rapport_tableau],
  rapport_ventes: [...B.rapport_ventes],
  rapport_achats: [...B.rapport_achats],
  rapport_financier: [...B.rapport_financier],
  rapport_articles: [...B.rapport_articles],
  rapport_sejours: [...B.rapport_sejours],
};

/**
 * Permissions seedées par preset (source de vérité R02).
 * `client` = aucune (hors back-office).
 */
export const ORG_ROLE_PRESET_PERMISSIONS: Record<
  OrgRolePresetSlug,
  OrgRolePermissionMap
> = {
  [ORG_ROLE_PRESET.CAISSIER]: {
    caisse: [...B.caisse],
    taux_change: [...B.taux_change],
    restauration: [...B.restauration],
    cuisine: [...B.cuisine],
    sejours: [...B.sejours],
    partenaires: [...B.partenaires],
    service_stock: [...B.service_stock],
    rapport_tableau: [...B.rapport_tableau],
    rapport_ventes: [...B.rapport_ventes],
  },
  [ORG_ROLE_PRESET.SERVEUR]: {
    restauration: [...B.restauration],
    rapport_mes_commandes: [...B.rapport_mes_commandes],
  },
  [ORG_ROLE_PRESET.RECEPTIONNISTE]: {
    sejours: [...B.sejours],
    chambres: [...B.chambres],
    partenaires: [...B.partenaires],
    rapport_tableau: [...B.rapport_tableau],
    rapport_sejours: [...B.rapport_sejours],
  },
  [ORG_ROLE_PRESET.GERANT]: GERANT_PERMISSIONS,
  [ORG_ROLE_PRESET.GUICHETIER]: {
    inscription: ["voir", "ajouter", "modifier", "partager"],
    depart: ["voir"],
    embarquement: [...B.embarquement],
    colis: [...B.colis],
  },
  [ORG_ROLE_PRESET.CLIENT]: {},
};

export const ORG_ROLE_PRESET_LABEL_FR: Record<OrgRolePresetSlug, string> = {
  [ORG_ROLE_PRESET.CAISSIER]: "Caissier(ère)",
  [ORG_ROLE_PRESET.SERVEUR]: "Serveur(euse)",
  [ORG_ROLE_PRESET.RECEPTIONNISTE]: "Réceptionniste",
  [ORG_ROLE_PRESET.GERANT]: "Gérant",
  [ORG_ROLE_PRESET.GUICHETIER]: "Guichetier",
  [ORG_ROLE_PRESET.CLIENT]: "Client",
};

/** Anciens slugs Member → presets custom. Owner jamais mappé. */
export const LEGACY_MEMBER_ROLE_TO_PRESET: Record<string, OrgRolePresetSlug> = {
  gestionnaire: ORG_ROLE_PRESET.GERANT,
  parent: ORG_ROLE_PRESET.CLIENT,
};

/**
 * BranchMember.role (ops) → preset org quand pertinent.
 * `proprietaire` n’est pas mappé (reste owner côté Member).
 */
export const BRANCH_OPS_ROLE_TO_PRESET: Record<string, OrgRolePresetSlug> = {
  serveur: ORG_ROLE_PRESET.SERVEUR,
  caissier: ORG_ROLE_PRESET.CAISSIER,
  receptionniste: ORG_ROLE_PRESET.RECEPTIONNISTE,
  gerant: ORG_ROLE_PRESET.GERANT,
  manager: ORG_ROLE_PRESET.GERANT,
  branch_manager: ORG_ROLE_PRESET.GERANT,
};

export function isOrgRolePresetSlug(value: string): value is OrgRolePresetSlug {
  return (ORG_ROLE_PRESET_SLUGS as readonly string[]).includes(value);
}

/** JSON aligné Better Auth `createOrgRole` (`permission` stringifié). */
export function serializeOrgRolePermission(
  permissions: OrgRolePermissionMap,
): string {
  const mutable: Record<string, string[]> = {};
  for (const [resource, actions] of Object.entries(permissions)) {
    mutable[resource] = [...actions];
  }
  return JSON.stringify(mutable);
}
