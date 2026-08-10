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

export type BranchMenuFlags = {
  hasStays?: boolean;
  hasRestaurant?: boolean;
};

export type BranchMenuItem = {
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
    title: "Taux de Change",
    description: "Mise à jour des devises.",
    href: sharedBranchRoutes.tauxChange(organizationId, branchId),
    icon: ArrowLeftRight,
    iconBg: "bg-primary/15",
    iconColor: "text-primary",
  };
}

/** Sections communes : analyses & rapports (tous BranchType). */
function rapportsSections(
  organizationId: string,
  branchId: string,
): BranchMenuSection[] {
  return [
    {
      title: "ANALYSES & RAPPORTS",
      titleColor: "text-teal-400",
      icon: Globe2,
      iconColor: "text-teal-400",
      items: [
        {
          title: "Tableau de Bord",
          description: "Statistiques et indicateurs clés.",
          href: sharedBranchRoutes.tableauBord(organizationId, branchId),
          icon: LayoutDashboard,
          iconBg: "bg-violet-500/15",
          iconColor: "text-violet-400",
        },
        {
          title: "Rapport Ventes",
          description: "CA, tickets, méthodes — graphs & comparaison.",
          href: sharedBranchRoutes.ventes(organizationId, branchId),
          icon: FileBarChart,
          iconBg: "bg-sky-500/15",
          iconColor: "text-sky-400",
        },
        {
          title: "Rapport Achats",
          description: "Entrées vs sorties stock — période & deltas.",
          href: sharedBranchRoutes.achats(organizationId, branchId),
          icon: Package,
          iconBg: "bg-primary/15",
          iconColor: "text-primary",
        },
        {
          title: "Rapport Financier",
          description: "Revenus croisés aux flux d’appro / décompte.",
          href: sharedBranchRoutes.financier(organizationId, branchId),
          icon: FileText,
          iconBg: "bg-sky-500/15",
          iconColor: "text-sky-400",
        },
        {
          title: "Rapport Article",
          description: "Top ventes, catégories et sorties liées.",
          href: sharedBranchRoutes.articles(organizationId, branchId),
          icon: FileBarChart,
          iconBg: "bg-primary/15",
          iconColor: "text-primary",
        },
      ],
    },
  ];
}

/** Menu du hub selon BranchType — métier + taux change + rapports. */
export function menuSectionsForBranch(
  organizationId: string,
  branchId: string,
  type: "AGENCE" | "HOTEL" | "BOUTIQUE" | "RESTAURANT" | string,
  flags: BranchMenuFlags = {},
): BranchMenuSection[] {
  const shared = rapportsSections(organizationId, branchId);
  const hasStays = flags.hasStays ?? type === "HOTEL";
  const hasRestaurant =
    flags.hasRestaurant ?? (type === "HOTEL" || type === "RESTAURANT");

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
      dailyItems.push({
        title: "Séjours",
        description: "Réservations, check-in / check-out.",
        href: hotelRoutes.sejours(organizationId, branchId),
        icon: ClipboardList,
        iconBg: "bg-emerald-500/15",
        iconColor: "text-emerald-400",
      });
    }
    if (hasRestaurant) {
      dailyItems.push(
        {
          title: "Restauration",
          description: "Commandes F&B et additions.",
          href: hotelRoutes.restauration(organizationId, branchId),
          icon: UtensilsCrossed,
          iconBg: "bg-violet-500/15",
          iconColor: "text-violet-400",
        },
        {
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

    const stockItems: BranchMenuItem[] = [];
    if (hasStays) {
      stockItems.push({
        title: "Chambres",
        description: "Types, inventaire et statuts.",
        href: hotelRoutes.chambres(organizationId, branchId),
        icon: BedDouble,
        iconBg: "bg-sky-500/15",
        iconColor: "text-sky-400",
      });
    }
    if (hasRestaurant) {
      stockItems.push({
        title: "Produits",
        description: "Carte F&B, photos, stock et cuisine.",
        href: hotelRoutes.produits(organizationId, branchId),
        icon: Package,
        iconBg: "bg-sky-500/15",
        iconColor: "text-sky-400",
      });
    }
    stockItems.push({
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
        title: hasStays && !hasRestaurant ? "HÉBERGEMENT" : hasRestaurant && !hasStays ? "RESTAURANT & STOCK" : "HÉBERGEMENT & STOCK",
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
        title: "OPÉRATIONS AU QUOTIDIEN",
        titleColor: "text-emerald-400",
        icon: Wallet,
        iconColor: "text-emerald-400",
        items: [
          caisseVentesCard(
            organizationId,
            branchId,
            "Ouvrir la caisse et encaisser au point de vente.",
          ),
          {
            title: "Point de vente",
            description: "Panier, ticket et remises.",
            href: boutiqueRoutes.pos(organizationId, branchId),
            icon: ShoppingCart,
            iconBg: "bg-emerald-500/15",
            iconColor: "text-emerald-400",
          },
          tauxChangeCard(organizationId, branchId),
        ],
      },
      {
        title: "CATALOGUE & STOCK",
        titleColor: "text-sky-400",
        icon: Box,
        iconColor: "text-sky-400",
        items: [
          {
            title: "Produits",
            description: "Catalogue et prix.",
            href: boutiqueRoutes.produits(organizationId, branchId),
            icon: Box,
            iconBg: "bg-violet-500/15",
            iconColor: "text-violet-400",
          },
          {
            title: "Stock",
            description: "Niveaux et mouvements.",
            href: boutiqueRoutes.stock(organizationId, branchId),
            icon: Package,
            iconBg: "bg-sky-500/15",
            iconColor: "text-sky-400",
          },
        ],
      },
      ...shared,
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
          title: "Guichet",
          description: "Vendre un billet au comptoir.",
          href: agenceRoutes.guichet(organizationId, branchId),
          icon: ShoppingCart,
          iconBg: "bg-emerald-500/15",
          iconColor: "text-emerald-400",
        },
        {
          title: "Réservations",
          description: "Liste et suivi des dossiers.",
          href: agenceRoutes.reservations(organizationId, branchId),
          icon: ClipboardList,
          iconBg: "bg-violet-500/15",
          iconColor: "text-violet-400",
        },
        {
          title: "Clients",
          description: "Portefeuille voyageurs.",
          href: agenceRoutes.clients(organizationId, branchId),
          icon: Users,
          iconBg: "bg-violet-500/15",
          iconColor: "text-violet-400",
        },
        tauxChangeCard(organizationId, branchId),
      ],
    },
    {
      title: "EXPLOITATION VOYAGE",
      titleColor: "text-sky-400",
      icon: Plane,
      iconColor: "text-sky-400",
      items: [
        {
          title: "Trajets",
          description: "Lignes et tarifs de la branche.",
          href: agenceRoutes.trajets(organizationId, branchId),
          icon: Plane,
          iconBg: "bg-sky-500/15",
          iconColor: "text-sky-400",
        },
        {
          title: "Colis",
          description: "Expéditions et livraisons.",
          href: agenceRoutes.colis(organizationId, branchId),
          icon: Package,
          iconBg: "bg-primary/15",
          iconColor: "text-primary",
        },
        {
          title: "Embarquement",
          description: "Scan QR et passages.",
          href: agenceRoutes.passages(organizationId, branchId),
          icon: Users,
          iconBg: "bg-rose-500/15",
          iconColor: "text-rose-400",
        },
      ],
    },
    ...shared,
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
