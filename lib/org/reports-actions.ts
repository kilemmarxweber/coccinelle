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
};

export async function listOrgReportBranchesAction(organizationId: string) {
  const user = await requireOrgUser(organizationId);
  const branches = await prisma.branch.findMany({
    where: { organizationId, status: "ACTIVE" },
    orderBy: [{ type: "asc" }, { name: "asc" }],
    select: { id: true, name: true, code: true, type: true },
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
    select: { id: true, name: true, code: true, type: true },
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
      orderId: true,
      folioId: true,
      shopSaleId: true,
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
  const prevUsd = prevPayments.map((p) => paymentAmountUsd(p, usdRate));

  const ca = withUsd.reduce((s, p) => s + p.usd, 0);
  const caPrev = prevUsd.reduce((s, n) => s + n, 0);

  const ticketKeys = new Set<string>();
  for (const p of withUsd) {
    ticketKeys.add(p.orderId ?? p.shopSaleId ?? p.folioId ?? p.id);
  }
  const tickets = ticketKeys.size;

  const prevTicketApprox = prevPayments.length; // approx si pas d’ids
  const qtySold = withUsd.reduce((s, p) => {
    const items = p.shopSale?.items ?? p.order?.items ?? [];
    return s + items.reduce((a, i) => a + i.quantity, 0);
  }, 0);

  const byDayMap = new Map<string, number>();
  const byMethodMap = new Map<string, number>();
  const byBranchMap = new Map<string, number>();

  for (const p of withUsd) {
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

  const lines = withUsd.map((p) => {
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
      paymentsCount: withUsd.length,
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

  const [pays, prevPays, moves, prevMoves, folioLines, rate] =
    await Promise.all([
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
          orderId: true,
          folioId: true,
          shopSaleId: true,
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
        },
        orderBy: { paidAt: "asc" },
      }),
      prisma.payment.findMany({
        where: {
          branchId: { in: ids },
          paidAt: rangeBounds(prev.from, prev.to),
        },
        select: { amountCdf: true, amountForeign: true },
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
      getActiveExchangeRate(ids[0]!),
    ]);

  const usdRate = rate?.rate ?? null;
  const paysUsd = pays.map((p) => ({
    ...p,
    usd: paymentAmountUsd(p, usdRate),
    branchName: nameById.get(p.branchId) ?? "Branche",
  }));
  const revenue = paysUsd.reduce((s, p) => s + p.usd, 0);
  const revenuePrev = prevPays.reduce(
    (s, p) => s + paymentAmountUsd(p, usdRate),
    0,
  );

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
  const byBranchMap = new Map<string, number>();
  for (const p of paysUsd) {
    const k = dayKey(p.paidAt);
    revByDay.set(k, (revByDay.get(k) ?? 0) + p.usd);
    byBranchMap.set(
      p.branchName,
      (byBranchMap.get(p.branchName) ?? 0) + p.usd,
    );
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
  const byMethod = new Map<string, number>();
  for (const p of paysUsd) {
    const method = paymentMethodLabel(p.method);
    byMethod.set(method, (byMethod.get(method) ?? 0) + p.usd);
  }

  const typeById = new Map(branches.map((b) => [b.id, b.type]));

  const lines = paysUsd.map((p) => {
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

  // Toujours dériver aussi depuis les lignes (même source que le tableau).
  const methodFromLines = new Map<string, number>();
  for (const l of lines) {
    if (!(l.usd > 0)) continue;
    methodFromLines.set(l.method, (methodFromLines.get(l.method) ?? 0) + l.usd);
  }
  const revenueByMethod =
    methodFromLines.size > 0
      ? [...methodFromLines.entries()].map(([name, value]) => ({
          name,
          value: Number(value) || 0,
        }))
      : [...byMethod.entries()].map(([name, value]) => ({
          name,
          value: Number(value) || 0,
        }));

  const groupsByBranchType = groupLinesByBranchType(lines, (groupLines) => ({
    amount: groupLines.reduce((s, l) => s + l.usd, 0),
    count: groupLines.length,
  }));

  return {
    period: { from: input.from, to: input.to },
    branches: branches.map((b) => ({ id: b.id, name: b.name, type: b.type })),
    kpis: {
      revenue,
      revenueDelta: pctDelta(revenue, revenuePrev),
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
    lines,
    linesTotal: lines.reduce((s, l) => s + l.usd, 0),
    groupsByBranchType,
    rate: toReportExchangeRate(rate),
  };
}
