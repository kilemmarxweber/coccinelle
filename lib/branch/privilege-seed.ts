/**
 * Matrice seed des privilèges métier branche.
 * Source de vérité initiale + fallback runtime si DB vide.
 * Ressources = ids DASH_CARD (strings, pas d’import ops-roles).
 */

export const PRIVILEGE_ACTIONS = [
  "VIEW",
  "READ",
  "CREATE",
  "UPDATE",
  "DELETE",
] as const;

export type PrivilegeActionName = (typeof PRIVILEGE_ACTIONS)[number];

const R = {
  CAISSE: "caisse",
  VENTE_RAPIDE: "vente_rapide",
  TAUX_CHANGE: "taux_change",
  SEJOURS: "sejours",
  RESTAURATION: "restauration",
  CUISINE: "cuisine",
  SERVICE_STOCK: "service_stock",
  CHAMBRES: "chambres",
  SALLES: "salles",
  PRODUITS_HOTEL: "produits_hotel",
  LIVRAISON: "livraison",
  BONS_COMMANDE: "bons_commande",
  DEPENSES: "depenses",
  CLIENTS_PARTENAIRES: "clients_partenaires",
  RAPPORT_TABLEAU: "rapport_tableau",
  RAPPORT_VENTES: "rapport_ventes",
  RAPPORT_ACHATS: "rapport_achats",
  RAPPORT_FINANCIER: "rapport_financier",
  RAPPORT_ARTICLES: "rapport_articles",
  RAPPORT_MES_COMMANDES: "rapport_mes_commandes",
  RAPPORT_SEJOURS: "rapport_sejours",
  PARAMETRES: "parametres",
} as const;

/** Ressources éditables dans Paramètres (hospitalité + admin). */
export const PRIVILEGE_RESOURCES = [
  R.CAISSE,
  R.VENTE_RAPIDE,
  R.TAUX_CHANGE,
  R.SEJOURS,
  R.RESTAURATION,
  R.CUISINE,
  R.SERVICE_STOCK,
  R.CHAMBRES,
  R.SALLES,
  R.PRODUITS_HOTEL,
  R.LIVRAISON,
  R.BONS_COMMANDE,
  R.DEPENSES,
  R.CLIENTS_PARTENAIRES,
  R.RAPPORT_TABLEAU,
  R.RAPPORT_VENTES,
  R.RAPPORT_ACHATS,
  R.RAPPORT_FINANCIER,
  R.RAPPORT_ARTICLES,
  R.RAPPORT_MES_COMMANDES,
  R.RAPPORT_SEJOURS,
  R.PARAMETRES,
] as const;

export type PrivilegeResourceId = (typeof PRIVILEGE_RESOURCES)[number];

export const PRIVILEGE_RESOURCE_GROUPS: {
  title: string;
  resources: PrivilegeResourceId[];
}[] = [
  {
    title: "Opérations",
    resources: [
      R.CAISSE,
      R.VENTE_RAPIDE,
      R.TAUX_CHANGE,
      R.SEJOURS,
      R.RESTAURATION,
      R.CUISINE,
      R.CLIENTS_PARTENAIRES,
    ],
  },
  {
    title: "Hébergement & stock",
    resources: [
      R.CHAMBRES,
      R.SALLES,
      R.PRODUITS_HOTEL,
      R.SERVICE_STOCK,
      R.LIVRAISON,
      R.BONS_COMMANDE,
      R.DEPENSES,
    ],
  },
  {
    title: "Rapports",
    resources: [
      R.RAPPORT_TABLEAU,
      R.RAPPORT_VENTES,
      R.RAPPORT_ACHATS,
      R.RAPPORT_FINANCIER,
      R.RAPPORT_ARTICLES,
      R.RAPPORT_MES_COMMANDES,
      R.RAPPORT_SEJOURS,
    ],
  },
  {
    title: "Administration",
    resources: [R.PARAMETRES],
  },
];

export const PRIVILEGE_RESOURCE_LABELS: Record<string, string> = {
  [R.CAISSE]: "Caisse",
  [R.VENTE_RAPIDE]: "Vente rapide",
  [R.TAUX_CHANGE]: "Taux de change",
  [R.SEJOURS]: "Séjours",
  [R.RESTAURATION]: "Restauration",
  [R.CUISINE]: "Cuisine",
  [R.SERVICE_STOCK]: "Service stock",
  [R.CHAMBRES]: "Chambres",
  [R.SALLES]: "Salles de réunion",
  [R.PRODUITS_HOTEL]: "Produits F&B",
  [R.LIVRAISON]: "Livraison",
  [R.BONS_COMMANDE]: "Bons de commande",
  [R.DEPENSES]: "Dépenses",
  [R.CLIENTS_PARTENAIRES]: "Clients partenaires",
  [R.RAPPORT_TABLEAU]: "Tableau de bord",
  [R.RAPPORT_VENTES]: "Rapport ventes",
  [R.RAPPORT_ACHATS]: "Rapport achats",
  [R.RAPPORT_FINANCIER]: "Rapport financier",
  [R.RAPPORT_ARTICLES]: "Rapport articles",
  [R.RAPPORT_MES_COMMANDES]: "Mes commandes",
  [R.RAPPORT_SEJOURS]: "Rapport séjours",
  [R.PARAMETRES]: "Paramètres (rôles)",
};

type ActionsMap = Partial<Record<PrivilegeActionName, true>>;

export type RolePrivilegeSpec = Record<string, ActionsMap>;

export type SeedRoleDef = {
  slug: string;
  label: string;
  description: string;
  sortOrder: number;
  all?: boolean;
  privileges?: RolePrivilegeSpec;
};

function vr(extra?: ActionsMap): ActionsMap {
  return { VIEW: true, READ: true, ...extra };
}

function ops(extra?: ActionsMap): ActionsMap {
  return { VIEW: true, READ: true, CREATE: true, UPDATE: true, ...extra };
}

function full(): ActionsMap {
  return {
    VIEW: true,
    READ: true,
    CREATE: true,
    UPDATE: true,
    DELETE: true,
  };
}

const CAISSIER_SEJOURS: RolePrivilegeSpec = {
  [R.CAISSE]: ops(),
  [R.TAUX_CHANGE]: { VIEW: true, READ: true, UPDATE: true },
  [R.SEJOURS]: { VIEW: true, READ: true, UPDATE: true },
  [R.CHAMBRES]: vr(),
  [R.CLIENTS_PARTENAIRES]: vr(),
  [R.RAPPORT_TABLEAU]: vr(),
  [R.RAPPORT_VENTES]: vr(),
  [R.RAPPORT_SEJOURS]: vr(),
};

const CAISSIER_RESTO: RolePrivilegeSpec = {
  [R.CAISSE]: ops(),
  [R.VENTE_RAPIDE]: ops(),
  [R.TAUX_CHANGE]: { VIEW: true, READ: true, UPDATE: true },
  [R.RESTAURATION]: vr(),
  [R.CUISINE]: { VIEW: true },
  [R.SERVICE_STOCK]: ops(),
  [R.RAPPORT_TABLEAU]: vr(),
  [R.RAPPORT_VENTES]: vr(),
};

const CAISSIER_LEGACY: RolePrivilegeSpec = {
  ...CAISSIER_SEJOURS,
  ...CAISSIER_RESTO,
  [R.CLIENTS_PARTENAIRES]: vr(),
};

const GERANT_SPEC: RolePrivilegeSpec = {
  [R.TAUX_CHANGE]: ops(),
  [R.SEJOURS]: full(),
  [R.CHAMBRES]: full(),
  [R.SALLES]: full(),
  [R.PRODUITS_HOTEL]: full(),
  [R.SERVICE_STOCK]: ops(),
  [R.LIVRAISON]: full(),
  [R.BONS_COMMANDE]: full(),
  [R.DEPENSES]: full(),
  [R.CLIENTS_PARTENAIRES]: full(),
  [R.RAPPORT_TABLEAU]: vr(),
  [R.RAPPORT_VENTES]: vr(),
  [R.RAPPORT_ACHATS]: vr(),
  [R.RAPPORT_FINANCIER]: vr(),
  [R.RAPPORT_ARTICLES]: vr(),
  [R.RAPPORT_SEJOURS]: vr(),
  [R.PARAMETRES]: { VIEW: true, READ: true, UPDATE: true },
};

export const SEED_BRANCH_ROLES: SeedRoleDef[] = [
  {
    slug: "serveur",
    label: "Serveur(euse)",
    description: "Commandes salle et suivi de mes commandes.",
    sortOrder: 10,
    privileges: {
      [R.RESTAURATION]: ops({ DELETE: true }),
      [R.RAPPORT_MES_COMMANDES]: vr(),
    },
  },
  {
    slug: "caissier_sejours",
    label: "Caissier séjours",
    description: "Encaissement hôtel / folios — pas de vente restauration.",
    sortOrder: 20,
    privileges: CAISSIER_SEJOURS,
  },
  {
    slug: "caissier_resto",
    label: "Caissier restauration",
    description: "Encaissement F&B — pas de gestion chambres / séjours.",
    sortOrder: 30,
    privileges: CAISSIER_RESTO,
  },
  {
    slug: "caissier",
    label: "Caissier (legacy)",
    description: "Ancien profil — remplacez par séjours ou resto.",
    sortOrder: 35,
    privileges: CAISSIER_LEGACY,
  },
  {
    slug: "receptionniste",
    label: "Réceptionniste",
    description: "Séjours, chambres et rapport séjours.",
    sortOrder: 40,
    privileges: {
      [R.SEJOURS]: full(),
      [R.CHAMBRES]: full(),
      [R.SALLES]: full(),
      [R.CLIENTS_PARTENAIRES]: full(),
      [R.RAPPORT_TABLEAU]: vr(),
      [R.RAPPORT_SEJOURS]: vr(),
    },
  },
  {
    slug: "manager",
    label: "Manager",
    description: "Pilotage — même matrice que gérant.",
    sortOrder: 50,
    privileges: GERANT_SPEC,
  },
  {
    slug: "gerant",
    label: "Gérant",
    description: "Pilotage, stock, rapports et paramètres rôles.",
    sortOrder: 60,
    privileges: GERANT_SPEC,
  },
  {
    slug: "branch_manager",
    label: "Gérant (legacy)",
    description: "Alias historique de gérant.",
    sortOrder: 65,
    privileges: GERANT_SPEC,
  },
  {
    slug: "proprietaire",
    label: "Propriétaire",
    description: "Accès complet à la branche.",
    sortOrder: 70,
    all: true,
  },
];

export function expandRolePrivileges(
  def: SeedRoleDef,
): { resource: string; action: PrivilegeActionName }[] {
  const rows: { resource: string; action: PrivilegeActionName }[] = [];
  if (def.all) {
    for (const resource of PRIVILEGE_RESOURCES) {
      for (const action of PRIVILEGE_ACTIONS) {
        rows.push({ resource, action });
      }
    }
    return rows;
  }
  for (const [resource, actions] of Object.entries(def.privileges ?? {})) {
    for (const action of PRIVILEGE_ACTIONS) {
      if (actions[action]) rows.push({ resource, action });
    }
  }
  return rows;
}

export function seedViewResourcesForSlug(slug: string): Set<string> | "ALL" {
  const def = SEED_BRANCH_ROLES.find((r) => r.slug === slug);
  if (!def) return new Set();
  if (def.all) return "ALL";
  const set = new Set<string>();
  for (const [resource, actions] of Object.entries(def.privileges ?? {})) {
    if (actions.VIEW) set.add(resource);
  }
  return set;
}

export function seedAllows(
  slug: string,
  resource: string,
  action: PrivilegeActionName,
): boolean {
  const def = SEED_BRANCH_ROLES.find((r) => r.slug === slug);
  if (!def) return false;
  if (def.all) return true;
  return Boolean(def.privileges?.[resource]?.[action]);
}
