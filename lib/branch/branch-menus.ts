/**
 * Menus du hub branche — 100 % liés aux routes module (pas de #).
 * Carte primaire : « Caisse & Ventes » → hub caisse (puis CTA vente selon type).
 * Commun à tous les types : Paramètres (rôles, utilisateurs, apparence, taux) + Rapports.
 */

import type { ComponentType } from "react";
import {
  ArrowLeftRight,
  Banknote,
  BedDouble,
  Box,
  ChefHat,
  CalendarDays,
  ClipboardList,
  FileBarChart,
  FileText,
  Globe2,
  LayoutDashboard,
  Package,
  Palette,
  Plane,
  Presentation,
  Receipt,
  ShoppingCart,
  Settings,
  Shield,
  Truck,
  UserRound,
  Users,
  UtensilsCrossed,
  Wallet,
  Factory,
  Handshake,
} from "lucide-react";
import {
  agenceRoutes,
  boutiqueRoutes,
  branchCaissePath,
  branchDashboardPath,
  hotelRoutes,
  sharedBranchRoutes,
  usineRoutes,
} from "@/lib/branch/paths";
import { isHospitality } from "@/lib/branch/hospitality";
import {
  canSeeDashCard,
  DASH_CARD,
  type OpsRole,
} from "@/lib/branch/ops-roles";
import {
  isPayrollManagerRole,
  isPayrollPointerRole,
} from "@/lib/payroll/constants";

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
    title: "Taux de change",
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

/** Filtre hub par ids de cartes visibles (catalogue org). */
export function filterMenuSectionsByVisibleCardIds(
  sections: BranchMenuSection[],
  visibleCardIds: readonly string[],
): BranchMenuSection[] {
  const set = new Set(visibleCardIds);
  return sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => !item.id || set.has(item.id)),
    }))
    .filter((section) => section.items.length > 0);
}

function personnelPaieSection(
  organizationId: string,
  branchId: string,
): BranchMenuSection {
  return {
    title: "PERSONNEL & PAIE",
    titleColor: "text-amber-500",
    icon: Users,
    iconColor: "text-amber-500",
    items: [
      {
        id: DASH_CARD.PAIE_PRESENCES,
        title: "Présences",
        description: "Grille du jour : présent, absent, congé.",
        href: boutiqueRoutes.paiePresences(organizationId, branchId),
        icon: CalendarDays,
        iconBg: "bg-emerald-500/15",
        iconColor: "text-emerald-400",
      },
      {
        id: DASH_CARD.PAIE,
        title: "Paie du mois",
        description: "Bulletins, clôture et versement.",
        href: boutiqueRoutes.paie(organizationId, branchId),
        icon: Banknote,
        iconBg: "bg-amber-500/15",
        iconColor: "text-amber-500",
      },
      {
        id: DASH_CARD.PAIE_MOI,
        title: "Mes jours",
        description: "Vos présences, justificatifs, congés et avances.",
        href: boutiqueRoutes.paieMoi(organizationId, branchId),
        icon: UserRound,
        iconBg: "bg-sky-500/15",
        iconColor: "text-sky-400",
      },
    ],
  };
}

/** Filtre les sections selon le rôle ops (hospitalité). */
export function filterMenuSectionsForOpsRole(
  sections: BranchMenuSection[],
  opsRole: OpsRole | string,
  allowedCardIds?: ReadonlySet<string> | "ALL" | null,
): BranchMenuSection[] {
  return sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) =>
        canSeeDashCard(opsRole, item.id, allowedCardIds),
      ),
    }))
    .filter((section) => section.items.length > 0);
}

function applyBoutiquePayrollFilter(
  sections: BranchMenuSection[],
  opsRole: OpsRole | string,
): BranchMenuSection[] {
  return sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        if (item.id === DASH_CARD.PAIE) return isPayrollManagerRole(opsRole);
        if (item.id === DASH_CARD.PAIE_PRESENCES) {
          return isPayrollPointerRole(opsRole);
        }
        return true;
      }),
    }))
    .filter((section) => section.items.length > 0);
}

/**
 * Cartes hub visibles pour un rôle — même source que la sidebar.
 * Hospitalité : VIEW (DB / seed). Boutique : overlay paie. Agence : tout le menu type.
 */
export function visibleMenuSectionsForBranch(
  organizationId: string,
  branchId: string,
  type: string,
  flags: BranchMenuFlags,
  opsRole: OpsRole | string,
  allowedCardIds?: readonly string[] | "ALL" | null,
): BranchMenuSection[] {
  const raw = menuSectionsForBranch(organizationId, branchId, type, flags);
  const allowedSet =
    allowedCardIds === "ALL"
      ? ("ALL" as const)
      : allowedCardIds
        ? new Set(allowedCardIds)
        : null;
  const filtered = isHospitality(type)
    ? filterMenuSectionsForOpsRole(raw, opsRole, allowedSet)
    : type === "USINE"
      ? filterMenuSectionsForOpsRole(raw, opsRole, allowedSet)
      : raw;
  if (type === "BOUTIQUE" || type === "USINE") {
    return applyBoutiquePayrollFilter(filtered, opsRole);
  }
  return filtered;
}

function administrationSection(
  organizationId: string,
  branchId: string,
): BranchMenuSection {
  return {
    title: "ADMINISTRATION",
    titleColor: "text-primary",
    icon: Settings,
    iconColor: "text-primary",
    items: [
      {
        id: DASH_CARD.PARAMETRES,
        title: "Rôles",
        description: "Métiers de la branche et privilèges.",
        href: sharedBranchRoutes.parametres(organizationId, branchId),
        icon: Shield,
        iconBg: "bg-primary/15",
        iconColor: "text-primary",
      },
      {
        id: DASH_CARD.EQUIPE,
        title: "Utilisateurs",
        description: "Comptes rattachés à la branche active.",
        href: sharedBranchRoutes.parametresUsers(organizationId, branchId),
        icon: Users,
        iconBg: "bg-primary/15",
        iconColor: "text-primary",
      },
      {
        id: DASH_CARD.PARAMETRES,
        title: "Interface client",
        description: "Couleurs de base de l’UI client.",
        href: sharedBranchRoutes.parametresApparence(organizationId, branchId),
        icon: Palette,
        iconBg: "bg-primary/15",
        iconColor: "text-primary",
      },
      tauxChangeCard(organizationId, branchId),
    ],
  };
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
    dailyItems.push(bonsCommandeCard(organizationId, branchId));
    dailyItems.push(depensesCard(organizationId, branchId));

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
      administrationSection(organizationId, branchId),
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
          bonsCommandeCard(organizationId, branchId),
          depensesCard(organizationId, branchId),
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
            title: "Stock principal",
            description: "Entrepôt, ravitaillement POS, documents d’envoi / réception.",
            href: boutiqueRoutes.stock(organizationId, branchId),
            icon: Package,
            iconBg: "bg-sky-500/15",
            iconColor: "text-sky-400",
          },
          {
            id: DASH_CARD.SERVICE_STOCK,
            title: "Service stock",
            description: "Float vendeur POS — ouverture, réassort, clôture signée.",
            href: boutiqueRoutes.serviceStock(organizationId, branchId),
            icon: ClipboardList,
            iconBg: "bg-amber-500/15",
            iconColor: "text-amber-500",
          },
        ],
      },
      personnelPaieSection(organizationId, branchId),
      ...rapportsSections(organizationId, branchId),
      administrationSection(organizationId, branchId),
    ];
  }

  if (type === "USINE") {
    return [
      {
        title: "VENTE & CLIENTS",
        titleColor: "text-emerald-400",
        icon: ShoppingCart,
        iconColor: "text-emerald-400",
        items: [
          {
            id: DASH_CARD.POS,
            title: "Vente cash",
            description: "Panier depuis le float marketeur.",
            href: usineRoutes.pos(organizationId, branchId),
            icon: ShoppingCart,
            iconBg: "bg-emerald-500/15",
            iconColor: "text-emerald-400",
            primary: true,
          },
          {
            id: DASH_CARD.USINE_CREDITS,
            title: "Vente à crédit",
            description: "Nouveau crédit, document à signer, échéance.",
            href: usineRoutes.creditNew(organizationId, branchId),
            icon: FileText,
            iconBg: "bg-amber-500/15",
            iconColor: "text-amber-500",
          },
          {
            id: DASH_CARD.USINE_CREDITS,
            title: "Crédits",
            description: "Suivi, encaisser, prolonger l’échéance.",
            href: usineRoutes.credits(organizationId, branchId),
            icon: ClipboardList,
            iconBg: "bg-violet-500/15",
            iconColor: "text-violet-400",
          },
          {
            id: DASH_CARD.USINE_CLIENTS,
            title: "Clients",
            description: "Fiches : nom, téléphone, société.",
            href: usineRoutes.clients(organizationId, branchId),
            icon: Users,
            iconBg: "bg-sky-500/15",
            iconColor: "text-sky-400",
          },
          {
            id: DASH_CARD.USINE_RESERVATIONS,
            title: "Réservations",
            description: "Holds sur le stock auxiliaire du marketeur.",
            href: usineRoutes.reservations(organizationId, branchId),
            icon: CalendarDays,
            iconBg: "bg-rose-500/15",
            iconColor: "text-rose-400",
          },
          caisseVentesCard(
            organizationId,
            branchId,
            "Ouvrir la caisse pour encaisser cash et crédits.",
          ),
        ],
      },
      {
        title: "PRODUCTION & STOCK",
        titleColor: "text-sky-400",
        icon: Factory,
        iconColor: "text-sky-400",
        items: [
          {
            id: DASH_CARD.SERVICE_STOCK,
            title: "Float marketeur",
            description: "Attribution, réassort, clôture signée.",
            href: usineRoutes.serviceStock(organizationId, branchId),
            icon: ClipboardList,
            iconBg: "bg-amber-500/15",
            iconColor: "text-amber-500",
          },
          {
            id: DASH_CARD.USINE_DEPOT,
            title: "Dépôt",
            description: "Produits finis et consommables.",
            href: usineRoutes.depot(organizationId, branchId),
            icon: Package,
            iconBg: "bg-sky-500/15",
            iconColor: "text-sky-400",
          },
          {
            id: DASH_CARD.BOUTIQUE_PRODUITS,
            title: "Produits",
            description: "Finis (eau / vins) et consommables.",
            href: usineRoutes.produits(organizationId, branchId),
            icon: Box,
            iconBg: "bg-violet-500/15",
            iconColor: "text-violet-400",
          },
          {
            id: DASH_CARD.USINE_PRODUCTION,
            title: "Production",
            description: "Recettes et lots (consommables → finis).",
            href: usineRoutes.production(organizationId, branchId),
            icon: Factory,
            iconBg: "bg-emerald-500/15",
            iconColor: "text-emerald-400",
          },
          {
            id: DASH_CARD.USINE_FOURNISSEURS,
            title: "Fournisseurs",
            description: "Fiches enregistrées pour les bons de commande.",
            href: usineRoutes.fournisseurs(organizationId, branchId),
            icon: Handshake,
            iconBg: "bg-slate-500/15",
            iconColor: "text-slate-400",
          },
          bonsCommandeCard(organizationId, branchId),
          depensesCard(organizationId, branchId),
        ],
      },
      personnelPaieSection(organizationId, branchId),
      ...rapportsSections(organizationId, branchId),
      administrationSection(organizationId, branchId),
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
        bonsCommandeCard(organizationId, branchId),
        depensesCard(organizationId, branchId),
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
    administrationSection(organizationId, branchId),
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
  if (type === "USINE") {
    return {
      href: usineRoutes.pos(organizationId, branchId),
      label: "Vente cash usine",
      description: "Encaisser depuis le float marketeur.",
    };
  }
  return {
    href: agenceRoutes.guichet(organizationId, branchId),
    label: "Vendre un billet",
    description: "Ouvrir le guichet pour une vente comptoir.",
  };
}

export type BranchSidebarLink = {
  id?: string;
  title: string;
  href: string;
  icon?: ComponentType<{ className?: string }>;
};

export type BranchSidebarEntry = {
  id?: string;
  title: string;
  href?: string;
  icon: ComponentType<{ className?: string }>;
  forceGroup?: boolean;
  children?: BranchSidebarLink[];
};

const SIDEBAR_SECTION_TITLES: Record<string, string> = {
  "OPÉRATIONS AU QUOTIDIEN": "Opérations",
  "HÉBERGEMENT": "Hébergement",
  "RESTAURANT & STOCK": "Restaurant",
  "HÉBERGEMENT & STOCK": "Hébergement",
  "ANALYSES & RAPPORTS": "Rapports",
  "ADMINISTRATION": "Paramètres",
  "OPÉRATIONS, CATALOGUE & STOCK": "Boutique",
  "VENTE & CLIENTS": "Vente",
  "PRODUCTION & STOCK": "Usine",
  "PERSONNEL & PAIE": "Personnel",
  "EXPLOITATION VOYAGE": "Voyage",
};

/** Nav verticale — une entrée Accueil + un groupe par section de cartes hub. */
export function branchSidebarNav(
  organizationId: string,
  branchId: string,
  type: string,
  flags: BranchMenuFlags,
  opsRole: OpsRole | string,
  allowedCardIds?: readonly string[] | "ALL" | null,
): BranchSidebarEntry[] {
  const sections = visibleMenuSectionsForBranch(
    organizationId,
    branchId,
    type,
    flags,
    opsRole,
    allowedCardIds,
  );
  const dashHref = branchDashboardPath(organizationId, branchId);
  const entries: BranchSidebarEntry[] = [
    {
      title: "Accueil",
      href: dashHref,
      icon: LayoutDashboard,
    },
  ];
  for (const section of sections) {
    if (section.items.length === 1 && section.title !== "ADMINISTRATION") {
      const item = section.items[0]!;
      entries.push({
        id: item.id,
        title: item.title,
        href: item.href,
        icon: item.icon,
      });
      continue;
    }
    entries.push({
      title: SIDEBAR_SECTION_TITLES[section.title] ?? section.title,
      icon: section.icon,
      forceGroup: true,
      children: section.items.map((item) => ({
        id: item.id,
        title: item.title,
        href: item.href,
        icon: item.icon,
      })),
    });
  }
  return entries;
}

export function filterBranchSidebarNav(
  entries: BranchSidebarEntry[],
  opsRole: OpsRole | string,
  allowedCardIds?: ReadonlySet<string> | "ALL" | null,
): BranchSidebarEntry[] {
  return entries
    .map((entry) => {
      if (entry.children?.length) {
        const children = entry.children.filter((child) =>
          canSeeDashCard(opsRole, child.id, allowedCardIds),
        );
        if (children.length === 0) return null;
        if (children.length === 1 && !entry.forceGroup) {
          return {
            ...entry,
            id: children[0].id,
            href: children[0].href,
            title: children[0].title,
            icon: children[0].icon ?? entry.icon,
            children: undefined,
          } satisfies BranchSidebarEntry;
        }
        return { ...entry, children };
      }
      if (!canSeeDashCard(opsRole, entry.id, allowedCardIds)) return null;
      return entry;
    })
    .filter((entry): entry is BranchSidebarEntry => entry != null);
}

/** Première page autorisée pour un rôle (évite un hub vide de cartes). */
export function firstAllowedBranchPath(
  organizationId: string,
  branchId: string,
  type: string,
  flags: BranchMenuFlags,
  opsRole: OpsRole | string,
  allowedCardIds?: readonly string[] | "ALL" | null,
): string {
  const entries = branchSidebarNav(
    organizationId,
    branchId,
    type,
    flags,
    opsRole,
    allowedCardIds,
  );
  for (const entry of entries) {
    if (entry.href) return entry.href;
    const child = entry.children?.[0]?.href;
    if (child) return child;
  }
  return branchDashboardPath(organizationId, branchId);
}
