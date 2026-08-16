/**
 * Menus du hub branche — 100 % liés aux routes module (pas de #).
 * Carte primaire : « Caisse & Ventes » → hub caisse (puis CTA vente selon type).
 * Commun à tous les types : Taux de change + Rapports.
 */

import type { ComponentType } from "react";
import {
  ArrowLeftRight,
  BedDouble,
  Box,
  ChefHat,
  ClipboardList,
  FileBarChart,
  FileText,
  Globe2,
  LayoutDashboard,
  Package,
  Plane,
  Presentation,
  Receipt,
  ShoppingCart,
  Truck,
  Users,
  UtensilsCrossed,
  Wallet,
} from "lucide-react";
import {
  agenceRoutes,
  boutiqueRoutes,
  branchCaissePath,
  hotelRoutes,
  sharedBranchRoutes,
} from "@/lib/branch/paths";
import { isHospitality } from "@/lib/branch/hospitality";
import { DASH_CARD } from "@/lib/branch/ops-roles";

export type BranchMenuFlags = {
  hasStays?: boolean;
  hasRestaurant?: boolean;
};

export type BranchMenuItem = {
  /** Identifiant stable pour filtrage par rôle ops. */
  id?: string;
  title: string;
  description: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  iconBg: string;
  iconColor: string;
  /** Mise en avant (ex. Caisse & Ventes). */
  primary?: boolean;
};

export type BranchMenuSection = {
  title: string;
  titleColor: string;
  icon: ComponentType<{ className?: string }>;
  iconColor: string;
  items: BranchMenuItem[];
};

function caisseVentesCard(
  organizationId: string,
  branchId: string,
  venteLabel: string,
): BranchMenuItem {
  return {
    id: DASH_CARD.CAISSE,
    title: "Caisse & Ventes",
    description: venteLabel,
    href: branchCaissePath(organizationId, branchId),
    icon: Wallet,
    iconBg: "bg-primary/15",
    iconColor: "text-primary",
    primary: true,
  };
}

function tauxChangeCard(
  organizationId: string,
  branchId: string,
): BranchMenuItem {
  return {
    id: DASH_CARD.TAUX_CHANGE,
    title: "Taux de Change",
    description: "Mise à jour des devises.",
    href: sharedBranchRoutes.tauxChange(organizationId, branchId),
    icon: ArrowLeftRight,
    iconBg: "bg-primary/15",
    iconColor: "text-primary",
  };
}

function bonsCommandeCard(
  organizationId: string,
  branchId: string,
): BranchMenuItem {
  return {
    id: DASH_CARD.BONS_COMMANDE,
    title: "Bons de commande",
    description: "Achats fournisseur, impression et validation caisse.",
    href: sharedBranchRoutes.bonsCommande(organizationId, branchId),
    icon: ClipboardList,
    iconBg: "bg-teal-500/15",
    iconColor: "text-teal-400",
  };
}

function depensesCard(
  organizationId: string,
  branchId: string,
): BranchMenuItem {
  return {
    id: DASH_CARD.DEPENSES,
    title: "Dépenses",
    description: "Sorties de caisse et suivi du solde net.",
    href: sharedBranchRoutes.depenses(organizationId, branchId),
    icon: Receipt,
    iconBg: "bg-rose-500/15",
    iconColor: "text-rose-400",
  };
}

function equipeCard(
  organizationId: string,
  branchId: string,
): BranchMenuItem {
  return {
    id: DASH_CARD.EQUIPE,
    title: "Équipe / Rôles",
    description:
      "Personnel de cet établissement et rôles org (matrice FR, partagés).",
    href: sharedBranchRoutes.equipe(organizationId, branchId),
    icon: Users,
    iconBg: "bg-amber-500/15",
    iconColor: "text-amber-500",
  };
}

/** Sections communes : analyses & rapports (tous BranchType). */
function rapportsSections(
  organizationId: string,
  branchId: string,
  opts?: { includeMesCommandes?: boolean; includeSejoursReport?: boolean },
): BranchMenuSection[] {
  const items: BranchMenuItem[] = [
    {
      id: DASH_CARD.RAPPORT_TABLEAU,
      title: "Tableau de Bord",
      description: "Statistiques et indicateurs clés.",
      href: sharedBranchRoutes.tableauBord(organizationId, branchId),
      icon: LayoutDashboard,
      iconBg: "bg-violet-500/15",
      iconColor: "text-violet-400",
    },
    {
      id: DASH_CARD.RAPPORT_VENTES,
      title: "Rapport Ventes",
      description: "CA, tickets, méthodes — graphs & comparaison.",
      href: sharedBranchRoutes.ventes(organizationId, branchId),
      icon: FileBarChart,
      iconBg: "bg-sky-500/15",
      iconColor: "text-sky-400",
    },
    {
      id: DASH_CARD.RAPPORT_ACHATS,
      title: "Rapport Achats",
      description: "Entrées vs sorties stock — période & deltas.",
      href: sharedBranchRoutes.achats(organizationId, branchId),
      icon: Package,
      iconBg: "bg-primary/15",
      iconColor: "text-primary",
    },
    {
      id: DASH_CARD.RAPPORT_FINANCIER,
      title: "Rapport Financier",
      description: "Revenus croisés aux flux d’appro / décompte.",
      href: sharedBranchRoutes.financier(organizationId, branchId),
      icon: FileText,
      iconBg: "bg-sky-500/15",
      iconColor: "text-sky-400",
    },
    {
      id: DASH_CARD.RAPPORT_ARTICLES,
      title: "Rapport Article",
      description: "Top ventes, catégories et sorties liées.",
      href: sharedBranchRoutes.articles(organizationId, branchId),
      icon: FileBarChart,
      iconBg: "bg-primary/15",
      iconColor: "text-primary",
    },
  ];
  if (opts?.includeMesCommandes) {
    items.push({
      id: DASH_CARD.RAPPORT_MES_COMMANDES,
      title: "Mes commandes",
      description: "Votre activité F&B sur une période — stats & graphs.",
      href: sharedBranchRoutes.mesCommandes(organizationId, branchId),
      icon: UtensilsCrossed,
      iconBg: "bg-violet-500/15",
      iconColor: "text-violet-400",
    });
  }
  if (opts?.includeSejoursReport) {
    items.push({
      id: DASH_CARD.RAPPORT_SEJOURS,
      title: "Rapport séjours",
      description: "Check-in / out, statuts et disponibilités.",
      href: sharedBranchRoutes.rapportSejours(organizationId, branchId),
      icon: BedDouble,
      iconBg: "bg-emerald-500/15",
      iconColor: "text-emerald-400",
    });
  }
  return [
    {
      title: "ANALYSES & RAPPORTS",
      titleColor: "text-teal-400",
      icon: Globe2,
      iconColor: "text-teal-400",
      items,
    },
  ];
}

/**
 * Filtre synchrone par IDs de cartes visibles (sérialisables RSC → client).
 * Cartes sans `id` restent visibles.
 */
export function filterMenuSectionsByVisibleCardIds(
  sections: BranchMenuSection[],
  visibleCardIds: ReadonlySet<string> | readonly string[],
): BranchMenuSection[] {
  const allowed =
    visibleCardIds instanceof Set
      ? visibleCardIds
      : new Set(visibleCardIds);
  return sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        if (!item.id) return true;
        return allowed.has(item.id);
      }),
    }))
    .filter((section) => section.items.length > 0);
}

/**
 * @deprecated R06 — utiliser `filterMenuSectionsByCatalog` (permissions FR).
 * Conservé pour imports legacy ; ne plus appeler depuis le hub.
 */
export function filterMenuSectionsForOpsRole(
  sections: BranchMenuSection[],
  _opsRole?: string,
): BranchMenuSection[] {
  void _opsRole;
  return sections;
}

/** Menu du hub selon BranchType — métier + taux change + rapports. */
export function menuSectionsForBranch(
  organizationId: string,
  branchId: string,
  type: "AGENCE" | "HOTEL" | "BOUTIQUE" | "RESTAURANT" | string,
  flags: BranchMenuFlags = {},
): BranchMenuSection[] {
  const hasStays = flags.hasStays ?? type === "HOTEL";
  const hasRestaurant =
    flags.hasRestaurant ?? (type === "HOTEL" || type === "RESTAURANT");
  const shared = rapportsSections(organizationId, branchId, {
    includeMesCommandes: hasRestaurant,
    includeSejoursReport: hasStays,
  });

  if (isHospitality(type)) {
    const dailyItems: BranchMenuItem[] = [
      caisseVentesCard(
        organizationId,
        branchId,
        hasStays && hasRestaurant
          ? "Ouvrir la caisse et encaisser séjours / F&B."
          : hasStays
            ? "Ouvrir la caisse et encaisser les séjours."
            : "Ouvrir la caisse et encaisser la restauration.",
      ),
    ];
    if (hasStays) {
      dailyItems.push(
        {
          id: DASH_CARD.SEJOURS,
          title: "Séjours",
          description: "Réservations, check-in / check-out.",
          href: hotelRoutes.sejours(organizationId, branchId),
          icon: ClipboardList,
          iconBg: "bg-emerald-500/15",
          iconColor: "text-emerald-400",
        },
        {
          id: DASH_CARD.CLIENTS_PARTENAIRES,
          title: "Clients partenaires",
          description: "Sociétés — coordonnées et dossiers.",
          href: hotelRoutes.partenaires(organizationId, branchId),
          icon: Users,
          iconBg: "bg-violet-500/15",
          iconColor: "text-violet-400",
        },
      );
    }
    if (hasRestaurant) {
      dailyItems.push(
        {
          id: DASH_CARD.RESTAURATION,
          title: "Restauration",
          description: "Commandes F&B et additions.",
          href: hotelRoutes.restauration(organizationId, branchId),
          icon: UtensilsCrossed,
          iconBg: "bg-violet-500/15",
          iconColor: "text-violet-400",
        },
        {
          id: DASH_CARD.CUISINE,
          title: "Cuisine",
          description: "File de préparation — marquer prêt.",
          href: hotelRoutes.cuisine(organizationId, branchId),
          icon: ChefHat,
          iconBg: "bg-orange-500/15",
          iconColor: "text-orange-400",
        },
      );
    }
    dailyItems.push(tauxChangeCard(organizationId, branchId));
    dailyItems.push(bonsCommandeCard(organizationId, branchId));
    dailyItems.push(depensesCard(organizationId, branchId));
    dailyItems.push(equipeCard(organizationId, branchId));

    const stockItems: BranchMenuItem[] = [];
    if (hasStays) {
      stockItems.push(
        {
          id: DASH_CARD.CHAMBRES,
          title: "Chambres",
          description: "Types, inventaire et statuts.",
          href: hotelRoutes.chambres(organizationId, branchId),
          icon: BedDouble,
          iconBg: "bg-sky-500/15",
          iconColor: "text-sky-400",
        },
        {
          id: DASH_CARD.SALLES,
          title: "Salles de réunion",
          description: "Salles, capacité et réservations.",
          href: hotelRoutes.sallesReunion(organizationId, branchId),
          icon: Presentation,
          iconBg: "bg-indigo-500/15",
          iconColor: "text-indigo-400",
        },
      );
    }
    if (hasRestaurant) {
      stockItems.push(
        {
          id: DASH_CARD.PRODUITS_HOTEL,
          title: "Produits",
          description: "Carte F&B, photos, stock et cuisine.",
          href: hotelRoutes.produits(organizationId, branchId),
          icon: Package,
          iconBg: "bg-sky-500/15",
          iconColor: "text-sky-400",
        },
        {
          id: DASH_CARD.SERVICE_STOCK,
          title: "Service stock",
          description: "Float vendeur — ouverture, réassort, clôture signée.",
          href: hotelRoutes.serviceStock(organizationId, branchId),
          icon: ClipboardList,
          iconBg: "bg-amber-500/15",
          iconColor: "text-amber-500",
        },
      );
    }
    stockItems.push({
      id: DASH_CARD.LIVRAISON,
      title: "Livraison",
      description: "Consommables — entrées et décompte stock.",
      href: hotelRoutes.livraison(organizationId, branchId),
      icon: Truck,
      iconBg: "bg-sky-500/15",
      iconColor: "text-sky-400",
    });

    return [
      {
        title: "OPÉRATIONS AU QUOTIDIEN",
        titleColor: "text-emerald-400",
        icon: Wallet,
        iconColor: "text-emerald-400",
        items: dailyItems,
      },
      {
        title:
          hasStays && !hasRestaurant
            ? "HÉBERGEMENT"
            : hasRestaurant && !hasStays
              ? "RESTAURANT & STOCK"
              : "HÉBERGEMENT & STOCK",
        titleColor: "text-sky-400",
        icon: hasStays ? BedDouble : UtensilsCrossed,
        iconColor: "text-sky-400",
        items: stockItems,
      },
      ...shared,
    ];
  }

  if (type === "BOUTIQUE") {
    return [
      {
        title: "OPÉRATIONS, CATALOGUE & STOCK",
        titleColor: "text-emerald-400",
        icon: ShoppingCart,
        iconColor: "text-emerald-400",
        items: [
          {
            id: DASH_CARD.POS,
            title: "Point de vente",
            description: "Panier rapide, tickets en attente et encaissement.",
            href: boutiqueRoutes.pos(organizationId, branchId),
            icon: ShoppingCart,
            iconBg: "bg-emerald-500/15",
            iconColor: "text-emerald-400",
            primary: true,
          },
          tauxChangeCard(organizationId, branchId),
          bonsCommandeCard(organizationId, branchId),
          depensesCard(organizationId, branchId),
          equipeCard(organizationId, branchId),
          {
            id: DASH_CARD.BOUTIQUE_PRODUITS,
            title: "Produits",
            description: "Articles, plats, prix et promotions.",
            href: boutiqueRoutes.produits(organizationId, branchId),
            icon: Box,
            iconBg: "bg-violet-500/15",
            iconColor: "text-violet-400",
          },
          {
            id: DASH_CARD.BOUTIQUE_STOCK,
            title: "Stock",
            description: "Niveaux et mouvements.",
            href: boutiqueRoutes.stock(organizationId, branchId),
            icon: Package,
            iconBg: "bg-sky-500/15",
            iconColor: "text-sky-400",
          },
        ],
      },
      ...rapportsSections(organizationId, branchId),
    ];
  }

  // AGENCE
  return [
    {
      title: "OPÉRATIONS AU QUOTIDIEN",
      titleColor: "text-emerald-400",
      icon: Wallet,
      iconColor: "text-emerald-400",
      items: [
        caisseVentesCard(
          organizationId,
          branchId,
          "Ouvrir la caisse et vendre des billets au guichet.",
        ),
        {
          id: DASH_CARD.GUICHET,
          title: "Guichet",
          description: "Vendre un billet au comptoir.",
          href: agenceRoutes.guichet(organizationId, branchId),
          icon: ShoppingCart,
          iconBg: "bg-emerald-500/15",
          iconColor: "text-emerald-400",
        },
        {
          id: DASH_CARD.RESERVATIONS,
          title: "Réservations",
          description: "Liste et suivi des dossiers.",
          href: agenceRoutes.reservations(organizationId, branchId),
          icon: ClipboardList,
          iconBg: "bg-violet-500/15",
          iconColor: "text-violet-400",
        },
        {
          id: DASH_CARD.CLIENTS,
          title: "Clients partenaires",
          description: "Sociétés & clients — coordonnées.",
          href: agenceRoutes.clients(organizationId, branchId),
          icon: Users,
          iconBg: "bg-violet-500/15",
          iconColor: "text-violet-400",
        },
        tauxChangeCard(organizationId, branchId),
        bonsCommandeCard(organizationId, branchId),
        depensesCard(organizationId, branchId),
        equipeCard(organizationId, branchId),
      ],
    },
    {
      title: "EXPLOITATION VOYAGE",
      titleColor: "text-sky-400",
      icon: Plane,
      iconColor: "text-sky-400",
      items: [
        {
          id: DASH_CARD.TRAJETS,
          title: "Trajets",
          description: "Lignes et tarifs de la branche.",
          href: agenceRoutes.trajets(organizationId, branchId),
          icon: Plane,
          iconBg: "bg-sky-500/15",
          iconColor: "text-sky-400",
        },
        {
          id: DASH_CARD.COLIS,
          title: "Colis",
          description: "Expéditions et livraisons.",
          href: agenceRoutes.colis(organizationId, branchId),
          icon: Package,
          iconBg: "bg-primary/15",
          iconColor: "text-primary",
        },
        {
          id: DASH_CARD.EMBARQUEMENT,
          title: "Embarquement",
          description: "Scan QR et passages.",
          href: agenceRoutes.passages(organizationId, branchId),
          icon: Users,
          iconBg: "bg-rose-500/15",
          iconColor: "text-rose-400",
        },
      ],
    },
    ...rapportsSections(organizationId, branchId),
  ];
}

/** URL de la surface « Effectuer une vente » selon le type. */
export function ventePathForBranchType(
  organizationId: string,
  branchId: string,
  type: "AGENCE" | "HOTEL" | "BOUTIQUE" | "RESTAURANT" | string,
  flags: BranchMenuFlags = {},
): { href: string; label: string; description: string } {
  if (isHospitality(type)) {
    const hasStays = flags.hasStays ?? type === "HOTEL";
    const hasRestaurant =
      flags.hasRestaurant ?? (type === "HOTEL" || type === "RESTAURANT");
    if (hasStays) {
      return {
        href: hotelRoutes.sejours(organizationId, branchId),
        label: "Encaisser un séjour",
        description: "Ouvrir les séjours pour check-in et encaissement.",
      };
    }
    if (hasRestaurant) {
      return {
        href: hotelRoutes.restauration(organizationId, branchId),
        label: "Nouvelle commande F&B",
        description: "Ouvrir la restauration pour prendre une commande.",
      };
    }
    return {
      href: branchCaissePath(organizationId, branchId),
      label: "Ouvrir la caisse",
      description: "Encaisser depuis la caisse.",
    };
  }
  if (type === "BOUTIQUE") {
    return {
      href: boutiqueRoutes.pos(organizationId, branchId),
      label: "Nouvelle vente POS",
      description: "Ouvrir le point de vente pour encaisser un ticket.",
    };
  }
  return {
    href: agenceRoutes.guichet(organizationId, branchId),
    label: "Vendre un billet",
    description: "Ouvrir le guichet pour une vente comptoir.",
  };
}
