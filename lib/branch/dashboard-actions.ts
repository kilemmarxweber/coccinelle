"use server";

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { canAccessBranch } from "@/lib/branch/user-branches";
import {
  agenceRoutes,
  boutiqueRoutes,
  branchCaissePath,
  hotelRoutes,
  sharedBranchRoutes,
  usineRoutes,
} from "@/lib/branch/paths";
import { isHospitality } from "@/lib/branch/hospitality";
import { isUsine } from "@/lib/branch/usine";
import {
  normalizeOpsRole,
  OPS_ROLE,
  opsRoleLabel,
  canSeeDashCard,
  DASH_CARD,
  type OpsRole,
} from "@/lib/branch/ops-roles";
import { resolveCurrentBranchOpsRole } from "@/lib/branch/resolve-ops-role";
import { getViewResourcesForRole } from "@/lib/branch/privileges";
import { formatUsd } from "@/lib/hotel/money";

export type DashboardIconKey =
  | "wallet"
  | "bed"
  | "utensils"
  | "chef"
  | "clipboard"
  | "shopping"
  | "plane"
  | "package"
  | "users"
  | "activity"
  | "receipt"
  | "calendar";

export type DashboardTone = "primary" | "emerald" | "amber" | "sky" | "rose";

export type BranchDashboardKpi = {
  key: string;
  label: string;
  value: string;
  hint: string;
  tone: DashboardTone;
};

export type BranchDashboardLink = {
  title: string;
  description: string;
  href: string;
  icon: DashboardIconKey;
};

export type BranchDashboardFocus = {
  title: string;
  description: string;
  href: string;
  count: number;
};

export type BranchDashboardData = {
  userName: string;
  branchName: string;
  branchType: string;
  hasStays: boolean;
  hasRestaurant: boolean;
  hasEau: boolean;
  hasVin: boolean;
  opsRole: OpsRole;
  roleLabel: string;
  mission: string;
  kpis: BranchDashboardKpi[];
  shortcuts: BranchDashboardLink[];
  focus: BranchDashboardFocus[];
  cashSessionOpen: boolean | null;
  allowedCardIds: string[] | "ALL";
};

function startOfCalendarDay(timeZone = "Africa/Kinshasa") {
  const ymd = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return new Date(`${ymd}T00:00:00+01:00`);
}

function endOfCalendarDay(start: Date) {
  return new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
}

function missionFor(
  role: OpsRole,
  type: string,
  flags: { hasStays: boolean; hasRestaurant: boolean },
): string {
  if (type === "BOUTIQUE") {
    return "Caisse, tickets en attente et stock — le quotidien de la boutique.";
  }
  if (type === "AGENCE") {
    return "Guichet, trajets et colis — vendez et embarquez sans friction.";
  }
  if (isUsine(type)) {
    if (role === OPS_ROLE.MARKETEUR) {
      return "Vendez depuis votre float : cash immédiat, crédit nommé avec document, encaissements par tranche et réservations. Le dépôt et la production restent au gérant.";
    }
    return "Pilotage usine : acheter via un fournisseur, produire des lots, attribuer le float au marketeur, puis vendre cash ou à crédit — sans mélange avec l’hôtel, l’agence ou la boutique.";
  }
  switch (role) {
    case OPS_ROLE.SERVEUR:
      return "Prenez les commandes, suivez la cuisine et livrez à table.";
    case OPS_ROLE.CAISSIER_SEJOURS:
      return "Encaisser les folios, valider les check-out, tenir la session ouverte.";
    case OPS_ROLE.CAISSIER_RESTO:
      return "Encaisser le F&B, traiter les tickets prêts, tenir la session ouverte.";
    case OPS_ROLE.CAISSIER:
      return "Encaisser, valider les sorties, tenir la session de caisse ouverte.";
    case OPS_ROLE.RECEPTIONNISTE:
      return "Accueillez, enregistrez et orientez. Chaque check-in bien préparé accélère la suite.";
    case OPS_ROLE.GERANT:
    case OPS_ROLE.MANAGER:
    case OPS_ROLE.BRANCH_MANAGER:
    case OPS_ROLE.PROPRIETAIRE:
      return flags.hasStays && flags.hasRestaurant
        ? "Vue d’ensemble : occupation, restauration et caisse."
        : flags.hasRestaurant
          ? "Vue d’ensemble du restaurant : file cuisine, caisse et stock."
          : "Vue d’ensemble de l’hébergement : séjours, chambres et caisse.";
    default:
      return "Votre espace de travail pour la journée.";
  }
}

export async function getBranchRoleDashboardAction(
  organizationId: string,
  branchId: string,
): Promise<BranchDashboardData> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) throw new Error("Non authentifié.");
  const branch = await canAccessBranch(
    session.user.id,
    session.user.role,
    branchId,
  );
  if (!branch || branch.organizationId !== organizationId) {
    throw new Error("Branche inaccessible.");
  }

  const opsRole = await resolveCurrentBranchOpsRole(organizationId, branchId);
  const role = normalizeOpsRole(opsRole);
  const userId = session.user.id;
  const start = startOfCalendarDay();
  const end = endOfCalendarDay(start);
  const type = branch.type;
  const hasStays = branch.hasStays;
  const hasRestaurant = branch.hasRestaurant;

  const href = {
    caisse: branchCaissePath(organizationId, branchId),
    sejours: hotelRoutes.sejours(organizationId, branchId),
    chambres: hotelRoutes.chambres(organizationId, branchId),
    restauration: hotelRoutes.restauration(organizationId, branchId),
    cuisine: hotelRoutes.cuisine(organizationId, branchId),
    partenaires: hotelRoutes.partenaires(organizationId, branchId),
    mesCommandes: sharedBranchRoutes.mesCommandes(organizationId, branchId),
    tableau: sharedBranchRoutes.tableauBord(organizationId, branchId),
    pos: boutiqueRoutes.pos(organizationId, branchId),
    stock: boutiqueRoutes.stock(organizationId, branchId),
    guichet: agenceRoutes.guichet(organizationId, branchId),
    reservations: agenceRoutes.reservations(organizationId, branchId),
    colis: agenceRoutes.colis(organizationId, branchId),
    trajets: agenceRoutes.trajets(organizationId, branchId),
    passages: agenceRoutes.passages(organizationId, branchId),
    usinePos: usineRoutes.pos(organizationId, branchId),
    usineCreditNew: usineRoutes.creditNew(organizationId, branchId),
    usineCredits: usineRoutes.credits(organizationId, branchId),
    usineClients: usineRoutes.clients(organizationId, branchId),
    usineReservations: usineRoutes.reservations(organizationId, branchId),
    usineFloat: usineRoutes.serviceStock(organizationId, branchId),
    usineDepot: usineRoutes.depot(organizationId, branchId),
    usineProduction: usineRoutes.production(organizationId, branchId),
    usineFournisseurs: usineRoutes.fournisseurs(organizationId, branchId),
    usineProduits: usineRoutes.produits(organizationId, branchId),
    bonsCommande: sharedBranchRoutes.bonsCommande(organizationId, branchId),
  };

  const kpis: BranchDashboardKpi[] = [];
  const shortcuts: BranchDashboardLink[] = [];
  const focus: BranchDashboardFocus[] = [];
  let cashSessionOpen: boolean | null = null;
  let allowedCardIds: string[] | "ALL" = "ALL";

  if (type === "BOUTIQUE") {
    const [cashOpen, holds, salesToday, salesSum] = await Promise.all([
      prisma.cashSession.findFirst({
        where: { branchId, status: "OPEN" },
        select: { id: true },
      }),
      prisma.shopSale.count({
        where: { branchId, status: "EN_ATTENTE" },
      }),
      prisma.shopSale.count({
        where: {
          branchId,
          status: "ENCAISSEE",
          paidAt: { gte: start, lte: end },
        },
      }),
      prisma.shopSale.aggregate({
        where: {
          branchId,
          status: "ENCAISSEE",
          paidAt: { gte: start, lte: end },
        },
        _sum: { totalAmount: true },
      }),
    ]);
    cashSessionOpen = Boolean(cashOpen);
    kpis.push(
      {
        key: "holds",
        label: "Tickets en attente",
        value: String(holds),
        hint: "Paniers à encaisser",
        tone: "amber",
      },
      {
        key: "sales",
        label: "Ventes du jour",
        value: String(salesToday),
        hint: "Tickets encaissés",
        tone: "emerald",
      },
      {
        key: "ca",
        label: "CA du jour",
        value: formatUsd(salesSum._sum.totalAmount ?? 0),
        hint: "Montant encaissé",
        tone: "primary",
      },
      {
        key: "session",
        label: "Session caisse",
        value: cashOpen ? "Ouverte" : "Fermée",
        hint: cashOpen ? "Vous pouvez encaisser" : "Ouvrez la session pour vendre",
        tone: cashOpen ? "emerald" : "rose",
      },
    );
    shortcuts.push(
      {
        title: "Point de vente",
        description: "Panier, tickets en attente et encaissement.",
        href: href.pos,
        icon: "shopping",
      },
      {
        title: "Stock principal",
        description: "Entrepôt et ravitaillement POS.",
        href: href.stock,
        icon: "package",
      },
    );
    focus.push({
      title: "Tickets à encaisser",
      description: "Reprenez les paniers en attente.",
      href: href.pos,
      count: holds,
    });
  } else if (type === "AGENCE") {
    const trajetWhere = { trajet: { branchId } };
    const [cashOpen, resasToday, colisWait, departsOpen] = await Promise.all([
      prisma.cashSession.findFirst({
        where: { branchId, status: "OPEN" },
        select: { id: true },
      }),
      prisma.reservation.count({
        where: {
          ...trajetWhere,
          statut: { in: ["CONFIRME", "EMBARQUE"] },
          dateDepart: { gte: start, lte: end },
        },
      }),
      prisma.colis.count({
        where: { ...trajetWhere, statut: "EN_ATTENTE" },
      }),
      prisma.trajetDepart.count({
        where: {
          ...trajetWhere,
          statut: "OUVERT",
          dateDepart: { gte: start, lte: end },
        },
      }),
    ]);
    cashSessionOpen = Boolean(cashOpen);
    kpis.push(
      {
        key: "resas",
        label: "Billets du jour",
        value: String(resasToday),
        hint: "Confirmés ou embarqués",
        tone: "primary",
      },
      {
        key: "departs",
        label: "Départs ouverts",
        value: String(departsOpen),
        hint: "Guichet actif aujourd’hui",
        tone: "emerald",
      },
      {
        key: "colis",
        label: "Colis en attente",
        value: String(colisWait),
        hint: "À expédier",
        tone: "amber",
      },
      {
        key: "session",
        label: "Session caisse",
        value: cashOpen ? "Ouverte" : "Fermée",
        hint: cashOpen ? "Vous pouvez vendre" : "Ouvrez la session pour encaisser",
        tone: cashOpen ? "emerald" : "rose",
      },
    );
    shortcuts.push(
      {
        title: "Guichet",
        description: "Vendre un billet au comptoir.",
        href: href.guichet,
        icon: "shopping",
      },
      {
        title: "Réservations",
        description: "Liste et suivi des dossiers.",
        href: href.reservations,
        icon: "clipboard",
      },
      {
        title: "Colis",
        description: "Expéditions et livraisons.",
        href: href.colis,
        icon: "package",
      },
      {
        title: "Embarquement",
        description: "Scan QR et passages.",
        href: href.passages,
        icon: "users",
      },
    );
    focus.push({
      title: "Colis à traiter",
      description: "Expédiez les colis encore en attente.",
      href: href.colis,
      count: colisWait,
    });
  } else if (isUsine(type)) {
    const isMarketer = role === OPS_ROLE.MARKETEUR;
    const [
      cashOpen,
      creditsOpen,
      creditsDue,
      holds,
      salesToday,
      salesSum,
      creditPaidSum,
      batchesToday,
      floatOpen,
    ] = await Promise.all([
      prisma.cashSession.findFirst({
        where: { branchId, status: "OPEN" },
        select: { id: true },
      }),
      prisma.factoryCredit.count({
        where: { branchId, status: { in: ["OPEN", "PARTIAL"] } },
      }),
      prisma.factoryCredit.count({
        where: {
          branchId,
          status: { in: ["OPEN", "PARTIAL"] },
          dueAt: { lte: end },
        },
      }),
      prisma.factoryReservation.count({
        where: { branchId, status: "HOLD" },
      }),
      prisma.shopSale.count({
        where: {
          branchId,
          status: "ENCAISSEE",
          paidAt: { gte: start, lte: end },
        },
      }),
      prisma.shopSale.aggregate({
        where: {
          branchId,
          status: "ENCAISSEE",
          paidAt: { gte: start, lte: end },
        },
        _sum: { totalAmount: true },
      }),
      prisma.payment.aggregate({
        where: {
          branchId,
          factoryCreditId: { not: null },
          paidAt: { gte: start, lte: end },
        },
        _sum: { amountForeign: true },
      }),
      prisma.factoryBatch.count({
        where: {
          branchId,
          status: "VALIDATED",
          producedAt: { gte: start, lte: end },
        },
      }),
      prisma.serviceStockSession.count({
        where: { branchId, status: "OPEN" },
      }),
    ]);
    cashSessionOpen = Boolean(cashOpen);
    const caToday =
      (salesSum._sum.totalAmount ?? 0) + (creditPaidSum._sum.amountForeign ?? 0);

    kpis.push(
      {
        key: "credits",
        label: "Crédits ouverts",
        value: String(creditsOpen),
        hint: "Dossiers encore à encaisser",
        tone: "amber",
      },
      {
        key: isMarketer ? "due" : "lots",
        label: isMarketer ? "Échéances" : "Lots du jour",
        value: String(isMarketer ? creditsDue : batchesToday),
        hint: isMarketer
          ? "À recouvrer aujourd’hui ou en retard"
          : "Production validée aujourd’hui",
        tone: isMarketer ? "rose" : "emerald",
      },
      {
        key: "holds",
        label: "Réservations",
        value: String(holds),
        hint: "Stock auxiliaire bloqué",
        tone: "sky",
      },
      {
        key: "ca",
        label: "Caisse du jour",
        value: formatUsd(caToday),
        hint: cashOpen
          ? `${salesToday} vente(s) cash · session ouverte`
          : "Ouvrez la caisse pour encaisser",
        tone: cashOpen ? "primary" : "rose",
      },
    );

    if (isMarketer) {
      shortcuts.push(
        {
          title: "Vente cash",
          description: "Panier depuis votre float marketeur.",
          href: href.usinePos,
          icon: "shopping",
        },
        {
          title: "Vente à crédit",
          description: "Client, quantité, échéance, document à signer.",
          href: href.usineCreditNew,
          icon: "clipboard",
        },
        {
          title: "Crédits",
          description: "Encaisser un acompte, un complément ou le solde.",
          href: href.usineCredits,
          icon: "receipt",
        },
        {
          title: "Réservations",
          description: "Bloquer du float libre pour un client.",
          href: href.usineReservations,
          icon: "calendar",
        },
        {
          title: "Float marketeur",
          description: "Votre stock auxiliaire — pas le dépôt.",
          href: href.usineFloat,
          icon: "package",
        },
        {
          title: "Clients",
          description: "Fiches : nom, téléphone, société.",
          href: href.usineClients,
          icon: "users",
        },
      );
    } else {
      shortcuts.push(
        {
          title: "Vente cash",
          description: "Panier depuis le float marketeur.",
          href: href.usinePos,
          icon: "shopping",
        },
        {
          title: "Vente à crédit",
          description: "Nouveau crédit, document, échéance.",
          href: href.usineCreditNew,
          icon: "clipboard",
        },
        {
          title: "Production",
          description: "Recettes et lots : consommables → produits finis.",
          href: href.usineProduction,
          icon: "activity",
        },
        {
          title: "Dépôt",
          description: "Produits finis et consommables.",
          href: href.usineDepot,
          icon: "package",
        },
        {
          title: "Float marketeur",
          description: "Attribution, réassort, clôture signée.",
          href: href.usineFloat,
          icon: "clipboard",
        },
        {
          title: "Fournisseurs",
          description: "Fiches pour les bons de commande.",
          href: href.usineFournisseurs,
          icon: "users",
        },
      );
    }

    if (creditsDue > 0) {
      focus.push({
        title: "Crédits à recouvrer",
        description:
          "Échéance aujourd’hui ou dépassée — encaisser ou prolonger.",
        href: href.usineCredits,
        count: creditsDue,
      });
    }
    if (holds > 0) {
      focus.push({
        title: "Réservations actives",
        description:
          "Quantités bloquées sur le float jusqu’à retrait ou expiration.",
        href: href.usineReservations,
        count: holds,
      });
    }
    if (!isMarketer && floatOpen > 0) {
      focus.push({
        title: "Floats ouverts",
        description: "Sessions marketeur encore en cours.",
        href: href.usineFloat,
        count: floatOpen,
      });
    }
    if (!cashOpen) {
      focus.push({
        title: "Caisse fermée",
        description: "Ouvrez la session pour encaisser cash et crédits.",
        href: href.caisse,
        count: 0,
      });
    }

    const views = await getViewResourcesForRole(role);
    allowedCardIds = views === "ALL" ? "ALL" : Array.from(views);
    const allowed = views === "ALL" ? ("ALL" as const) : views;
    const cardByHref = new Map<string, string>([
      [href.usinePos, DASH_CARD.POS],
      [href.usineCreditNew, DASH_CARD.USINE_CREDITS],
      [href.usineCredits, DASH_CARD.USINE_CREDITS],
      [href.usineClients, DASH_CARD.USINE_CLIENTS],
      [href.usineReservations, DASH_CARD.USINE_RESERVATIONS],
      [href.usineFloat, DASH_CARD.SERVICE_STOCK],
      [href.usineDepot, DASH_CARD.USINE_DEPOT],
      [href.usineProduction, DASH_CARD.USINE_PRODUCTION],
      [href.usineFournisseurs, DASH_CARD.USINE_FOURNISSEURS],
      [href.usineProduits, DASH_CARD.BOUTIQUE_PRODUITS],
      [href.bonsCommande, DASH_CARD.BONS_COMMANDE],
      [href.caisse, DASH_CARD.CAISSE],
    ]);
    const keep = (itemHref: string) =>
      canSeeDashCard(role, cardByHref.get(itemHref), allowed);
    shortcuts.splice(
      0,
      shortcuts.length,
      ...shortcuts.filter((s) => keep(s.href)),
    );
    focus.splice(0, focus.length, ...focus.filter((f) => keep(f.href)));
  } else {
    const [
      cashOpen,
      inHouse,
      arrivalsToday,
      departuresToday,
      roomsCleaning,
      kitchenQueue,
      kitchenReady,
      ordersAtCash,
      checkoutQueue,
      myOrdersToday,
      salesToday,
    ] = await Promise.all([
      prisma.cashSession.findFirst({
        where: { branchId, status: "OPEN" },
        select: { id: true },
      }),
      hasStays
        ? prisma.hotelStay.count({
            where: { branchId, status: "CHECKED_IN" },
          })
        : Promise.resolve(0),
      hasStays
        ? prisma.hotelStay.count({
            where: {
              branchId,
              status: "RESERVED",
              checkInDate: { gte: start, lte: end },
            },
          })
        : Promise.resolve(0),
      hasStays
        ? prisma.hotelStay.count({
            where: {
              branchId,
              status: "CHECKED_IN",
              checkOutDate: { gte: start, lte: end },
            },
          })
        : Promise.resolve(0),
      hasStays
        ? prisma.hotelRoom.count({
            where: {
              status: "CLEANING",
              roomType: { branchId, kind: "ROOM" },
            },
          })
        : Promise.resolve(0),
      hasRestaurant
        ? prisma.hotelOrder.count({
            where: {
              branchId,
              status: { in: ["ENVOYEE", "EN_PREPARATION"] },
            },
          })
        : Promise.resolve(0),
      hasRestaurant
        ? prisma.hotelOrder.count({
            where: { branchId, status: "PRETE" },
          })
        : Promise.resolve(0),
      hasRestaurant
        ? prisma.hotelOrder.count({
            where: { branchId, status: "EN_CAISSE" },
          })
        : Promise.resolve(0),
      hasStays
        ? prisma.folio.count({
            where: {
              branchId,
              closed: false,
              checkoutQueuedAt: { not: null },
            },
          })
        : Promise.resolve(0),
      hasRestaurant
        ? prisma.hotelOrder.count({
            where: {
              branchId,
              createdByUserId: userId,
              createdAt: { gte: start, lte: end },
              status: { not: "ANNULEE" },
            },
          })
        : Promise.resolve(0),
      prisma.payment.aggregate({
        where: { branchId, paidAt: { gte: start, lte: end } },
        _sum: { amountForeign: true },
        _count: true,
      }),
    ]);

    const caToday = salesToday._sum.amountForeign ?? 0;

    if (role === OPS_ROLE.SERVEUR) {
      kpis.push(
        {
          key: "mine",
          label: "Mes commandes",
          value: String(myOrdersToday),
          hint: "Passées aujourd’hui",
          tone: "primary",
        },
        {
          key: "kitchen",
          label: "En cuisine",
          value: String(kitchenQueue),
          hint: "Envoyées ou en préparation",
          tone: "amber",
        },
        {
          key: "ready",
          label: "Prêtes à servir",
          value: String(kitchenReady),
          hint: "À livrer en salle",
          tone: "emerald",
        },
        {
          key: "cash",
          label: "En caisse",
          value: String(ordersAtCash),
          hint: "Tickets en attente d’encaissement",
          tone: "sky",
        },
      );
      shortcuts.push(
        {
          title: "Restauration",
          description: "Nouvelle commande et suivi de salle.",
          href: href.restauration,
          icon: "utensils",
        },
        {
          title: "Mes commandes",
          description: "Votre activité F&B du jour.",
          href: href.mesCommandes,
          icon: "clipboard",
        },
      );
      focus.push({
        title: "Plats prêts",
        description: "Livrez d’abord les commandes marquées prêtes.",
        href: href.restauration,
        count: kitchenReady,
      });
    } else if (role === OPS_ROLE.CAISSIER_SEJOURS) {
      cashSessionOpen = Boolean(cashOpen);
      kpis.push(
        {
          key: "queue",
          label: "Check-out caisse",
          value: String(checkoutQueue),
          hint: "Folios en file d’encaissement",
          tone: "amber",
        },
        {
          key: "out",
          label: "Départs du jour",
          value: String(departuresToday),
          hint: "Séjours encore en chambre",
          tone: "sky",
        },
        {
          key: "inhouse",
          label: "En chambre",
          value: String(inHouse),
          hint: "Séjours check-in",
          tone: "primary",
        },
        {
          key: "session",
          label: "Session caisse",
          value: cashOpen ? "Ouverte" : "Fermée",
          hint: cashOpen ? "Vous pouvez encaisser" : "Ouvrez la session",
          tone: cashOpen ? "emerald" : "rose",
        },
      );
      shortcuts.push(
        {
          title: "Caisse",
          description: "Folios, encaissements et reçus.",
          href: href.caisse,
          icon: "wallet",
        },
        {
          title: "Séjours",
          description: "Check-in / check-out et notes.",
          href: href.sejours,
          icon: "clipboard",
        },
        {
          title: "Chambres",
          description: "Occupation et statuts.",
          href: href.chambres,
          icon: "bed",
        },
      );
      focus.push({
        title: "Folios à encaisser",
        description: "Réglez les check-out encore en file.",
        href: href.caisse,
        count: checkoutQueue,
      });
    } else if (role === OPS_ROLE.CAISSIER_RESTO) {
      cashSessionOpen = Boolean(cashOpen);
      kpis.push(
        {
          key: "encaisse",
          label: "Tickets caisse",
          value: String(ordersAtCash),
          hint: "Commandes à encaisser",
          tone: "amber",
        },
        {
          key: "ready",
          label: "Prêtes",
          value: String(kitchenReady),
          hint: "Bientôt en caisse / livraison",
          tone: "emerald",
        },
        {
          key: "ca",
          label: "Encaissements",
          value: formatUsd(caToday),
          hint: `${salesToday._count} paiement(s) du jour`,
          tone: "primary",
        },
        {
          key: "session",
          label: "Session caisse",
          value: cashOpen ? "Ouverte" : "Fermée",
          hint: cashOpen ? "Vous pouvez encaisser" : "Ouvrez la session",
          tone: cashOpen ? "emerald" : "rose",
        },
      );
      shortcuts.push(
        {
          title: "Caisse",
          description: "Tickets F&B et encaissement.",
          href: href.caisse,
          icon: "wallet",
        },
        {
          title: "Restauration",
          description: "File des commandes salle.",
          href: href.restauration,
          icon: "utensils",
        },
        {
          title: "Cuisine",
          description: "Préparation et plats prêts.",
          href: href.cuisine,
          icon: "chef",
        },
      );
      focus.push({
        title: "Tickets à encaisser",
        description: "Réglez les commandes arrivées en caisse.",
        href: href.caisse,
        count: ordersAtCash,
      });
    } else if (role === OPS_ROLE.CAISSIER) {
      cashSessionOpen = Boolean(cashOpen);
      kpis.push(
        {
          key: "queue",
          label: "À encaisser",
          value: String(checkoutQueue + ordersAtCash),
          hint: "Folios + tickets F&B",
          tone: "amber",
        },
        {
          key: "ca",
          label: "Encaissements",
          value: formatUsd(caToday),
          hint: `${salesToday._count} paiement(s) du jour`,
          tone: "primary",
        },
        {
          key: "inhouse",
          label: "En chambre",
          value: String(inHouse),
          hint: "Séjours ouverts",
          tone: "sky",
        },
        {
          key: "session",
          label: "Session caisse",
          value: cashOpen ? "Ouverte" : "Fermée",
          hint: cashOpen ? "Vous pouvez encaisser" : "Ouvrez la session",
          tone: cashOpen ? "emerald" : "rose",
        },
      );
      shortcuts.push({
        title: "Caisse",
        description: "Encaissements, folios et tickets.",
        href: href.caisse,
        icon: "wallet",
      });
      focus.push({
        title: "File d’encaissement",
        description: "Folios et tickets encore ouverts.",
        href: href.caisse,
        count: checkoutQueue + ordersAtCash,
      });
    } else if (role === OPS_ROLE.RECEPTIONNISTE) {
      kpis.push(
        {
          key: "arrivals",
          label: "Arrivées du jour",
          value: String(arrivalsToday),
          hint: "Réservations à enregistrer",
          tone: "amber",
        },
        {
          key: "inhouse",
          label: "En chambre",
          value: String(inHouse),
          hint: "Séjours check-in",
          tone: "emerald",
        },
        {
          key: "out",
          label: "Départs du jour",
          value: String(departuresToday),
          hint: "Check-out à préparer",
          tone: "sky",
        },
        {
          key: "clean",
          label: "À remettre",
          value: String(roomsCleaning),
          hint: "Chambres en housekeeping",
          tone: "primary",
        },
      );
      shortcuts.push(
        {
          title: "Séjours",
          description: "Check-in, check-out et dossiers.",
          href: href.sejours,
          icon: "clipboard",
        },
        {
          title: "Chambres",
          description: "Occupation et statuts.",
          href: href.chambres,
          icon: "bed",
        },
        {
          title: "Clients partenaires",
          description: "Sociétés et coordonnées.",
          href: href.partenaires,
          icon: "users",
        },
      );
      focus.push({
        title: "Arrivées à enregistrer",
        description: "Présentez les clients et faites le check-in.",
        href: href.sejours,
        count: arrivalsToday,
      });
    } else if (
      role === OPS_ROLE.GERANT ||
      role === OPS_ROLE.MANAGER ||
      role === OPS_ROLE.BRANCH_MANAGER ||
      role === OPS_ROLE.PROPRIETAIRE
    ) {
      cashSessionOpen = Boolean(cashOpen);
      kpis.push(
        {
          key: "inhouse",
          label: hasStays ? "Occupation" : "Commandes cuisine",
          value: String(hasStays ? inHouse : kitchenQueue),
          hint: hasStays ? "Séjours en chambre" : "En préparation",
          tone: "primary",
        },
        {
          key: "flow",
          label: hasStays ? "Arrivées / départs" : "Prêtes",
          value: hasStays
            ? `${arrivalsToday} / ${departuresToday}`
            : String(kitchenReady),
          hint: hasStays ? "Flux du jour" : "À servir",
          tone: "emerald",
        },
        {
          key: "ca",
          label: "Caisse du jour",
          value: formatUsd(caToday),
          hint: cashOpen ? "Session ouverte" : "Session fermée",
          tone: "amber",
        },
        {
          key: "queue",
          label: hasRestaurant ? "File F&B" : "Check-out caisse",
          value: String(hasRestaurant ? kitchenQueue + kitchenReady : checkoutQueue),
          hint: hasRestaurant ? "Cuisine + prêts" : "Folios en file",
          tone: "sky",
        },
      );
      if (hasStays) {
        shortcuts.push({
          title: "Séjours",
          description: "Occupation et flux clients.",
          href: href.sejours,
          icon: "bed",
        });
      }
      if (hasRestaurant) {
        shortcuts.push({
          title: "Restauration",
          description: "Commandes et additions.",
          href: href.restauration,
          icon: "utensils",
        });
      }
      shortcuts.push(
        {
          title: "Tableau de bord",
          description: "Indicateurs et comparaison.",
          href: href.tableau,
          icon: "activity",
        },
        {
          title: "Caisse",
          description: "Session et encaissements.",
          href: href.caisse,
          icon: "wallet",
        },
      );
      if (hasStays) {
        focus.push({
          title: "Arrivées du jour",
          description: "Réservations encore à enregistrer.",
          href: href.sejours,
          count: arrivalsToday,
        });
      }
      if (hasRestaurant) {
        focus.push({
          title: "File cuisine",
          description: "Commandes envoyées ou en préparation.",
          href: href.cuisine,
          count: kitchenQueue,
        });
      }
    } else if (isHospitality(type)) {
      kpis.push(
        {
          key: "inhouse",
          label: "En chambre",
          value: String(inHouse),
          hint: "Séjours ouverts",
          tone: "primary",
        },
        {
          key: "arrivals",
          label: "Arrivées",
          value: String(arrivalsToday),
          hint: "À enregistrer aujourd’hui",
          tone: "amber",
        },
        {
          key: "kitchen",
          label: "Cuisine",
          value: String(kitchenQueue),
          hint: "Commandes en préparation",
          tone: "sky",
        },
        {
          key: "ready",
          label: "Prêtes",
          value: String(kitchenReady),
          hint: "À servir",
          tone: "emerald",
        },
      );
      shortcuts.push(
        {
          title: "Séjours",
          description: "Accueil et dossiers.",
          href: href.sejours,
          icon: "clipboard",
        },
        {
          title: "Restauration",
          description: "Commandes salle.",
          href: href.restauration,
          icon: "utensils",
        },
      );
    }
  }

  if (isHospitality(type)) {
    const views = await getViewResourcesForRole(role);
    allowedCardIds = views === "ALL" ? "ALL" : Array.from(views);
    const allowed = views === "ALL" ? ("ALL" as const) : views;
    const cardByHref = new Map<string, string>([
      [href.caisse, DASH_CARD.CAISSE],
      [href.sejours, DASH_CARD.SEJOURS],
      [href.chambres, DASH_CARD.CHAMBRES],
      [href.restauration, DASH_CARD.RESTAURATION],
      [href.cuisine, DASH_CARD.CUISINE],
      [href.partenaires, DASH_CARD.CLIENTS_PARTENAIRES],
      [href.mesCommandes, DASH_CARD.RAPPORT_MES_COMMANDES],
      [href.tableau, DASH_CARD.RAPPORT_TABLEAU],
    ]);
    const keep = (itemHref: string) =>
      canSeeDashCard(role, cardByHref.get(itemHref), allowed);
    shortcuts.splice(
      0,
      shortcuts.length,
      ...shortcuts.filter((s) => keep(s.href)),
    );
    focus.splice(0, focus.length, ...focus.filter((f) => keep(f.href)));
  }

  return {
    userName: session.user.name?.trim() || session.user.email || "Collègue",
    branchName: branch.name,
    branchType: type,
    hasStays,
    hasRestaurant,
    hasEau: branch.hasEau,
    hasVin: branch.hasVin,
    opsRole: role,
    roleLabel: opsRoleLabel(role),
    mission: missionFor(role, type, { hasStays, hasRestaurant }),
    kpis,
    shortcuts,
    focus,
    cashSessionOpen,
    allowedCardIds,
  };
}

export async function branchDashboardFingerprintAction(
  organizationId: string,
  branchId: string,
): Promise<string> {
  const data = await getBranchRoleDashboardAction(organizationId, branchId);
  return [
    data.opsRole,
    data.kpis.map((k) => `${k.key}:${k.value}`).join(","),
    data.focus.map((f) => `${f.title}:${f.count}`).join(","),
    String(data.cashSessionOpen),
  ].join("|");
}
