/**
 * Libellés UI FR pour le catalogue de permissions (R01).
 * Format produit : `Ressource · Action`.
 *
 * Mapping consulté avec MCP Better Auth (organization / DAC / createAccessControl) :
 * les ressources plugin BA (`organization`, `member`, `invitation`, `ac`) gardent
 * les actions ASCII du plugin ; l’UI les affiche en français.
 */

import {
  ORGANIZATION_PRODUCT_CATALOG,
  type OrganizationProductAction,
  type OrganizationProductResource,
} from "@/lib/permissions";

/** Libellés des ressources du catalogue produit (99). */
export const RESOURCE_LABEL_FR: Record<OrganizationProductResource, string> = {
  organization: "Organisation",
  member: "Membre",
  invitation: "Invitation",
  ac: "Contrôle d’accès",
  equipe: "Équipe",
  branch: "Branche",
  inscription: "Inscription",
  trajet: "Trajet",
  depart: "Départ",
  embarquement: "Embarquement",
  colis: "Colis",
  clients_agence: "Clients agence",
  rapport_agence: "Rapport agence",
  caisse: "Caisse",
  taux_change: "Taux de change",
  sejours: "Séjours",
  restauration: "Restauration",
  cuisine: "Cuisine",
  service_stock: "Service stock",
  chambres: "Chambres",
  salles: "Salles",
  produits_hotel: "Produits hôtel",
  livraison: "Livraison",
  bons_commande: "Bons de commande",
  depenses: "Dépenses",
  partenaires: "Partenaires",
  rapport_tableau: "Rapport tableau de bord",
  rapport_ventes: "Rapport ventes",
  rapport_achats: "Rapport achats",
  rapport_financier: "Rapport financier",
  rapport_articles: "Rapport articles",
  rapport_mes_commandes: "Rapport mes commandes",
  rapport_sejours: "Rapport séjours",
  boutique_pos: "Boutique POS",
  boutique_produits: "Boutique produits",
  boutique_stock: "Boutique stock",
};

/**
 * Libellés des actions (verbes FR + actions BA mappées).
 * Clés code = slugs ASCII utilisés dans `accessControlStatements`.
 */
export const ACTION_LABEL_FR: Record<string, string> = {
  // Verbes métier FR
  voir: "Voir",
  ajouter: "Ajouter",
  modifier: "Modifier",
  supprimer: "Supprimer",
  partager: "Partager",
  scanner: "Scanner",
  annuler: "Annuler",
  gerer: "Gérer",
  assigner: "Assigner",
  ouvrir: "Ouvrir",
  fermer: "Fermer",
  encaisser: "Encaisser",
  // Actions Better Auth (plugin organization) → libellés FR
  create: "Ajouter",
  read: "Voir",
  update: "Modifier",
  delete: "Supprimer",
  cancel: "Annuler",
};

export type CatalogPermissionEntry = {
  resource: OrganizationProductResource;
  action: OrganizationProductAction;
  label: string;
};

/** Les 99 permissions produit : `Ressource · Action`. */
export const CATALOG_PERMISSIONS_FR: readonly CatalogPermissionEntry[] =
  ORGANIZATION_PRODUCT_CATALOG.flatMap(([resource, actions]) =>
    actions.map((action) => ({
      resource,
      action,
      label: permissionLabelFr(resource, action),
    })),
  );

export function resourceLabelFr(resource: string): string {
  return (
    RESOURCE_LABEL_FR[resource as OrganizationProductResource] ?? resource
  );
}

export function actionLabelFr(action: string): string {
  return ACTION_LABEL_FR[action] ?? action;
}

/** Libellé UI `Ressource · Action`. */
export function permissionLabelFr(resource: string, action: string): string {
  return `${resourceLabelFr(resource)} · ${actionLabelFr(action)}`;
}
