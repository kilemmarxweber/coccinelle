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
    description: "Mettre à jour le taux dollar / franc.",
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
    title: "Bons de commande",
    description: "Commander chez un fournisseur puis valider à la caisse.",
    href: sharedBranchRoutes.bonsCommande(organizationId, branchId),
    icon: ClipboardList,
    iconBg: "bg-primary/15",
    iconColor: "text-primary",
  };
}

function depensesCard(
  organizationId: string,
  branchId: string,
): BranchMenuItem {
  return {
    title: "Dépenses",
    description: "Noter une sortie d’argent ou un prêt propriétaire.",
    href: sharedBranchRoutes.depenses(organizationId, branchId),
    icon: Receipt,
    iconBg: "bg-muted",
    iconColor: "text-muted-foreground",
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
      titleColor: "text-primary",
      icon: Globe2,
      iconColor: "text-primary",
      items: [
        {
          title: "Tableau de Bord",
          description: "Voir l’activité et les indicateurs du jour.",
          href: sharedBranchRoutes.tableauBord(organizationId, branchId),
          icon: LayoutDashboard,
          iconBg: "bg-muted",
          iconColor: "text-muted-foreground",
        },
        {
          title: "Rapport Ventes",
          description: "Comparer le chiffre d’affaires et les moyens de paiement.",
          href: sharedBranchRoutes.ventes(organizationId, branchId),
          icon: FileBarChart,
          iconBg: "bg-muted",
          iconColor: "text-muted-foreground",
        },
        {
          title: "Rapport Achats",
          description: "Suivre les entrées et sorties de stock sur une période.",
          href: sharedBranchRoutes.achats(organizationId, branchId),
          icon: Package,
          iconBg: "bg-primary/15",
          iconColor: "text-primary",
        },
        {
          title: "Rapport Financier",
          description: "Croiser les recettes avec les approvisionnements.",
          href: sharedBranchRoutes.financier(organizationId, branchId),
          icon: FileText,
          iconBg: "bg-muted",
          iconColor: "text-muted-foreground",
        },
        {
          title: "Rapport Article",
          description: "Voir les articles les plus vendus et leurs catégories.",
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
          ? "Ouvrir la caisse et encaisser séjours ou restauration."
          : hasStays
            ? "Ouvrir la caisse et encaisser les séjours."
            : "Ouvrir la caisse et encaisser la restauration.",
      ),
    ];
    if (hasStays) {
      dailyItems.push({
        title: "Séjours",
        description: "Réserver une chambre, enregistrer une arrivée ou un départ.",
        href: hotelRoutes.sejours(organizationId, branchId),
        icon: ClipboardList,
        iconBg: "bg-primary/15",
        iconColor: "text-primary",
      });
    }
    if (hasRestaurant) {
      dailyItems.push(
        {
          title: "Restauration",
          description: "Prendre une commande et suivre l’addition.",
          href: hotelRoutes.restauration(organizationId, branchId),
          icon: UtensilsCrossed,
          iconBg: "bg-muted",
          iconColor: "text-muted-foreground",
        },
        {
          title: "Cuisine",
          description: "Voir les plats à préparer et les marquer prêts.",
          href: hotelRoutes.cuisine(organizationId, branchId),
          icon: ChefHat,
          iconBg: "bg-primary/15",
          iconColor: "text-primary",
        },
      );
    }
    dailyItems.push(tauxChangeCard(organizationId, branchId));
    dailyItems.push(bonsCommandeCard(organizationId, branchId));
    dailyItems.push(depensesCard(organizationId, branchId));

    const stockItems: BranchMenuItem[] = [];
    if (hasStays) {
      stockItems.push(
        {
          title: "Chambres",
          description: "Gérer les types de chambres et leur disponibilité.",
          href: hotelRoutes.chambres(organizationId, branchId),
          icon: BedDouble,
          iconBg: "bg-muted",
          iconColor: "text-muted-foreground",
        },
        {
          title: "Salles de réunion",
          description: "Réserver une salle et suivre sa capacité.",
          href: hotelRoutes.sallesReunion(organizationId, branchId),
          icon: Presentation,
          iconBg: "bg-muted",
          iconColor: "text-muted-foreground",
        },
      );
    }
    if (hasRestaurant) {
      stockItems.push(
        {
          title: "Produits",
          description: "Gérer la carte, les prix et le stock cuisine.",
          href: hotelRoutes.produits(organizationId, branchId),
          icon: Package,
          iconBg: "bg-muted",
          iconColor: "text-muted-foreground",
        },
        {
          title: "Service stock",
          description: "Ouvrir / clôturer le stock du vendeur.",
          href: hotelRoutes.serviceStock(organizationId, branchId),
          icon: ClipboardList,
          iconBg: "bg-primary/15",
          iconColor: "text-primary",
        },
      );
    }
    stockItems.push({
      title: "Livraison",
      description: "Enregistrer les livraisons et compter le stock.",
      href: hotelRoutes.livraison(organizationId, branchId),
      icon: Truck,
      iconBg: "bg-muted",
      iconColor: "text-muted-foreground",
    });

    return [
      {
        title: "OPÉRATIONS AU QUOTIDIEN",
        titleColor: "text-primary",
        icon: Wallet,
        iconColor: "text-primary",
        items: dailyItems,
      },
      {
        title: hasStays && !hasRestaurant ? "HÉBERGEMENT" : hasRestaurant && !hasStays ? "RESTAURANT & STOCK" : "HÉBERGEMENT & STOCK",
        titleColor: "text-muted-foreground",
        icon: hasStays ? BedDouble : UtensilsCrossed,
        iconColor: "text-muted-foreground",
        items: stockItems,
      },
      ...shared,
    ];
  }

  if (type === "BOUTIQUE") {
    return [
      {
        title: "OPÉRATIONS, CATALOGUE & STOCK",
        titleColor: "text-primary",
        icon: ShoppingCart,
        iconColor: "text-primary",
        items: [
          {
            title: "Point de vente",
            description: "Encaisser une vente et reprendre un ticket en attente.",
            href: boutiqueRoutes.pos(organizationId, branchId),
            icon: ShoppingCart,
            iconBg: "bg-primary/15",
            iconColor: "text-primary",
            primary: true,
          },
          tauxChangeCard(organizationId, branchId),
          bonsCommandeCard(organizationId, branchId),
          depensesCard(organizationId, branchId),
          {
            title: "Produits",
            description: "Gérer les articles, les prix et les promotions.",
            href: boutiqueRoutes.produits(organizationId, branchId),
            icon: Box,
            iconBg: "bg-muted",
            iconColor: "text-muted-foreground",
          },
          {
            title: "Stock",
            description: "Voir les niveaux et enregistrer un mouvement.",
            href: boutiqueRoutes.stock(organizationId, branchId),
            icon: Package,
            iconBg: "bg-muted",
            iconColor: "text-muted-foreground",
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
      titleColor: "text-primary",
      icon: Wallet,
      iconColor: "text-primary",
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
          iconBg: "bg-primary/15",
          iconColor: "text-primary",
        },
        {
          title: "Réservations",
          description: "Consulter et suivre les dossiers clients.",
          href: agenceRoutes.reservations(organizationId, branchId),
          icon: ClipboardList,
          iconBg: "bg-muted",
          iconColor: "text-muted-foreground",
        },
        {
          title: "Clients",
          description: "Retrouver un voyageur et son historique.",
          href: agenceRoutes.clients(organizationId, branchId),
          icon: Users,
          iconBg: "bg-muted",
          iconColor: "text-muted-foreground",
        },
        tauxChangeCard(organizationId, branchId),
        bonsCommandeCard(organizationId, branchId),
        depensesCard(organizationId, branchId),
      ],
    },
    {
      title: "EXPLOITATION VOYAGE",
      titleColor: "text-muted-foreground",
      icon: Plane,
      iconColor: "text-muted-foreground",
      items: [
        {
          title: "Trajets",
          description: "Configurer les lignes et leurs tarifs.",
          href: agenceRoutes.trajets(organizationId, branchId),
          icon: Plane,
          iconBg: "bg-muted",
          iconColor: "text-muted-foreground",
        },
        {
          title: "Colis",
          description: "Enregistrer une expédition ou une livraison.",
          href: agenceRoutes.colis(organizationId, branchId),
          icon: Package,
          iconBg: "bg-primary/15",
          iconColor: "text-primary",
        },
        {
          title: "Embarquement",
          description: "Scanner un billet et valider le passage.",
          href: agenceRoutes.passages(organizationId, branchId),
          icon: Users,
          iconBg: "bg-muted",
          iconColor: "text-muted-foreground",
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
        description: "Ouvrir les séjours pour une arrivée et un encaissement.",
      };
    }
    if (hasRestaurant) {
      return {
        href: hotelRoutes.restauration(organizationId, branchId),
        label: "Nouvelle commande restauration",
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
      label: "Nouvelle vente",
      description: "Ouvrir le point de vente pour encaisser un ticket.",
    };
  }
  return {
    href: agenceRoutes.guichet(organizationId, branchId),
    label: "Vendre un billet",
    description: "Ouvrir le guichet pour une vente comptoir.",
  };
}
