"use server";

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { canAccessBranch } from "@/lib/branch/user-branches";
import { getActiveExchangeRate } from "@/lib/cash/actions";
import { toReportExchangeRate } from "@/lib/cash/exchange";
import prisma from "@/lib/prisma";
import {
  dayKey,
  eachDayIso,
  endOfLocalDay,
  paymentAmountUsd,
  pctDelta,
  previousRange,
  startOfLocalDay,
} from "@/lib/hotel/reports/period";
import { flatStayCountdown } from "@/lib/hotel/stay-flat-countdown";
import { nightsBetween } from "@/lib/hotel/stay-nights";

function rangeBounds(from: string, to: string) {
  return { gte: startOfLocalDay(from), lte: endOfLocalDay(to) };
}

function paymentMethodLabel(method: string | null | undefined) {
  switch (method) {
    case "CASH":
      return "Espèces";
    case "MOBILE_MONEY":
      return "Mobile Money";
    case "CARTE":
      return "Carte";
    default:
      return method?.trim() || "Autre";
  }
}

function isExpensePayment(p: {
  expenseId?: string | null;
  note?: string | null;
}) {
  const note = p.note ?? "";
  return Boolean(
    p.expenseId ||
      note.startsWith("Dépense ·") ||
      note.startsWith("Dépôt à la banque ·") ||
      note.startsWith("Remise au propriétaire ·"),
  );
}

function isPurchaseOutflow(p: {
  purchaseOrderId?: string | null;
  usd: number;
  note?: string | null;
}) {
  return Boolean(
    p.purchaseOrderId &&
      (p.usd < 0 || (p.note ?? "").startsWith("Sortie achat")),
  );
}

function isPurchaseRefund(p: {
  purchaseOrderId?: string | null;
  usd: number;
  note?: string | null;
}) {
  return Boolean(
    p.purchaseOrderId &&
      (p.usd > 0 || (p.note ?? "").startsWith("Remboursement achat")),
  );
}

/** Encaissements métier (hors dépenses / bons de commande). */
function isRevenuePayment(p: {
  usd: number;
  purchaseOrderId?: string | null;
  expenseId?: string | null;
  note?: string | null;
}) {
  return (
    p.usd > 0 &&
    !p.purchaseOrderId &&
    !p.expenseId &&
    !(p.note ?? "").startsWith("Remboursement achat") &&
    !isExpensePayment(p)
  );
}

function expenseKindReportLabel(kind: string) {
  switch (kind) {
    case "DEPOT_BANQUE":
      return "Dépôt à la banque";
    case "REMISE_PROPRIETAIRE":
      return "Remise au propriétaire";
    default:
      return "Dépense";
  }
}

function purchaseOrderStatusLabel(status: string) {
  switch (status) {
    case "EN_ATTENTE":
      return "En attente";
    case "FONDS_SORTIS":
      return "Fonds sortis";
    case "VALIDE":
      return "Validé";
    case "ANNULE":
      return "Annulé";
    default:
      return status;
  }
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

async function resolveStaffNameMap(userIds: string[]) {
  const ids = [...new Set(userIds.filter(Boolean))];
  const map = new Map<string, string>();
  if (ids.length === 0) return map;
  const users = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, email: true },
  });
  for (const u of users) {
    map.set(u.id, (u.name?.trim() || u.email || "Utilisateur").trim());
  }
  return map;
}

async function requireOrgUser(organizationId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) throw new Error("Non authentifié.");
  return session.user;
}

export type OrgBranchOption = {
  id: string;
  name: string;
  code: string;
  type: string;
  hasStays: boolean;
};

export async function listOrgReportBranchesAction(organizationId: string) {
  const user = await requireOrgUser(organizationId);
  const branches = await prisma.branch.findMany({
    where: { organizationId, status: "ACTIVE" },
    orderBy: [{ type: "asc" }, { name: "asc" }],
    select: { id: true, name: true, code: true, type: true, hasStays: true },
  });

  const accessible: OrgBranchOption[] = [];
  for (const b of branches) {
    const ok = await canAccessBranch(user.id, user.role, b.id);
    if (ok) accessible.push(b);
  }
  return accessible;
}

async function resolveAccessibleBranches(
  organizationId: string,
  branchIds: string[],
) {
  const user = await requireOrgUser(organizationId);
  const ids = [...new Set(branchIds.filter(Boolean))];
  if (ids.length === 0) {
    throw new Error("Sélectionnez au moins une branche.");
  }

  const branches = await prisma.branch.findMany({
    where: { organizationId, id: { in: ids } },
    select: {
      id: true,
      name: true,
      code: true,
      type: true,
      hasStays: true,
    },
  });
  if (branches.length !== ids.length) {
    throw new Error("Branche invalide pour cette organisation.");
  }
  for (const b of branches) {
    const ok = await canAccessBranch(user.id, user.role, b.id);
    if (!ok) throw new Error(`Branche inaccessible : ${b.name}`);
  }

  return {
    ids,
    branches,
    nameById: new Map(branches.map((b) => [b.id, b.name])),
  };
}

type StockMoveRow = {
  id: string;
  branchId: string;
  kind: "ENTREE" | "SORTIE" | "AJUSTEMENT";
  quantity: number;
  createdAt: Date;
  productKey: string;
  productName: string;
  category: string;
  note: string | null;
  createdByUserId: string | null;
  source: "hotel" | "shop";
};

async function loadOrgStockMoves(branchIds: string[], from: string, to: string) {
  const [hotel, shop] = await Promise.all([
    prisma.hotelStockMovement.findMany({
      where: { branchId: { in: branchIds }, createdAt: rangeBounds(from, to) },
      select: {
        id: true,
        branchId: true,
        kind: true,
        quantity: true,
        createdAt: true,
        note: true,
        createdByUserId: true,
        menuItemId: true,
        menuItem: { select: { name: true, category: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.shopStockMovement.findMany({
      where: { branchId: { in: branchIds }, createdAt: rangeBounds(from, to) },
      select: {
        id: true,
        branchId: true,
        kind: true,
        quantity: true,
        createdAt: true,
        note: true,
        createdByUserId: true,
        productId: true,
        product: {
          select: { name: true, category: { select: { name: true } } },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const rows: StockMoveRow[] = [
    ...hotel.map((m) => ({
      id: m.id,
      branchId: m.branchId,
      kind: m.kind as StockMoveRow["kind"],
      quantity: m.quantity,
      createdAt: m.createdAt,
      productKey: `h:${m.menuItemId}`,
      productName: m.menuItem.name,
      category: m.menuItem.category,
      note: m.note,
      createdByUserId: m.createdByUserId,
      source: "hotel" as const,
    })),
    ...shop.map((m) => ({
      id: m.id,
      branchId: m.branchId,
      kind: m.kind as StockMoveRow["kind"],
      quantity: m.quantity,
      createdAt: m.createdAt,
      productKey: `s:${m.productId}`,
      productName: m.product.name,
      category: m.product.category.name,
      note: m.note,
      createdByUserId: m.createdByUserId,
      source: "shop" as const,
    })),
  ];
  return rows.sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
  );
}

function stockKindLabel(kind: StockMoveRow["kind"]) {
  switch (kind) {
    case "ENTREE":
      return "Entrée";
    case "SORTIE":
      return "Sortie";
    case "AJUSTEMENT":
      return "Ajustement";
    default:
      return kind;
  }
}

function branchTypeLabel(type: string) {
  switch (type) {
    case "AGENCE":
      return "Agence";
    case "HOTEL":
      return "Hôtel";
    case "RESTAURANT":
      return "Restaurant";
    case "BOUTIQUE":
      return "Commerce";
    default:
      return type;
  }
}

const BRANCH_TYPE_ORDER = ["HOTEL", "RESTAURANT", "BOUTIQUE", "AGENCE"] as const;

function groupLinesByBranchType<T extends { branchType: string }>(
  lines: T[],
  summarize: (groupLines: T[]) => Record<string, number>,
) {
  const grouped = new Map<string, T[]>();
  for (const l of lines) {
    const key = l.branchType || "AUTRE";
    const arr = grouped.get(key) ?? [];
    arr.push(l);
    grouped.set(key, arr);
  }
  const typeKeys = [
    ...BRANCH_TYPE_ORDER.filter((t) => grouped.has(t)),
    ...[...grouped.keys()]
      .filter((t) => !(BRANCH_TYPE_ORDER as readonly string[]).includes(t))
      .sort(),
  ];
  return typeKeys.map((type) => {
    const groupLines = grouped.get(type) ?? [];
    return {
      type,
      typeLabel: branchTypeLabel(type),
      lines: groupLines,
      totals: summarize(groupLines),
    };
  });
}

export async function getOrgAggregatedSalesReportAction(input: {
  organizationId: string;
  branchIds: string[];
  from: string;
  to: string;
}) {
  const { ids, branches, nameById } = await resolveAccessibleBranches(
    input.organizationId,
    input.branchIds,
  );
  const prev = previousRange(input.from, input.to);
  const days = eachDayIso(input.from, input.to);

  const payments = await prisma.payment.findMany({
    where: {
      branchId: { in: ids },
      paidAt: rangeBounds(input.from, input.to),
    },
    select: {
      id: true,
      branchId: true,
      paidAt: true,
      amountCdf: true,
      amountForeign: true,
      method: true,
      receiptNumber: true,
      cashierUserId: true,
      note: true,
      orderId: true,
      folioId: true,
      shopSaleId: true,
      purchaseOrderId: true,
      expenseId: true,
      order: {
        select: {
          tableLabel: true,
          createdByUserId: true,
          preparedByUserId: true,
          items: { select: { name: true, quantity: true } },
        },
      },
      shopSale: {
        select: {
          ticketNumber: true,
          cashierUserId: true,
          items: { select: { name: true, quantity: true } },
        },
      },
    },
    orderBy: { paidAt: "asc" },
  });

  const prevPayments = await prisma.payment.findMany({
    where: {
      branchId: { in: ids },
      paidAt: rangeBounds(prev.from, prev.to),
    },
    select: {
      amountCdf: true,
      amountForeign: true,
      branchId: true,
      note: true,
      purchaseOrderId: true,
      expenseId: true,
    },
  });

  // Taux : première branche sélectionnée (affichage)
  const rate = await getActiveExchangeRate(ids[0]!);
  const usdRate = rate?.rate ?? null;

  const staffNames = await resolveStaffNameMap([
    ...payments.map((p) => p.cashierUserId),
    ...payments
      .map((p) => p.shopSale?.cashierUserId)
      .filter((id): id is string => Boolean(id)),
    ...payments
      .map((p) => p.order?.createdByUserId)
      .filter((id): id is string => Boolean(id)),
    ...payments
      .map((p) => p.order?.preparedByUserId)
      .filter((id): id is string => Boolean(id)),
  ]);

  const withUsd = payments.map((p) => ({
    ...p,
    usd: paymentAmountUsd(p, usdRate),
    branchName: nameById.get(p.branchId) ?? "Branche",
  }));
  const revenuePays = withUsd.filter((p) => isRevenuePayment(p));
  const prevRevenuePays = prevPayments.filter((p) =>
    isRevenuePayment({
      ...p,
      usd: paymentAmountUsd(p, usdRate),
    }),
  );

  const ca = revenuePays.reduce((s, p) => s + p.usd, 0);
  const caPrev = prevRevenuePays.reduce(
    (s, p) => s + paymentAmountUsd(p, usdRate),
    0,
  );

  const ticketKeys = new Set<string>();
  for (const p of revenuePays) {
    ticketKeys.add(p.orderId ?? p.shopSaleId ?? p.folioId ?? p.id);
  }
  const tickets = ticketKeys.size;

  const prevTicketApprox = prevRevenuePays.length;
  const qtySold = revenuePays.reduce((s, p) => {
    const items = p.shopSale?.items ?? p.order?.items ?? [];
    return s + items.reduce((a, i) => a + i.quantity, 0);
  }, 0);

  const byDayMap = new Map<string, number>();
  const byMethodMap = new Map<string, number>();
  const byBranchMap = new Map<string, number>();

  for (const p of revenuePays) {
    const k = dayKey(p.paidAt);
    byDayMap.set(k, (byDayMap.get(k) ?? 0) + p.usd);
    byMethodMap.set(
      paymentMethodLabel(p.method),
      (byMethodMap.get(paymentMethodLabel(p.method)) ?? 0) + p.usd,
    );
    byBranchMap.set(
      p.branchName,
      (byBranchMap.get(p.branchName) ?? 0) + p.usd,
    );
  }

  const typeById = new Map(branches.map((b) => [b.id, b.type]));

  const lines = revenuePays.map((p) => {
    const items = p.shopSale?.items ?? p.order?.items ?? [];
    const itemsLabel =
      items.length > 0
        ? items.map((i) => `${i.name} ×${i.quantity}`).join(", ")
        : "—";
    const label =
      p.shopSale?.ticketNumber ??
      p.order?.tableLabel ??
      (p.folioId ? "Note chambre" : "Paiement");
    const cashierId = p.cashierUserId || p.shopSale?.cashierUserId || null;
    const branchType = typeById.get(p.branchId) ?? "AUTRE";
    const participants = [
      cashierId
        ? {
            role: "Caissier" as const,
            name: staffNames.get(cashierId) ?? "—",
          }
        : null,
      p.order?.createdByUserId
        ? {
            role: "Serveur" as const,
            name: staffNames.get(p.order.createdByUserId) ?? "—",
          }
        : null,
      p.order?.preparedByUserId
        ? {
            role: "Cuisinier" as const,
            name: staffNames.get(p.order.preparedByUserId) ?? "—",
          }
        : null,
    ].filter(
      (x): x is { role: "Caissier" | "Serveur" | "Cuisinier"; name: string } =>
        Boolean(x),
    );
    return {
      id: p.id,
      day: dayKey(p.paidAt),
      branchName: p.branchName,
      branchType,
      branchTypeLabel: branchTypeLabel(branchType),
      label,
      receiptNumber: p.receiptNumber,
      itemsLabel,
      method: paymentMethodLabel(p.method),
      usd: Number(p.usd) || 0,
      participants,
    };
  });

  // Même source que le tableau détail (évite donut vide si caByMethod mal sérialisé).
  const methodFromLines = new Map<string, number>();
  for (const l of lines) {
    if (!(l.usd > 0)) continue;
    methodFromLines.set(l.method, (methodFromLines.get(l.method) ?? 0) + l.usd);
  }

  const groupsByBranchType = groupLinesByBranchType(lines, (groupLines) => {
    const amount = groupLines.reduce((s, l) => s + l.usd, 0);
    return {
      amount,
      count: groupLines.length,
    };
  });

  return {
    period: { from: input.from, to: input.to },
    previous: prev,
    branches: branches.map((b) => ({
      id: b.id,
      name: b.name,
      type: b.type,
    })),
    kpis: {
      ca,
      caDelta: pctDelta(ca, caPrev),
      tickets,
      ticketsDelta: pctDelta(tickets, prevTicketApprox),
      qtySold,
      paymentsCount: revenuePays.length,
      avgTicket: tickets ? ca / tickets : 0,
      branchCount: ids.length,
    },
    caByDay: days.map((day) => ({
      day,
      value: byDayMap.get(day) ?? 0,
    })),
    caByMethod:
      methodFromLines.size > 0
        ? [...methodFromLines.entries()].map(([name, value]) => ({
            name,
            value: Number(value) || 0,
          }))
        : [...byMethodMap.entries()].map(([name, value]) => ({
            name,
            value: Number(value) || 0,
          })),
    caByBranch: [...byBranchMap.entries()]
      .map(([name, value]) => ({ name, value: Number(value) || 0 }))
      .sort((a, b) => b.value - a.value),
    lines,
    linesTotal: lines.reduce((s, l) => s + l.usd, 0),
    groupsByBranchType,
    rate: toReportExchangeRate(rate),
  };
}

export async function getOrgAggregatedPurchasesReportAction(input: {
  organizationId: string;
  branchIds: string[];
  from: string;
  to: string;
}) {
  const { ids, branches } = await resolveAccessibleBranches(
    input.organizationId,
    input.branchIds,
  );
  const prev = previousRange(input.from, input.to);
  const days = eachDayIso(input.from, input.to);
  const typeById = new Map(branches.map((b) => [b.id, b.type]));

  const [cur, prevMoves, rate] = await Promise.all([
    loadOrgStockMoves(ids, input.from, input.to),
    loadOrgStockMoves(ids, prev.from, prev.to),
    getActiveExchangeRate(ids[0]!),
  ]);

  const entrees = cur.filter((m) => m.kind === "ENTREE");
  const sorties = cur.filter((m) => m.kind === "SORTIE");
  const entreesPrev = prevMoves.filter((m) => m.kind === "ENTREE");
  const sortiesPrev = prevMoves.filter((m) => m.kind === "SORTIE");

  const qtyIn = entrees.reduce((s, m) => s + m.quantity, 0);
  const qtyOut = sorties.reduce((s, m) => s + m.quantity, 0);
  const qtyInPrev = entreesPrev.reduce((s, m) => s + m.quantity, 0);
  const qtyOutPrev = sortiesPrev.reduce((s, m) => s + m.quantity, 0);

  const inByDay = new Map<string, number>();
  const outByDay = new Map<string, number>();
  for (const m of cur) {
    const k = dayKey(m.createdAt);
    if (m.kind === "ENTREE") inByDay.set(k, (inByDay.get(k) ?? 0) + m.quantity);
    if (m.kind === "SORTIE") outByDay.set(k, (outByDay.get(k) ?? 0) + m.quantity);
  }

  const byProduct = new Map<
    string,
    {
      productKey: string;
      name: string;
      inQty: number;
      outQty: number;
      category: string;
      branchType: string;
      branchTypeLabel: string;
    }
  >();
  for (const m of cur) {
    if (m.kind !== "ENTREE" && m.kind !== "SORTIE") continue;
    const branchType = typeById.get(m.branchId) ?? "AUTRE";
    const key = `${branchType}:${m.productKey}`;
    const row = byProduct.get(key) ?? {
      productKey: m.productKey,
      name: m.productName,
      inQty: 0,
      outQty: 0,
      category: m.category,
      branchType,
      branchTypeLabel: branchTypeLabel(branchType),
    };
    if (m.kind === "ENTREE") row.inQty += m.quantity;
    else row.outQty += m.quantity;
    byProduct.set(key, row);
  }

  const productRows = [...byProduct.values()].sort(
    (a, b) => b.inQty + b.outQty - (a.inQty + a.outQty),
  );

  const groupsByBranchType = groupLinesByBranchType(productRows, (groupLines) => {
    const gIn = groupLines.reduce((s, l) => s + l.inQty, 0);
    const gOut = groupLines.reduce((s, l) => s + l.outQty, 0);
    return {
      qtyIn: gIn,
      qtyOut: gOut,
      net: gIn - gOut,
      products: groupLines.length,
    };
  });

  return {
    period: { from: input.from, to: input.to },
    branches: branches.map((b) => ({ id: b.id, name: b.name, type: b.type })),
    kpis: {
      qtyIn,
      qtyInDelta: pctDelta(qtyIn, qtyInPrev),
      qtyOut,
      qtyOutDelta: pctDelta(qtyOut, qtyOutPrev),
      net: qtyIn - qtyOut,
      netDelta: pctDelta(qtyIn - qtyOut, qtyInPrev - qtyOutPrev),
      linesIn: entrees.length,
      linesOut: sorties.length,
      branchCount: ids.length,
    },
    flowByDay: days.map((day) => ({
      day,
      entrees: inByDay.get(day) ?? 0,
      sorties: outByDay.get(day) ?? 0,
    })),
    byProduct: productRows.slice(0, 25),
    groupsByBranchType,
    rate: toReportExchangeRate(rate),
  };
}

export async function getOrgAggregatedStockReportAction(input: {
  organizationId: string;
  branchIds: string[];
  from: string;
  to: string;
}) {
  const { ids, branches, nameById } = await resolveAccessibleBranches(
    input.organizationId,
    input.branchIds,
  );
  const prev = previousRange(input.from, input.to);
  const days = eachDayIso(input.from, input.to);

  const [cur, prevMoves, rate] = await Promise.all([
    loadOrgStockMoves(ids, input.from, input.to),
    loadOrgStockMoves(ids, prev.from, prev.to),
    getActiveExchangeRate(ids[0]!),
  ]);

  const staffNames = await resolveStaffNameMap(
    cur
      .map((m) => m.createdByUserId)
      .filter((id): id is string => Boolean(id)),
  );

  const entrees = cur.filter((m) => m.kind === "ENTREE");
  const sorties = cur.filter((m) => m.kind === "SORTIE");
  const ajustements = cur.filter((m) => m.kind === "AJUSTEMENT");
  const entreesPrev = prevMoves.filter((m) => m.kind === "ENTREE");
  const sortiesPrev = prevMoves.filter((m) => m.kind === "SORTIE");

  const qtyIn = entrees.reduce((s, m) => s + m.quantity, 0);
  const qtyOut = sorties.reduce((s, m) => s + m.quantity, 0);
  const qtyAdj = ajustements.reduce((s, m) => s + m.quantity, 0);
  const qtyInPrev = entreesPrev.reduce((s, m) => s + m.quantity, 0);
  const qtyOutPrev = sortiesPrev.reduce((s, m) => s + m.quantity, 0);

  const inByDay = new Map<string, number>();
  const outByDay = new Map<string, number>();
  const byBranchMap = new Map<
    string,
    { name: string; inQty: number; outQty: number; adjQty: number }
  >();

  for (const m of cur) {
    const k = dayKey(m.createdAt);
    if (m.kind === "ENTREE") inByDay.set(k, (inByDay.get(k) ?? 0) + m.quantity);
    if (m.kind === "SORTIE") outByDay.set(k, (outByDay.get(k) ?? 0) + m.quantity);

    const bName = nameById.get(m.branchId) ?? "Branche";
    const bRow = byBranchMap.get(m.branchId) ?? {
      name: bName,
      inQty: 0,
      outQty: 0,
      adjQty: 0,
    };
    if (m.kind === "ENTREE") bRow.inQty += m.quantity;
    else if (m.kind === "SORTIE") bRow.outQty += m.quantity;
    else bRow.adjQty += m.quantity;
    byBranchMap.set(m.branchId, bRow);
  }

  const byProduct = new Map<
    string,
    {
      productKey: string;
      name: string;
      category: string;
      inQty: number;
      outQty: number;
      adjQty: number;
    }
  >();
  for (const m of cur) {
    const row = byProduct.get(m.productKey) ?? {
      productKey: m.productKey,
      name: m.productName,
      category: m.category,
      inQty: 0,
      outQty: 0,
      adjQty: 0,
    };
    if (m.kind === "ENTREE") row.inQty += m.quantity;
    else if (m.kind === "SORTIE") row.outQty += m.quantity;
    else row.adjQty += m.quantity;
    byProduct.set(m.productKey, row);
  }

  const typeById = new Map(branches.map((b) => [b.id, b.type]));

  const lines = cur.map((m) => {
    const branchType = typeById.get(m.branchId) ?? "AUTRE";
    return {
      id: m.id,
      day: dayKey(m.createdAt),
      branchId: m.branchId,
      branchName: nameById.get(m.branchId) ?? "Branche",
      branchType,
      branchTypeLabel: branchTypeLabel(branchType),
      productName: m.productName,
      category: m.category,
      kind: m.kind,
      kindLabel: stockKindLabel(m.kind),
      quantity: m.quantity,
      note: m.note ?? "—",
      userName: m.createdByUserId
        ? (staffNames.get(m.createdByUserId) ?? "—")
        : "—",
      source: m.source === "hotel" ? "Hôtel" : "Commerce",
    };
  });

  type StockLine = (typeof lines)[number];
  const grouped = new Map<string, StockLine[]>();
  for (const l of lines) {
    const key = l.branchType;
    const arr = grouped.get(key) ?? [];
    arr.push(l);
    grouped.set(key, arr);
  }

  const typeKeys = [
    ...BRANCH_TYPE_ORDER.filter((t) => grouped.has(t)),
    ...[...grouped.keys()]
      .filter((t) => !(BRANCH_TYPE_ORDER as readonly string[]).includes(t))
      .sort(),
  ];

  const groupsByBranchType = typeKeys.map((type) => {
    const groupLines = grouped.get(type) ?? [];
    let gIn = 0;
    let gOut = 0;
    let gAdj = 0;
    for (const l of groupLines) {
      if (l.kind === "ENTREE") gIn += l.quantity;
      else if (l.kind === "SORTIE") gOut += l.quantity;
      else gAdj += l.quantity;
    }
    return {
      type,
      typeLabel: branchTypeLabel(type),
      lines: groupLines,
      totals: {
        qtyIn: gIn,
        qtyOut: gOut,
        qtyAdj: gAdj,
        net: gIn - gOut,
        movements: groupLines.length,
      },
    };
  });

  return {
    period: { from: input.from, to: input.to },
    branches: branches.map((b) => ({ id: b.id, name: b.name, type: b.type })),
    kpis: {
      qtyIn,
      qtyInDelta: pctDelta(qtyIn, qtyInPrev),
      qtyOut,
      qtyOutDelta: pctDelta(qtyOut, qtyOutPrev),
      qtyAdj,
      net: qtyIn - qtyOut,
      netDelta: pctDelta(qtyIn - qtyOut, qtyInPrev - qtyOutPrev),
      movements: cur.length,
      linesIn: entrees.length,
      linesOut: sorties.length,
      branchCount: ids.length,
    },
    flowByDay: days.map((day) => ({
      day,
      entrees: inByDay.get(day) ?? 0,
      sorties: outByDay.get(day) ?? 0,
    })),
    byBranch: [...byBranchMap.values()].sort(
      (a, b) => b.inQty + b.outQty - (a.inQty + a.outQty),
    ),
    byProduct: [...byProduct.values()]
      .sort((a, b) => b.inQty + b.outQty - (a.inQty + a.outQty))
      .slice(0, 30),
    lines,
    groupsByBranchType,
    rate: toReportExchangeRate(rate),
  };
}

export async function getOrgAggregatedArticlesReportAction(input: {
  organizationId: string;
  branchIds: string[];
  from: string;
  to: string;
}) {
  const { ids, branches, nameById } = await resolveAccessibleBranches(
    input.organizationId,
    input.branchIds,
  );
  const prev = previousRange(input.from, input.to);
  const days = eachDayIso(input.from, input.to);
  const typeById = new Map(branches.map((b) => [b.id, b.type]));

  const [orders, shopSales, prevOrders, prevShopSales, moves, rate] =
    await Promise.all([
      prisma.hotelOrder.findMany({
        where: {
          branchId: { in: ids },
          status: { in: ["PAYEE", "LIVREE"] },
          OR: [
            { paidAt: rangeBounds(input.from, input.to) },
            { paidAt: null, deliveredAt: rangeBounds(input.from, input.to) },
            {
              paidAt: null,
              deliveredAt: null,
              createdAt: rangeBounds(input.from, input.to),
            },
          ],
        },
        select: {
          branchId: true,
          paidAt: true,
          deliveredAt: true,
          createdAt: true,
          items: {
            select: {
              name: true,
              quantity: true,
              amount: true,
              menuItemId: true,
              menuItem: { select: { category: true } },
            },
          },
        },
      }),
      prisma.shopSale.findMany({
        where: {
          branchId: { in: ids },
          status: "ENCAISSEE",
          paidAt: rangeBounds(input.from, input.to),
        },
        select: {
          branchId: true,
          paidAt: true,
          items: {
            select: {
              name: true,
              quantity: true,
              unitPrice: true,
              productId: true,
              kind: true,
            },
          },
        },
      }),
      prisma.hotelOrder.findMany({
        where: {
          branchId: { in: ids },
          status: { in: ["PAYEE", "LIVREE"] },
          OR: [
            { paidAt: rangeBounds(prev.from, prev.to) },
            { paidAt: null, deliveredAt: rangeBounds(prev.from, prev.to) },
            {
              paidAt: null,
              deliveredAt: null,
              createdAt: rangeBounds(prev.from, prev.to),
            },
          ],
        },
        select: {
          branchId: true,
          items: { select: { name: true, quantity: true, menuItemId: true } },
        },
      }),
      prisma.shopSale.findMany({
        where: {
          branchId: { in: ids },
          status: "ENCAISSEE",
          paidAt: rangeBounds(prev.from, prev.to),
        },
        select: {
          branchId: true,
          items: {
            select: { name: true, quantity: true, productId: true },
          },
        },
      }),
      loadOrgStockMoves(ids, input.from, input.to),
      getActiveExchangeRate(ids[0]!),
    ]);

  type Agg = {
    day: string;
    name: string;
    category: string;
    qty: number;
    revenue: number;
    stockOut: number;
    branchId: string;
    branchName: string;
    branchType: string;
    branchTypeLabel: string;
    productKey: string;
  };
  const map = new Map<string, Agg>();
  /** Comparaison période préc. par branche+produit (sans jour). */
  const prevMap = new Map<string, number>();
  const soldByDay = new Map<string, number>();

  for (const o of orders) {
    const branchType = typeById.get(o.branchId) ?? "AUTRE";
    const branchName = nameById.get(o.branchId) ?? "Branche";
    const when = o.paidAt ?? o.deliveredAt ?? o.createdAt;
    const day = dayKey(when);
    let dayQty = 0;
    for (const i of o.items) {
      const productKey = i.menuItemId ? `h:${i.menuItemId}` : `hn:${i.name}`;
      const key = `${o.branchId}:${day}:${productKey}`;
      const row = map.get(key) ?? {
        day,
        name: i.name,
        category: i.menuItem?.category ?? "Divers",
        qty: 0,
        revenue: 0,
        stockOut: 0,
        branchId: o.branchId,
        branchName,
        branchType,
        branchTypeLabel: branchTypeLabel(branchType),
        productKey,
      };
      row.qty += i.quantity;
      row.revenue += i.amount;
      dayQty += i.quantity;
      map.set(key, row);
    }
    soldByDay.set(day, (soldByDay.get(day) ?? 0) + dayQty);
  }

  for (const s of shopSales) {
    const branchType = typeById.get(s.branchId) ?? "AUTRE";
    const branchName = nameById.get(s.branchId) ?? "Branche";
    const day = dayKey(s.paidAt ?? new Date());
    let dayQty = 0;
    for (const i of s.items) {
      const productKey = i.productId ? `s:${i.productId}` : `sn:${i.name}`;
      const key = `${s.branchId}:${day}:${productKey}`;
      const row = map.get(key) ?? {
        day,
        name: i.name,
        category: i.kind === "PLAT" ? "Plat" : "Article",
        qty: 0,
        revenue: 0,
        stockOut: 0,
        branchId: s.branchId,
        branchName,
        branchType,
        branchTypeLabel: branchTypeLabel(branchType),
        productKey,
      };
      row.qty += i.quantity;
      row.revenue += i.unitPrice * i.quantity;
      dayQty += i.quantity;
      map.set(key, row);
    }
    soldByDay.set(day, (soldByDay.get(day) ?? 0) + dayQty);
  }

  for (const o of prevOrders) {
    for (const i of o.items) {
      const productKey = i.menuItemId ? `h:${i.menuItemId}` : `hn:${i.name}`;
      const key = `${o.branchId}:${productKey}`;
      prevMap.set(key, (prevMap.get(key) ?? 0) + i.quantity);
    }
  }
  for (const s of prevShopSales) {
    for (const i of s.items) {
      const productKey = i.productId ? `s:${i.productId}` : `sn:${i.name}`;
      const key = `${s.branchId}:${productKey}`;
      prevMap.set(key, (prevMap.get(key) ?? 0) + i.quantity);
    }
  }

  for (const m of moves) {
    if (m.kind !== "SORTIE") continue;
    const branchType = typeById.get(m.branchId) ?? "AUTRE";
    const branchName = nameById.get(m.branchId) ?? "Branche";
    const day = dayKey(m.createdAt);
    const key = `${m.branchId}:${day}:${m.productKey}`;
    const row = map.get(key) ?? {
      day,
      name: m.productName,
      category: m.category,
      qty: 0,
      revenue: 0,
      stockOut: 0,
      branchId: m.branchId,
      branchName,
      branchType,
      branchTypeLabel: branchTypeLabel(branchType),
      productKey: m.productKey,
    };
    row.stockOut += m.quantity;
    map.set(key, row);
  }

  const articles = [...map.entries()]
    .map(([id, a]) => ({
      id,
      ...a,
      qtyDelta: pctDelta(
        a.qty,
        prevMap.get(`${a.branchId}:${a.productKey}`) ?? 0,
      ),
    }))
    .sort((a, b) => {
      const byDay = a.day.localeCompare(b.day);
      if (byDay !== 0) return byDay;
      return b.qty - a.qty;
    });

  const byCategory = new Map<string, number>();
  for (const a of articles) {
    byCategory.set(a.category, (byCategory.get(a.category) ?? 0) + a.qty);
  }

  const totalQty = articles.reduce((s, a) => s + a.qty, 0);
  const totalRev = articles.reduce((s, a) => s + a.revenue, 0);
  const totalPrev = [...prevMap.values()].reduce((s, n) => s + n, 0);

  const groupsByBranchType = groupLinesByBranchType(articles, (groupLines) => ({
    qty: groupLines.reduce((s, a) => s + a.qty, 0),
    revenue: groupLines.reduce((s, a) => s + a.revenue, 0),
    stockOut: groupLines.reduce((s, a) => s + a.stockOut, 0),
    articles: groupLines.filter((a) => a.qty > 0).length,
  }));

  return {
    period: { from: input.from, to: input.to },
    branches: branches.map((b) => ({ id: b.id, name: b.name, type: b.type })),
    kpis: {
      articles: articles.filter((a) => a.qty > 0).length,
      qty: totalQty,
      qtyDelta: pctDelta(totalQty, totalPrev),
      revenue: totalRev,
      stockOut: articles.reduce((s, a) => s + a.stockOut, 0),
      branchCount: ids.length,
    },
    topArticles: articles.slice(0, 20),
    groupsByBranchType,
    byCategory: [...byCategory.entries()].map(([name, value]) => ({
      name,
      value,
    })),
    soldByDay: days.map((day) => ({
      day,
      value: soldByDay.get(day) ?? 0,
    })),
    rate: toReportExchangeRate(rate),
  };
}

export async function getOrgAggregatedFinanceReportAction(input: {
  organizationId: string;
  branchIds: string[];
  from: string;
  to: string;
}) {
  const { ids, branches, nameById } = await resolveAccessibleBranches(
    input.organizationId,
    input.branchIds,
  );
  const prev = previousRange(input.from, input.to);
  const days = eachDayIso(input.from, input.to);

  const [
    pays,
    prevPays,
    moves,
    prevMoves,
    folioLines,
    expensesRows,
    purchaseOrders,
    rate,
  ] = await Promise.all([
    prisma.payment.findMany({
      where: {
        branchId: { in: ids },
        paidAt: rangeBounds(input.from, input.to),
      },
      select: {
        id: true,
        branchId: true,
        amountCdf: true,
        amountForeign: true,
        method: true,
        paidAt: true,
        receiptNumber: true,
        note: true,
        orderId: true,
        folioId: true,
        shopSaleId: true,
        purchaseOrderId: true,
        expenseId: true,
        order: {
          select: {
            tableLabel: true,
            items: { select: { name: true, quantity: true } },
          },
        },
        shopSale: {
          select: {
            ticketNumber: true,
            items: { select: { name: true, quantity: true } },
          },
        },
        purchaseOrder: {
          select: { number: true, supplierName: true },
        },
        expense: {
          select: {
            number: true,
            kind: true,
            label: true,
            category: true,
            beneficiary: true,
          },
        },
      },
      orderBy: { paidAt: "asc" },
    }),
    prisma.payment.findMany({
      where: {
        branchId: { in: ids },
        paidAt: rangeBounds(prev.from, prev.to),
      },
      select: {
        amountCdf: true,
        amountForeign: true,
        note: true,
        purchaseOrderId: true,
        expenseId: true,
      },
    }),
    loadOrgStockMoves(ids, input.from, input.to),
    loadOrgStockMoves(ids, prev.from, prev.to),
    prisma.folioLine.findMany({
      where: {
        folio: { branchId: { in: ids } },
        createdAt: rangeBounds(input.from, input.to),
      },
      select: { kind: true, amount: true },
    }),
    prisma.branchExpense.findMany({
      where: {
        branchId: { in: ids },
        createdAt: rangeBounds(input.from, input.to),
      },
      select: {
        id: true,
        branchId: true,
        number: true,
        kind: true,
        label: true,
        category: true,
        beneficiary: true,
        amountUsd: true,
        note: true,
        createdAt: true,
        createdByUserId: true,
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.purchaseOrder.findMany({
      where: {
        branchId: { in: ids },
        OR: [
          { createdAt: rangeBounds(input.from, input.to) },
          { validatedAt: rangeBounds(input.from, input.to) },
        ],
      },
      select: {
        id: true,
        branchId: true,
        number: true,
        status: true,
        supplierName: true,
        note: true,
        totalAmountUsd: true,
        fundsReleasedUsd: true,
        validatedAmountUsd: true,
        createdAt: true,
        validatedAt: true,
        createdByUserId: true,
        items: {
          select: { name: true, quantity: true, receivedQty: true },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
    getActiveExchangeRate(ids[0]!),
  ]);

  const usdRate = rate?.rate ?? null;
  const paysUsd = pays.map((p) => ({
    ...p,
    usd: paymentAmountUsd(p, usdRate),
    branchName: nameById.get(p.branchId) ?? "Branche",
  }));
  const prevPaysUsd = prevPays.map((p) => ({
    ...p,
    usd: paymentAmountUsd(p, usdRate),
  }));

  const revenue = paysUsd
    .filter((p) => isRevenuePayment(p))
    .reduce((s, p) => s + p.usd, 0);
  const revenuePrev = prevPaysUsd
    .filter((p) => isRevenuePayment(p))
    .reduce((s, p) => s + p.usd, 0);

  const expenses = paysUsd
    .filter((p) => isExpensePayment(p))
    .reduce((s, p) => s + Math.abs(p.usd), 0);
  const expensesPrev = prevPaysUsd
    .filter((p) => isExpensePayment(p))
    .reduce((s, p) => s + Math.abs(p.usd), 0);

  const purchasesGross = paysUsd
    .filter((p) => isPurchaseOutflow(p))
    .reduce((s, p) => s + Math.abs(Math.min(p.usd, 0)), 0);
  const purchaseRefunds = paysUsd
    .filter((p) => isPurchaseRefund(p))
    .reduce((s, p) => s + Math.max(p.usd, 0), 0);
  const netPurchases = Math.max(0, round2(purchasesGross - purchaseRefunds));
  const netCash = round2(revenue - expenses - netPurchases);

  const qtyIn = moves
    .filter((m) => m.kind === "ENTREE")
    .reduce((s, m) => s + m.quantity, 0);
  const qtyOut = moves
    .filter((m) => m.kind === "SORTIE")
    .reduce((s, m) => s + m.quantity, 0);
  const qtyInPrev = prevMoves
    .filter((m) => m.kind === "ENTREE")
    .reduce((s, m) => s + m.quantity, 0);
  const qtyOutPrev = prevMoves
    .filter((m) => m.kind === "SORTIE")
    .reduce((s, m) => s + m.quantity, 0);

  const revByDay = new Map<string, number>();
  const expByDay = new Map<string, number>();
  const poByDay = new Map<string, number>();
  const byBranchMap = new Map<string, number>();
  for (const p of paysUsd) {
    const k = dayKey(p.paidAt);
    if (isRevenuePayment(p)) {
      revByDay.set(k, (revByDay.get(k) ?? 0) + p.usd);
      byBranchMap.set(
        p.branchName,
        (byBranchMap.get(p.branchName) ?? 0) + p.usd,
      );
    } else if (isExpensePayment(p)) {
      expByDay.set(k, (expByDay.get(k) ?? 0) + Math.abs(p.usd));
    } else if (isPurchaseOutflow(p)) {
      poByDay.set(k, (poByDay.get(k) ?? 0) + Math.abs(Math.min(p.usd, 0)));
    }
  }
  const inByDay = new Map<string, number>();
  const outByDay = new Map<string, number>();
  for (const m of moves) {
    const k = dayKey(m.createdAt);
    if (m.kind === "ENTREE") inByDay.set(k, (inByDay.get(k) ?? 0) + m.quantity);
    if (m.kind === "SORTIE") outByDay.set(k, (outByDay.get(k) ?? 0) + m.quantity);
  }

  const byKind = new Map<string, number>();
  for (const l of folioLines) {
    byKind.set(l.kind, (byKind.get(l.kind) ?? 0) + l.amount);
  }

  const typeById = new Map(branches.map((b) => [b.id, b.type]));
  const staffNames = await resolveStaffNameMap([
    ...expensesRows.map((e) => e.createdByUserId),
    ...purchaseOrders.map((po) => po.createdByUserId),
  ]);

  const revenueLines = paysUsd.filter((p) => isRevenuePayment(p)).map((p) => {
    const items = p.shopSale?.items ?? p.order?.items ?? [];
    const itemsLabel =
      items.length > 0
        ? items.map((i) => `${i.name} ×${i.quantity}`).join(", ")
        : "—";
    const label =
      p.shopSale?.ticketNumber ??
      p.order?.tableLabel ??
      (p.folioId ? "Note chambre" : "Paiement");
    const branchType = typeById.get(p.branchId) ?? "AUTRE";
    return {
      id: p.id,
      day: dayKey(p.paidAt),
      branchName: p.branchName,
      branchType,
      branchTypeLabel: branchTypeLabel(branchType),
      label,
      receiptNumber: p.receiptNumber,
      itemsLabel,
      method: paymentMethodLabel(p.method),
      usd: Number(p.usd) || 0,
    };
  });

  const methodFromLines = new Map<string, number>();
  for (const l of revenueLines) {
    if (!(l.usd > 0)) continue;
    methodFromLines.set(l.method, (methodFromLines.get(l.method) ?? 0) + l.usd);
  }
  const revenueByMethod = [...methodFromLines.entries()].map(
    ([name, value]) => ({
      name,
      value: Number(value) || 0,
    }),
  );

  const groupsByBranchType = groupLinesByBranchType(
    revenueLines,
    (groupLines) => ({
      amount: groupLines.reduce((s, l) => s + l.usd, 0),
      count: groupLines.length,
    }),
  );

  const expenseLines = expensesRows.map((e) => {
    const branchType = typeById.get(e.branchId) ?? "AUTRE";
    return {
      id: e.id,
      day: dayKey(e.createdAt),
      branchId: e.branchId,
      branchName: nameById.get(e.branchId) ?? "Branche",
      branchType,
      branchTypeLabel: branchTypeLabel(branchType),
      number: e.number,
      kind: e.kind,
      kindLabel: expenseKindReportLabel(e.kind),
      label: e.label,
      category: e.category,
      beneficiary: e.beneficiary ?? "—",
      note: e.note ?? "—",
      amountUsd: e.amountUsd,
      userName: staffNames.get(e.createdByUserId) ?? "—",
    };
  });

  const expensesByKindMap = new Map<string, number>();
  for (const e of expenseLines) {
    expensesByKindMap.set(
      e.kindLabel,
      (expensesByKindMap.get(e.kindLabel) ?? 0) + e.amountUsd,
    );
  }

  const expenseGroupsByBranchType = groupLinesByBranchType(
    expenseLines,
    (groupLines) => ({
      amount: groupLines.reduce((s, l) => s + l.amountUsd, 0),
      count: groupLines.length,
    }),
  );

  const purchaseOrderLines = purchaseOrders.map((po) => {
    const branchType = typeById.get(po.branchId) ?? "AUTRE";
    const itemsLabel =
      po.items.length > 0
        ? po.items
            .map((i) => {
              const qty =
                i.receivedQty != null ? `${i.receivedQty}/${i.quantity}` : `${i.quantity}`;
              return `${i.name} ×${qty}`;
            })
            .join(", ")
        : "—";
    return {
      id: po.id,
      day: dayKey(po.validatedAt ?? po.createdAt),
      createdDay: dayKey(po.createdAt),
      validatedDay: po.validatedAt ? dayKey(po.validatedAt) : null,
      branchId: po.branchId,
      branchName: nameById.get(po.branchId) ?? "Branche",
      branchType,
      branchTypeLabel: branchTypeLabel(branchType),
      number: po.number,
      status: po.status,
      statusLabel: purchaseOrderStatusLabel(po.status),
      supplierName: po.supplierName?.trim() || "—",
      note: po.note ?? "—",
      itemsLabel,
      totalAmountUsd: po.totalAmountUsd,
      fundsReleasedUsd: po.fundsReleasedUsd,
      validatedAmountUsd: po.validatedAmountUsd,
      userName: staffNames.get(po.createdByUserId) ?? "—",
    };
  });

  const purchaseGroupsByBranchType = groupLinesByBranchType(
    purchaseOrderLines,
    (groupLines) => ({
      count: groupLines.length,
      total: groupLines.reduce((s, l) => s + l.totalAmountUsd, 0),
      funds: groupLines.reduce((s, l) => s + l.fundsReleasedUsd, 0),
      validated: groupLines.reduce(
        (s, l) => s + (l.validatedAmountUsd ?? 0),
        0,
      ),
    }),
  );

  const purchasesByStatusMap = new Map<string, number>();
  for (const po of purchaseOrderLines) {
    purchasesByStatusMap.set(
      po.statusLabel,
      (purchasesByStatusMap.get(po.statusLabel) ?? 0) + 1,
    );
  }

  return {
    period: { from: input.from, to: input.to },
    branches: branches.map((b) => ({ id: b.id, name: b.name, type: b.type })),
    kpis: {
      revenue,
      revenueDelta: pctDelta(revenue, revenuePrev),
      expenses,
      expensesDelta: pctDelta(expenses, expensesPrev),
      purchases: netPurchases,
      purchasesCount: purchaseOrderLines.length,
      expensesCount: expenseLines.length,
      netCash,
      qtyIn,
      qtyInDelta: pctDelta(qtyIn, qtyInPrev),
      qtyOut,
      qtyOutDelta: pctDelta(qtyOut, qtyOutPrev),
      coverage:
        qtyOut > 0 ? Math.round((revenue / qtyOut) * 100) / 100 : revenue,
      branchCount: ids.length,
    },
    revenueByDay: days.map((day) => ({
      day,
      value: revByDay.get(day) ?? 0,
    })),
    cashOutByDay: days.map((day) => ({
      day,
      depenses: expByDay.get(day) ?? 0,
      bons: poByDay.get(day) ?? 0,
    })),
    flowByDay: days.map((day) => ({
      day,
      revenus: revByDay.get(day) ?? 0,
      entrees: inByDay.get(day) ?? 0,
      sorties: outByDay.get(day) ?? 0,
    })),
    revenueByMethod,
    revenueByBranch: [...byBranchMap.entries()]
      .map(([name, value]) => ({ name, value: Number(value) || 0 }))
      .sort((a, b) => b.value - a.value),
    folioByKind: [...byKind.entries()].map(([name, value]) => ({
      name,
      value: Number(value) || 0,
    })),
    expensesByKind: [...expensesByKindMap.entries()]
      .map(([name, value]) => ({ name, value: Number(value) || 0 }))
      .sort((a, b) => b.value - a.value),
    purchasesByStatus: [...purchasesByStatusMap.entries()]
      .map(([name, value]) => ({ name, value: Number(value) || 0 }))
      .sort((a, b) => b.value - a.value),
    lines: revenueLines,
    linesTotal: revenueLines.reduce((s, l) => s + l.usd, 0),
    groupsByBranchType,
    expenses: {
      lines: expenseLines,
      linesTotal: expenseLines.reduce((s, l) => s + l.amountUsd, 0),
      groupsByBranchType: expenseGroupsByBranchType,
    },
    purchaseOrders: {
      lines: purchaseOrderLines,
      linesTotal: purchaseOrderLines.reduce((s, l) => s + l.totalAmountUsd, 0),
      fundsTotal: purchaseOrderLines.reduce((s, l) => s + l.fundsReleasedUsd, 0),
      groupsByBranchType: purchaseGroupsByBranchType,
    },
    rate: toReportExchangeRate(rate),
  };
}

function stayStatusLabel(status: string) {
  switch (status) {
    case "RESERVED":
      return "Réservé";
    case "CHECKED_IN":
      return "Occupé";
    case "CHECKED_OUT":
      return "Check-out";
    case "CANCELLED":
      return "Annulé";
    case "NO_SHOW":
      return "No-show";
    default:
      return status;
  }
}

function spaceKindLabel(kind: string) {
  return kind === "MEETING" ? "Salle" : "Chambre";
}

/** USD signé (encaissement > 0, remboursement < 0). */
function paymentUsdSigned(
  p: { amountCdf: number; amountForeign?: number | null },
  usdToCdfRate: number | null,
) {
  if (p.amountForeign != null && p.amountForeign !== 0) return p.amountForeign;
  if (usdToCdfRate && usdToCdfRate > 0) return p.amountCdf / usdToCdfRate;
  return p.amountCdf;
}

function stayDurationFields(s: {
  billingMode: string;
  plannedHours: number | null;
  status: string;
  checkInDate: Date;
  checkOutDate: Date;
  checkedInAt: Date | null;
}) {
  const isFlat = s.billingMode === "FLAT";
  if (isFlat) {
    const hours = s.plannedHours ?? 0;
    const durationLabel = hours > 0 ? `${hours} h` : "Passage";
    let remainingLabel: string | null = null;
    let remainingTone: "normal" | "warn" | "critical" | null = null;
    if (s.status === "CHECKED_IN" && s.checkedInAt && hours > 0) {
      const cd = flatStayCountdown({
        plannedHours: hours,
        checkedInAt: s.checkedInAt,
      });
      if (cd) {
        remainingLabel = cd.overdue
          ? `Dépassé ${cd.remainingLabel}`
          : `${cd.remainingLabel} rest.`;
        remainingTone = cd.tone;
      }
    } else if (s.status === "RESERVED" && hours > 0) {
      remainingLabel = `${hours} h prévues`;
    }
    return {
      durationDays: null as number | null,
      durationHours: hours > 0 ? hours : null,
      durationLabel,
      remainingLabel,
      remainingTone,
    };
  }

  const days = nightsBetween(s.checkInDate, s.checkOutDate);
  const durationLabel = `${days} jour${days > 1 ? "s" : ""}`;
  let remainingLabel: string | null = null;
  let remainingTone: "normal" | "warn" | "critical" | null = null;
  if (s.status === "RESERVED" || s.status === "CHECKED_IN") {
    const today = new Date();
    const todayUtc = new Date(
      Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()),
    );
    const out = new Date(
      Date.UTC(
        s.checkOutDate.getUTCFullYear(),
        s.checkOutDate.getUTCMonth(),
        s.checkOutDate.getUTCDate(),
      ),
    );
    const remaining = Math.max(
      0,
      Math.ceil((out.getTime() - todayUtc.getTime()) / 86_400_000),
    );
    if (s.status === "RESERVED") {
      remainingLabel = `${days} jour${days > 1 ? "s" : ""} réservés`;
    } else if (remaining === 0) {
      remainingLabel = "Départ aujourd’hui";
      remainingTone = "critical";
    } else {
      remainingLabel = `${remaining} j restant${remaining > 1 ? "s" : ""}`;
      remainingTone = remaining <= 1 ? "warn" : "normal";
    }
  }
  return {
    durationDays: days,
    durationHours: null as number | null,
    durationLabel,
    remainingLabel,
    remainingTone,
  };
}

function nightsOverlap(
  stayIn: Date,
  stayOut: Date,
  rangeFrom: Date,
  rangeToExclusive: Date,
) {
  const start = stayIn > rangeFrom ? stayIn : rangeFrom;
  const end = stayOut < rangeToExclusive ? stayOut : rangeToExclusive;
  const ms = end.getTime() - start.getTime();
  if (ms <= 0) return 0;
  return Math.max(0, Math.round(ms / 86_400_000));
}

export async function getOrgAggregatedOccupancyReportAction(input: {
  organizationId: string;
  branchIds: string[];
  from: string;
  to: string;
}) {
  const { branches, nameById } = await resolveAccessibleBranches(
    input.organizationId,
    input.branchIds,
  );
  const staysBranches = branches.filter(
    (b) =>
      b.hasStays && (b.type === "HOTEL" || b.type === "RESTAURANT"),
  );
  const staysIds = staysBranches.map((b) => b.id);
  const days = eachDayIso(input.from, input.to);
  const fromDay = startOfLocalDay(input.from);
  const toDay = startOfLocalDay(input.to);
  const bounds = rangeBounds(input.from, input.to);
  const prev = previousRange(input.from, input.to);
  const prevBounds = rangeBounds(prev.from, prev.to);

  type OccupancyLine = {
    id: string;
    day: string;
    branchId: string;
    branchName: string;
    branchType: string;
    guestName: string;
    roomNumber: string;
    roomTypeName: string;
    spaceKind: "ROOM" | "MEETING";
    spaceKindLabel: string;
    status: string;
    statusLabel: string;
    checkInDate: string;
    checkOutDate: string;
    checkedInAt: string | null;
    checkedOutAt: string | null;
    billingMode: string;
    durationDays: number | null;
    durationHours: number | null;
    durationLabel: string;
    remainingLabel: string | null;
    remainingTone: "normal" | "warn" | "critical" | null;
    event: "reservation" | "check_in" | "check_out" | "stay";
    eventLabel: string;
  };

  type OccupancyFinanceBranch = {
    branchId: string;
    branchName: string;
    branchType: string;
    branchTypeLabel: string;
    collected: number;
    expected: number;
    refunded: number;
    refundDue: number;
    /** Encaissé − remboursé (net réel période). */
    netCash: number;
  };

  type OccupancyFinanceDetail = {
    id: string;
    folioId: string;
    branchId: string;
    branchName: string;
    branchType: string;
    branchTypeLabel: string;
    guestName: string;
    roomNumber: string;
    roomTypeName: string;
    spaceKindLabel: string;
    status: string;
    statusLabel: string;
    checkInDate: string;
    checkOutDate: string;
    billingMode: string;
    charges: number;
    paid: number;
    collected: number;
    expected: number;
    refunded: number;
    refundDue: number;
    balance: number;
    /** Encaissé − remboursé sur la période. */
    netCash: number;
    paymentsLabel: string;
  };

  const emptyFinance = {
    collected: 0,
    expected: 0,
    refunded: 0,
    refundDue: 0,
    netCash: 0,
    byBranch: [] as OccupancyFinanceBranch[],
    details: [] as OccupancyFinanceDetail[],
  };

  const emptyResult = {
    period: { from: input.from, to: input.to },
    staysBranchCount: 0,
    kpis: {
      reservations: 0,
      checkIns: 0,
      checkOuts: 0,
      occupied: 0,
      rooms: 0,
      meetings: 0,
      occupancyPct: 0,
      checkInsDelta: 0,
      checkOutsDelta: 0,
    },
    eventsByDay: days.map((day) => ({
      day,
      checkIns: 0,
      checkOuts: 0,
      reservations: 0,
    })),
    bySpaceKind: [] as { name: string; value: number }[],
    byBranch: [] as { name: string; value: number }[],
    byStatus: [] as { name: string; value: number }[],
    lines: [] as OccupancyLine[],
    groupsByBranchType: [] as Array<{
      type: string;
      typeLabel: string;
      lines: OccupancyLine[];
      totals: {
        stays: number;
        checkIns: number;
        checkOuts: number;
        reserved: number;
      };
    }>,
    finance: emptyFinance,
  };

  if (staysIds.length === 0) return emptyResult;

  const typeByBranch = new Map(staysBranches.map((b) => [b.id, b.type]));

  const [stays, prevCheckIns, prevCheckOuts, rooms, rate] = await Promise.all([
    prisma.hotelStay.findMany({
      where: {
        branchId: { in: staysIds },
        status: { notIn: ["CANCELLED", "NO_SHOW"] },
        checkInDate: { lte: endOfLocalDay(input.to) },
        checkOutDate: { gte: startOfLocalDay(input.from) },
      },
      select: {
        id: true,
        branchId: true,
        guestName: true,
        status: true,
        billingMode: true,
        plannedHours: true,
        checkInDate: true,
        checkOutDate: true,
        checkedInAt: true,
        checkedOutAt: true,
        room: {
          select: {
            number: true,
            roomType: { select: { name: true, kind: true } },
          },
        },
      },
      orderBy: [{ checkInDate: "asc" }, { guestName: "asc" }],
    }),
    prisma.hotelStay.count({
      where: {
        branchId: { in: staysIds },
        checkedInAt: prevBounds,
      },
    }),
    prisma.hotelStay.count({
      where: {
        branchId: { in: staysIds },
        checkedOutAt: prevBounds,
      },
    }),
    prisma.hotelRoom.findMany({
      where: { roomType: { branchId: { in: staysIds } } },
      select: {
        id: true,
        roomType: { select: { branchId: true, kind: true } },
      },
    }),
    getActiveExchangeRate(staysIds[0]!),
  ]);

  const usdRate = rate?.rate ?? null;
  const stayIds = stays.map((s) => s.id);
  const folios =
    stayIds.length === 0
      ? []
      : await prisma.folio.findMany({
          where: {
            branchId: { in: staysIds },
            stayId: { in: stayIds },
          },
          select: {
            id: true,
            branchId: true,
            stayId: true,
            lines: { select: { amount: true } },
            payments: {
              select: {
                amountCdf: true,
                amountForeign: true,
                paidAt: true,
                receiptNumber: true,
                method: true,
              },
            },
          },
        });

  const roomCount = rooms.filter((r) => r.roomType.kind === "ROOM").length;
  const meetingCount = rooms.filter((r) => r.roomType.kind === "MEETING").length;

  function isCheckInInPeriod(s: (typeof stays)[number]) {
    if (s.checkedInAt) {
      return s.checkedInAt >= bounds.gte && s.checkedInAt <= bounds.lte;
    }
    const d = dayKey(s.checkInDate);
    return (
      d >= input.from &&
      d <= input.to &&
      (s.status === "CHECKED_IN" || s.status === "CHECKED_OUT")
    );
  }

  function isCheckOutInPeriod(s: (typeof stays)[number]) {
    if (s.checkedOutAt) {
      return s.checkedOutAt >= bounds.gte && s.checkedOutAt <= bounds.lte;
    }
    const d = dayKey(s.checkOutDate);
    return d >= input.from && d <= input.to && s.status === "CHECKED_OUT";
  }

  const checkIns = stays.filter(isCheckInInPeriod);
  const checkOuts = stays.filter(isCheckOutInPeriod);
  const reservations = stays.filter((s) => s.status === "RESERVED");
  const occupied = stays.filter((s) => s.status === "CHECKED_IN");

  let occupiedRoomNights = 0;
  const rangeEndExclusive = new Date(toDay);
  rangeEndExclusive.setDate(rangeEndExclusive.getDate() + 1);
  for (const s of stays) {
    if (s.room.roomType.kind !== "ROOM") continue;
    if (s.status === "RESERVED") continue;
    occupiedRoomNights += nightsOverlap(
      startOfLocalDay(dayKey(s.checkInDate)),
      startOfLocalDay(dayKey(s.checkOutDate)),
      fromDay,
      rangeEndExclusive,
    );
  }
  const availableRoomNights = roomCount * days.length;
  const occupancyPct =
    availableRoomNights > 0
      ? Math.round((occupiedRoomNights / availableRoomNights) * 1000) / 10
      : 0;

  const checkInsByDay = new Map(days.map((d) => [d, 0]));
  const checkOutsByDay = new Map(days.map((d) => [d, 0]));
  const reservationsByDay = new Map(days.map((d) => [d, 0]));
  for (const s of checkIns) {
    const d = s.checkedInAt ? dayKey(s.checkedInAt) : dayKey(s.checkInDate);
    if (checkInsByDay.has(d)) {
      checkInsByDay.set(d, (checkInsByDay.get(d) ?? 0) + 1);
    }
  }
  for (const s of checkOuts) {
    const d = s.checkedOutAt ? dayKey(s.checkedOutAt) : dayKey(s.checkOutDate);
    if (checkOutsByDay.has(d)) {
      checkOutsByDay.set(d, (checkOutsByDay.get(d) ?? 0) + 1);
    }
  }
  for (const s of reservations) {
    const d = dayKey(s.checkInDate);
    if (reservationsByDay.has(d)) {
      reservationsByDay.set(d, (reservationsByDay.get(d) ?? 0) + 1);
    }
  }

  const bySpaceKindMap = new Map<string, number>();
  const byBranchMap = new Map<string, number>();
  const byStatusMap = new Map<string, number>();
  for (const s of stays) {
    const kind = spaceKindLabel(s.room.roomType.kind);
    bySpaceKindMap.set(kind, (bySpaceKindMap.get(kind) ?? 0) + 1);
    const bName = nameById.get(s.branchId) ?? s.branchId;
    byBranchMap.set(bName, (byBranchMap.get(bName) ?? 0) + 1);
    const st = stayStatusLabel(s.status);
    byStatusMap.set(st, (byStatusMap.get(st) ?? 0) + 1);
  }

  const lines: OccupancyLine[] = stays.map((s) => {
    const checkIn = isCheckInInPeriod(s);
    const checkOut = isCheckOutInPeriod(s);
    let event: OccupancyLine["event"] = "stay";
    let eventLabel = "Séjour";
    if (s.status === "RESERVED") {
      event = "reservation";
      eventLabel = "Réservation";
    } else if (checkIn && !checkOut) {
      event = "check_in";
      eventLabel = "Check-in";
    } else if (checkOut && !checkIn) {
      event = "check_out";
      eventLabel = "Check-out";
    } else if (checkIn && checkOut) {
      event = "check_in";
      eventLabel = "Check-in + out";
    }
    const spaceKind =
      s.room.roomType.kind === "MEETING"
        ? ("MEETING" as const)
        : ("ROOM" as const);
    const duration = stayDurationFields(s);
    return {
      id: s.id,
      day: dayKey(s.checkInDate),
      branchId: s.branchId,
      branchName: nameById.get(s.branchId) ?? s.branchId,
      branchType: typeByBranch.get(s.branchId) ?? "HOTEL",
      guestName: s.guestName,
      roomNumber: s.room.number,
      roomTypeName: s.room.roomType.name,
      spaceKind,
      spaceKindLabel: spaceKindLabel(spaceKind),
      status: s.status,
      statusLabel: stayStatusLabel(s.status),
      checkInDate: dayKey(s.checkInDate),
      checkOutDate: dayKey(s.checkOutDate),
      checkedInAt: s.checkedInAt ? s.checkedInAt.toISOString() : null,
      checkedOutAt: s.checkedOutAt ? s.checkedOutAt.toISOString() : null,
      billingMode: s.billingMode === "FLAT" ? "Passage" : "Nuitée",
      durationDays: duration.durationDays,
      durationHours: duration.durationHours,
      durationLabel: duration.durationLabel,
      remainingLabel: duration.remainingLabel,
      remainingTone: duration.remainingTone,
      event,
      eventLabel,
    };
  });

  const groupsByBranchType = groupLinesByBranchType(lines, (groupLines) => ({
    stays: groupLines.length,
    checkIns: groupLines.filter(
      (l) =>
        l.event === "check_in" ||
        l.status === "CHECKED_IN" ||
        l.status === "CHECKED_OUT",
    ).length,
    checkOuts: groupLines.filter(
      (l) => l.event === "check_out" || l.status === "CHECKED_OUT",
    ).length,
    reserved: groupLines.filter((l) => l.status === "RESERVED").length,
  }));

  const financeByBranch = new Map<
    string,
    OccupancyFinanceBranch
  >();
  for (const b of staysBranches) {
    financeByBranch.set(b.id, {
      branchId: b.id,
      branchName: b.name,
      branchType: b.type,
      branchTypeLabel: branchTypeLabel(b.type),
      collected: 0,
      expected: 0,
      refunded: 0,
      refundDue: 0,
      netCash: 0,
    });
  }

  const stayById = new Map(stays.map((s) => [s.id, s]));
  const financeDetails: OccupancyFinanceDetail[] = [];

  for (const folio of folios) {
    const row = financeByBranch.get(folio.branchId);
    if (!row) continue;
    const stay = folio.stayId ? stayById.get(folio.stayId) : null;
    if (!stay) continue;

    const charges = folio.lines.reduce((s, l) => s + l.amount, 0);
    let paidAll = 0;
    let collected = 0;
    let refunded = 0;
    const periodPaymentParts: string[] = [];
    for (const p of folio.payments) {
      const usd = paymentUsdSigned(p, usdRate);
      paidAll += usd;
      if (p.paidAt >= bounds.gte && p.paidAt <= bounds.lte) {
        if (usd > 0.01) {
          collected += usd;
          row.collected += usd;
        } else if (usd < -0.01) {
          const abs = Math.abs(usd);
          refunded += abs;
          row.refunded += abs;
        }
        const method = paymentMethodLabel(p.method);
        periodPaymentParts.push(
          `#${p.receiptNumber} ${method} ${usd < 0 ? "−" : ""}${Math.abs(usd).toFixed(2)}`,
        );
      }
    }
    const balance = charges - paidAll;
    let expected = 0;
    let refundDue = 0;
    if (balance > 0.01) {
      expected = balance;
      row.expected += balance;
    } else if (balance < -0.01) {
      refundDue = Math.abs(balance);
      row.refundDue += Math.abs(balance);
    }

    const spaceKind =
      stay.room.roomType.kind === "MEETING" ? "MEETING" : "ROOM";
    financeDetails.push({
      id: stay.id,
      folioId: folio.id,
      branchId: folio.branchId,
      branchName: nameById.get(folio.branchId) ?? folio.branchId,
      branchType: typeByBranch.get(folio.branchId) ?? "HOTEL",
      branchTypeLabel: branchTypeLabel(
        typeByBranch.get(folio.branchId) ?? "HOTEL",
      ),
      guestName: stay.guestName,
      roomNumber: stay.room.number,
      roomTypeName: stay.room.roomType.name,
      spaceKindLabel: spaceKindLabel(spaceKind),
      status: stay.status,
      statusLabel: stayStatusLabel(stay.status),
      checkInDate: dayKey(stay.checkInDate),
      checkOutDate: dayKey(stay.checkOutDate),
      billingMode: stay.billingMode === "FLAT" ? "Passage" : "Nuitée",
      charges,
      paid: paidAll,
      collected,
      expected,
      refunded,
      refundDue,
      balance,
      netCash: collected - refunded,
      paymentsLabel:
        periodPaymentParts.length > 0 ? periodPaymentParts.join(" · ") : "—",
    });
  }

  for (const row of financeByBranch.values()) {
    row.netCash = row.collected - row.refunded;
  }

  financeDetails.sort((a, b) => {
    const byBranch = a.branchName.localeCompare(b.branchName, "fr");
    if (byBranch !== 0) return byBranch;
    return a.checkInDate.localeCompare(b.checkInDate);
  });

  const financeByBranchList = [...financeByBranch.values()].sort((a, b) =>
    a.branchName.localeCompare(b.branchName, "fr"),
  );
  const collected = financeByBranchList.reduce((s, r) => s + r.collected, 0);
  const refunded = financeByBranchList.reduce((s, r) => s + r.refunded, 0);
  const finance = {
    collected,
    expected: financeByBranchList.reduce((s, r) => s + r.expected, 0),
    refunded,
    refundDue: financeByBranchList.reduce((s, r) => s + r.refundDue, 0),
    netCash: collected - refunded,
    byBranch: financeByBranchList,
    details: financeDetails,
  };

  return {
    period: { from: input.from, to: input.to },
    staysBranchCount: staysIds.length,
    kpis: {
      reservations: reservations.length,
      checkIns: checkIns.length,
      checkOuts: checkOuts.length,
      occupied: occupied.length,
      rooms: roomCount,
      meetings: meetingCount,
      occupancyPct,
      checkInsDelta: pctDelta(checkIns.length, prevCheckIns),
      checkOutsDelta: pctDelta(checkOuts.length, prevCheckOuts),
    },
    eventsByDay: days.map((day) => ({
      day,
      checkIns: checkInsByDay.get(day) ?? 0,
      checkOuts: checkOutsByDay.get(day) ?? 0,
      reservations: reservationsByDay.get(day) ?? 0,
    })),
    bySpaceKind: [...bySpaceKindMap.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value),
    byBranch: [...byBranchMap.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value),
    byStatus: [...byStatusMap.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value),
    lines,
    groupsByBranchType,
    finance,
  };
}
