"use server";

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { canAccessBranch } from "@/lib/branch/user-branches";
import { getActiveExchangeRate } from "@/lib/cash/actions";
import { toReportExchangeRate } from "@/lib/cash/exchange";
import prisma from "@/lib/prisma";
import {
  currentMonthRange,
  dayKey,
  eachDayIso,
  endOfLocalDay,
  paymentAmountUsd,
  pctDelta,
  previousRange,
  startOfLocalDay,
  toIsoDate,
} from "@/lib/hotel/reports/period";

async function ctx(organizationId: string, branchId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) throw new Error("Non authentifi?.");
  const branch = await canAccessBranch(
    session.user.id,
    session.user.role,
    branchId,
  );
  if (!branch || branch.organizationId !== organizationId) {
    throw new Error("Branche inaccessible.");
  }
  return { user: session.user, branch };
}

function rangeBounds(from: string, to: string) {
  return { gte: startOfLocalDay(from), lte: endOfLocalDay(to) };
}

type PeriodInput = {
  organizationId: string;
  branchId: string;
  from: string;
  to: string;
};

async function loadPayments(branchId: string, from: string, to: string) {
  const rate = await getActiveExchangeRate(branchId);
  const rows = await prisma.payment.findMany({
    where: { branchId, paidAt: rangeBounds(from, to) },
    select: {
      amountCdf: true,
      amountForeign: true,
      method: true,
      paidAt: true,
      orderId: true,
      folioId: true,
      shopSaleId: true,
      purchaseOrderId: true,
      expenseId: true,
      note: true,
      cashierUserId: true,
    },
    orderBy: { paidAt: "asc" },
  });
  const usdRate = rate?.rate ?? null;
  return rows.map((p) => ({
    ...p,
    usd: paymentAmountUsd(p, usdRate),
  }));
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

/** Lignes de vente (paiements) avec jour, montant et participants. */
async function loadSaleLines(branchId: string, from: string, to: string) {
  const rate = await getActiveExchangeRate(branchId);
  const usdRate = rate?.rate ?? null;

  const payments = await prisma.payment.findMany({
    where: { branchId, paidAt: rangeBounds(from, to) },
    select: {
      id: true,
      paidAt: true,
      amountCdf: true,
      amountForeign: true,
      method: true,
      receiptNumber: true,
      cashierUserId: true,
      orderId: true,
      folioId: true,
      order: {
        select: {
          id: true,
          tableLabel: true,
          createdByUserId: true,
          preparedByUserId: true,
          items: {
            select: { name: true, quantity: true, amount: true },
          },
        },
      },
    },
    orderBy: { paidAt: "asc" },
  });

  const nameById = await resolveStaffNameMap([
    ...payments.map((p) => p.cashierUserId),
    ...payments.map((p) => p.order?.createdByUserId).filter(Boolean) as string[],
    ...payments
      .map((p) => p.order?.preparedByUserId)
      .filter((id): id is string => Boolean(id)),
  ]);

  return payments.map((p) => {
    const usd = paymentAmountUsd(p, usdRate);
    const order = p.order;
    const itemsLabel = order?.items.length
      ? order.items
          .map((i) => `${i.quantity}? ${i.name}`)
          .slice(0, 4)
          .join(", ") + (order.items.length > 4 ? "?" : "")
      : null;
    const participants = [
      p.cashierUserId
        ? { role: "Caissier" as const, name: nameById.get(p.cashierUserId) ?? "?" }
        : null,
      order?.createdByUserId
        ? {
            role: "Serveur" as const,
            name: nameById.get(order.createdByUserId) ?? "?",
          }
        : null,
      order?.preparedByUserId
        ? {
            role: "Cuisinier" as const,
            name: nameById.get(order.preparedByUserId) ?? "?",
          }
        : null,
    ].filter((x): x is { role: "Caissier" | "Serveur" | "Cuisinier"; name: string } =>
      Boolean(x),
    );

    return {
      id: p.id,
      day: dayKey(p.paidAt),
      paidAt: p.paidAt.toISOString(),
      receiptNumber: p.receiptNumber,
      method: p.method,
      tableLabel: order?.tableLabel ?? null,
      label:
        order?.tableLabel?.trim() ||
        (p.orderId ? `Commande` : p.folioId ? "Folio" : "Paiement"),
      itemsLabel,
      usd,
      participants,
    };
  });
}

async function loadStockMoves(branchId: string, from: string, to: string) {
  return prisma.hotelStockMovement.findMany({
    where: { branchId, createdAt: rangeBounds(from, to) },
    include: {
      menuItem: {
        select: {
          id: true,
          name: true,
          category: true,
          isConsumable: true,
          price: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });
}

async function loadSoldItems(branchId: string, from: string, to: string) {
  const orders = await prisma.hotelOrder.findMany({
    where: {
      branchId,
      status: { in: ["PAYEE", "LIVREE"] },
      OR: [
        { paidAt: rangeBounds(from, to) },
        {
          paidAt: null,
          deliveredAt: rangeBounds(from, to),
        },
        {
          paidAt: null,
          deliveredAt: null,
          createdAt: rangeBounds(from, to),
        },
      ],
    },
    select: {
      id: true,
      status: true,
      paidAt: true,
      deliveredAt: true,
      createdAt: true,
      items: {
        select: {
          name: true,
          quantity: true,
          amount: true,
          unitPrice: true,
          menuItemId: true,
          menuItem: {
            select: { category: true, isConsumable: true },
          },
        },
      },
    },
  });
  return orders;
}

function seriesByDay(
  days: string[],
  points: { day: string; value: number }[],
) {
  const map = new Map(points.map((p) => [p.day, p.value]));
  return days.map((day) => ({ day, value: map.get(day) ?? 0 }));
}

export async function getSalesReportAction(input: PeriodInput) {
  await ctx(input.organizationId, input.branchId);
  const prev = previousRange(input.from, input.to);
  const days = eachDayIso(input.from, input.to);

  const [curPays, prevPays, curOrders, prevOrders, lines, exchange] =
    await Promise.all([
      loadPayments(input.branchId, input.from, input.to),
      loadPayments(input.branchId, prev.from, prev.to),
      loadSoldItems(input.branchId, input.from, input.to),
      loadSoldItems(input.branchId, prev.from, prev.to),
      loadSaleLines(input.branchId, input.from, input.to),
      getActiveExchangeRate(input.branchId),
    ]);

  const ca = curPays.reduce((s, p) => s + p.usd, 0);
  const caPrev = prevPays.reduce((s, p) => s + p.usd, 0);
  const tickets = curOrders.length;
  const ticketsPrev = prevOrders.length;
  const qtySold = curOrders.reduce(
    (s, o) => s + o.items.reduce((a, i) => a + i.quantity, 0),
    0,
  );
  const qtyPrev = prevOrders.reduce(
    (s, o) => s + o.items.reduce((a, i) => a + i.quantity, 0),
    0,
  );

  const byDayMap = new Map<string, number>();
  for (const p of curPays) {
    const k = dayKey(p.paidAt);
    byDayMap.set(k, (byDayMap.get(k) ?? 0) + p.usd);
  }

  const byMethodMap = new Map<string, number>();
  for (const p of curPays) {
    byMethodMap.set(p.method, (byMethodMap.get(p.method) ?? 0) + p.usd);
  }

  return {
    period: { from: input.from, to: input.to },
    previous: prev,
    kpis: {
      ca,
      caDelta: pctDelta(ca, caPrev),
      tickets,
      ticketsDelta: pctDelta(tickets, ticketsPrev),
      qtySold,
      qtyDelta: pctDelta(qtySold, qtyPrev),
      avgTicket: tickets ? ca / tickets : 0,
      paymentsCount: curPays.length,
    },
    caByDay: seriesByDay(
      days,
      [...byDayMap.entries()].map(([day, value]) => ({ day, value })),
    ),
    caByMethod: [...byMethodMap.entries()].map(([name, value]) => ({
      name,
      value,
    })),
    lines,
    linesTotal: lines.reduce((s, l) => s + l.usd, 0),
    rate: toReportExchangeRate(exchange),
    compare: {
      caPrev,
      ticketsPrev,
      qtyPrev,
    },
  };
}

export async function getPurchasesReportAction(input: PeriodInput) {
  await ctx(input.organizationId, input.branchId);
  const prev = previousRange(input.from, input.to);
  const days = eachDayIso(input.from, input.to);

  const [cur, prevMoves, exchange] = await Promise.all([
    loadStockMoves(input.branchId, input.from, input.to),
    loadStockMoves(input.branchId, prev.from, prev.to),
    getActiveExchangeRate(input.branchId),
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
    else outByDay.set(k, (outByDay.get(k) ?? 0) + m.quantity);
  }

  const byProduct = new Map<
    string,
    { name: string; inQty: number; outQty: number; consumable: boolean }
  >();
  for (const m of cur) {
    const id = m.menuItemId;
    const row = byProduct.get(id) ?? {
      name: m.menuItem.name,
      inQty: 0,
      outQty: 0,
      consumable: m.menuItem.isConsumable,
    };
    if (m.kind === "ENTREE") row.inQty += m.quantity;
    else row.outQty += m.quantity;
    byProduct.set(id, row);
  }

  return {
    period: { from: input.from, to: input.to },
    previous: prev,
    kpis: {
      qtyIn,
      qtyInDelta: pctDelta(qtyIn, qtyInPrev),
      qtyOut,
      qtyOutDelta: pctDelta(qtyOut, qtyOutPrev),
      net: qtyIn - qtyOut,
      netDelta: pctDelta(qtyIn - qtyOut, qtyInPrev - qtyOutPrev),
      linesIn: entrees.length,
      linesOut: sorties.length,
    },
    flowByDay: days.map((day) => ({
      day,
      entrees: inByDay.get(day) ?? 0,
      sorties: outByDay.get(day) ?? 0,
    })),
    byProduct: [...byProduct.values()]
      .sort((a, b) => b.inQty + b.outQty - (a.inQty + a.outQty))
      .slice(0, 20),
    rate: toReportExchangeRate(exchange),
    compare: { qtyInPrev, qtyOutPrev },
  };
}

export async function getArticlesReportAction(input: PeriodInput) {
  await ctx(input.organizationId, input.branchId);
  const prev = previousRange(input.from, input.to);
  const days = eachDayIso(input.from, input.to);

  const [orders, prevOrders, moves, exchange] = await Promise.all([
    loadSoldItems(input.branchId, input.from, input.to),
    loadSoldItems(input.branchId, prev.from, prev.to),
    loadStockMoves(input.branchId, input.from, input.to),
    getActiveExchangeRate(input.branchId),
  ]);

  type Agg = {
    name: string;
    category: string;
    qty: number;
    revenue: number;
    stockOut: number;
  };
  const map = new Map<string, Agg>();
  const prevMap = new Map<string, number>();

  for (const o of orders) {
    for (const i of o.items) {
      const key = i.menuItemId ?? i.name;
      const row = map.get(key) ?? {
        name: i.name,
        category: i.menuItem?.category ?? "Divers",
        qty: 0,
        revenue: 0,
        stockOut: 0,
      };
      row.qty += i.quantity;
      row.revenue += i.amount;
      map.set(key, row);
    }
  }
  for (const o of prevOrders) {
    for (const i of o.items) {
      const key = i.menuItemId ?? i.name;
      prevMap.set(key, (prevMap.get(key) ?? 0) + i.quantity);
    }
  }
  for (const m of moves) {
    if (m.kind !== "SORTIE") continue;
    const key = m.menuItemId;
    const row = map.get(key) ?? {
      name: m.menuItem.name,
      category: m.menuItem.category,
      qty: 0,
      revenue: 0,
      stockOut: 0,
    };
    row.stockOut += m.quantity;
    map.set(key, row);
  }

  const articles = [...map.entries()]
    .map(([id, a]) => ({
      id,
      ...a,
      qtyDelta: pctDelta(a.qty, prevMap.get(id) ?? 0),
    }))
    .sort((a, b) => b.qty - a.qty);

  const byCategory = new Map<string, number>();
  for (const a of articles) {
    byCategory.set(a.category, (byCategory.get(a.category) ?? 0) + a.qty);
  }

  const soldByDay = new Map<string, number>();
  for (const o of orders) {
    const when = o.paidAt ?? o.deliveredAt ?? o.createdAt;
    const k = dayKey(when);
    const q = o.items.reduce((s, i) => s + i.quantity, 0);
    soldByDay.set(k, (soldByDay.get(k) ?? 0) + q);
  }

  const totalQty = articles.reduce((s, a) => s + a.qty, 0);
  const totalRev = articles.reduce((s, a) => s + a.revenue, 0);
  const totalPrev = [...prevMap.values()].reduce((s, n) => s + n, 0);

  return {
    period: { from: input.from, to: input.to },
    previous: prev,
    kpis: {
      articles: articles.filter((a) => a.qty > 0).length,
      qty: totalQty,
      qtyDelta: pctDelta(totalQty, totalPrev),
      revenue: totalRev,
      stockOut: articles.reduce((s, a) => s + a.stockOut, 0),
    },
    topArticles: articles.slice(0, 15),
    byCategory: [...byCategory.entries()].map(([name, value]) => ({
      name,
      value,
    })),
    soldByDay: seriesByDay(
      days,
      [...soldByDay.entries()].map(([day, value]) => ({ day, value })),
    ),
    rate: toReportExchangeRate(exchange),
  };
}

export async function getFinanceReportAction(input: PeriodInput) {
  await ctx(input.organizationId, input.branchId);
  const prev = previousRange(input.from, input.to);
  const days = eachDayIso(input.from, input.to);

  const [pays, prevPays, moves, prevMoves, folioLines, exchange] =
    await Promise.all([
      loadPayments(input.branchId, input.from, input.to),
      loadPayments(input.branchId, prev.from, prev.to),
      loadStockMoves(input.branchId, input.from, input.to),
      loadStockMoves(input.branchId, prev.from, prev.to),
      prisma.folioLine.findMany({
        where: {
          folio: { branchId: input.branchId },
          createdAt: rangeBounds(input.from, input.to),
        },
        select: { kind: true, amount: true, createdAt: true },
      }),
      getActiveExchangeRate(input.branchId),
    ]);

  const round2 = (n: number) => Math.round(n * 100) / 100;
  const revenue = pays
    .filter(
      (p) =>
        p.usd > 0 &&
        !p.purchaseOrderId &&
        !p.expenseId &&
        !(p.note ?? "").startsWith("Remboursement achat"),
    )
    .reduce((s, p) => s + p.usd, 0);
  const revenuePrev = prevPays
    .filter(
      (p) =>
        p.usd > 0 &&
        !p.purchaseOrderId &&
        !p.expenseId &&
        !(p.note ?? "").startsWith("Remboursement achat"),
    )
    .reduce((s, p) => s + p.usd, 0);
  const expenses = pays
    .filter(
      (p) =>
        p.usd < 0 &&
        (p.expenseId ||
          (p.note ?? "").startsWith("D?pense ?") ||
          (p.note ?? "").startsWith("D?p?t ? la banque ?") ||
          (p.note ?? "").startsWith("Remise au propri?taire ?")),
    )
    .reduce((s, p) => s + Math.abs(p.usd), 0);
  const expensesPrev = prevPays
    .filter(
      (p) =>
        p.usd < 0 &&
        (p.expenseId ||
          (p.note ?? "").startsWith("D?pense ?") ||
          (p.note ?? "").startsWith("D?p?t ? la banque ?") ||
          (p.note ?? "").startsWith("Remise au propri?taire ?")),
    )
    .reduce((s, p) => s + Math.abs(p.usd), 0);
  const purchases = pays
    .filter(
      (p) =>
        p.purchaseOrderId &&
        (p.usd < 0 || (p.note ?? "").startsWith("Sortie achat")),
    )
    .reduce((s, p) => s + Math.abs(Math.min(p.usd, 0)), 0);
  const purchaseRefunds = pays
    .filter(
      (p) =>
        p.purchaseOrderId &&
        (p.usd > 0 || (p.note ?? "").startsWith("Remboursement achat")),
    )
    .reduce((s, p) => s + Math.max(p.usd, 0), 0);
  const netPurchases = Math.max(0, round2(purchases - purchaseRefunds));
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
  for (const p of pays) {
    const k = dayKey(p.paidAt);
    revByDay.set(k, (revByDay.get(k) ?? 0) + p.usd);
  }
  const inByDay = new Map<string, number>();
  const outByDay = new Map<string, number>();
  for (const m of moves) {
    const k = dayKey(m.createdAt);
    if (m.kind === "ENTREE") inByDay.set(k, (inByDay.get(k) ?? 0) + m.quantity);
    else outByDay.set(k, (outByDay.get(k) ?? 0) + m.quantity);
  }

  const byKind = new Map<string, number>();
  for (const l of folioLines) {
    byKind.set(l.kind, (byKind.get(l.kind) ?? 0) + l.amount);
  }

  const byMethod = new Map<string, number>();
  for (const p of pays) {
    byMethod.set(p.method, (byMethod.get(p.method) ?? 0) + p.usd);
  }

  return {
    period: { from: input.from, to: input.to },
    previous: prev,
    kpis: {
      revenue,
      revenueDelta: pctDelta(revenue, revenuePrev),
      expenses,
      expensesDelta: pctDelta(expenses, expensesPrev),
      purchases: netPurchases,
      netCash,
      qtyIn,
      qtyInDelta: pctDelta(qtyIn, qtyInPrev),
      qtyOut,
      qtyOutDelta: pctDelta(qtyOut, qtyOutPrev),
      coverage:
        qtyOut > 0 ? Math.round((revenue / qtyOut) * 100) / 100 : revenue,
    },
    revenueByDay: seriesByDay(
      days,
      [...revByDay.entries()].map(([day, value]) => ({ day, value })),
    ),
    flowByDay: days.map((day) => ({
      day,
      revenus: revByDay.get(day) ?? 0,
      entrees: inByDay.get(day) ?? 0,
      sorties: outByDay.get(day) ?? 0,
    })),
    revenueByMethod: [...byMethod.entries()].map(([name, value]) => ({
      name,
      value,
    })),
    folioByKind: [...byKind.entries()].map(([name, value]) => ({
      name,
      value,
    })),
    rate: toReportExchangeRate(exchange),
    compare: { revenuePrev, qtyInPrev, qtyOutPrev },
  };
}

export async function getMyOrdersReportAction(input: PeriodInput) {
  const { user } = await ctx(input.organizationId, input.branchId);
  const exchange = await getActiveExchangeRate(input.branchId);
  const days = eachDayIso(input.from, input.to);
  const soldWhere = {
    branchId: input.branchId,
    createdByUserId: user.id,
    status: { notIn: ["BROUILLON", "ANNULEE"] as Array<"BROUILLON" | "ANNULEE"> },
  };
  const orders = await prisma.hotelOrder.findMany({
    where: {
      branchId: input.branchId,
      createdByUserId: user.id,
      createdAt: rangeBounds(input.from, input.to),
      status: { not: "BROUILLON" },
    },
    include: {
      items: { select: { name: true, quantity: true, amount: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const prev = previousRange(input.from, input.to);
  const todayIso = toIsoDate(new Date());
  const month = currentMonthRange();
  const [prevCount, todayOrders, monthOrders] = await Promise.all([
    prisma.hotelOrder.count({
      where: {
        ...soldWhere,
        createdAt: rangeBounds(prev.from, prev.to),
      },
    }),
    prisma.hotelOrder.findMany({
      where: {
        ...soldWhere,
        createdAt: rangeBounds(todayIso, todayIso),
      },
      include: { items: { select: { amount: true } } },
    }),
    prisma.hotelOrder.findMany({
      where: {
        ...soldWhere,
        createdAt: rangeBounds(month.from, month.to),
      },
      include: { items: { select: { amount: true } } },
    }),
  ]);

  const sold = orders.filter((o) => o.status !== "ANNULEE");
  const cancelled = orders.length - sold.length;
  let ca = 0;
  const byDay = new Map<string, number>();
  const byStatus = new Map<string, number>();
  const byProduct = new Map<string, number>();

  for (const o of orders) {
    byStatus.set(o.status, (byStatus.get(o.status) ?? 0) + 1);
    if (o.status === "ANNULEE") continue;
    const total = o.items.reduce((s, i) => s + i.amount, 0);
    ca += total;
    const day = dayKey(o.createdAt);
    byDay.set(day, (byDay.get(day) ?? 0) + total);
    for (const it of o.items) {
      byProduct.set(it.name, (byProduct.get(it.name) ?? 0) + it.amount);
    }
  }

  const sumItems = (rows: { items: { amount: number }[] }[]) =>
    rows.reduce((s, o) => s + o.items.reduce((a, i) => a + i.amount, 0), 0);

  const caToday = sumItems(todayOrders);
  const caMonth = sumItems(monthOrders);

  return {
    kpis: {
      orders: sold.length,
      cancelled,
      ordersDelta: pctDelta(sold.length, prevCount),
      ca: Math.round(ca * 100) / 100,
      ticketAvg:
        sold.length > 0 ? Math.round((ca / sold.length) * 100) / 100 : 0,
      caToday: Math.round(caToday * 100) / 100,
      ordersToday: todayOrders.length,
      caMonth: Math.round(caMonth * 100) / 100,
      ordersMonth: monthOrders.length,
    },
    caByDay: days.map((day) => ({
      day,
      value: Math.round((byDay.get(day) ?? 0) * 100) / 100,
    })),
    byStatus: [...byStatus.entries()].map(([name, value]) => ({ name, value })),
    topProducts: [...byProduct.entries()]
      .map(([name, value]) => ({
        name: name.length > 18 ? `${name.slice(0, 16)}...` : name,
        value: Math.round(value * 100) / 100,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8),
    rate: toReportExchangeRate(exchange),
  };
}

export async function getStaysReportAction(input: PeriodInput) {
  await ctx(input.organizationId, input.branchId);
  const days = eachDayIso(input.from, input.to);
  const [arrivals, departures, rooms, inHouse] = await Promise.all([
    prisma.hotelStay.findMany({
      where: {
        branchId: input.branchId,
        checkInDate: rangeBounds(input.from, input.to),
      },
      select: {
        id: true,
        guestName: true,
        status: true,
        checkInDate: true,
        checkOutDate: true,
        checkedInAt: true,
        checkedOutAt: true,
        room: { select: { number: true } },
      },
      orderBy: { checkInDate: "asc" },
    }),
    prisma.hotelStay.findMany({
      where: {
        branchId: input.branchId,
        checkOutDate: rangeBounds(input.from, input.to),
      },
      select: {
        id: true,
        guestName: true,
        status: true,
        checkInDate: true,
        checkOutDate: true,
        checkedInAt: true,
        checkedOutAt: true,
        room: { select: { number: true } },
      },
      orderBy: { checkOutDate: "asc" },
    }),
    prisma.hotelRoom.count({
      where: { roomType: { branchId: input.branchId } },
    }),
    prisma.hotelStay.count({
      where: {
        branchId: input.branchId,
        status: "CHECKED_IN",
      },
    }),
  ]);

  const checkIns = arrivals.filter(
    (s) =>
      s.checkedInAt ||
      s.status === "CHECKED_IN" ||
      s.status === "CHECKED_OUT",
  ).length;
  const checkOuts = departures.filter(
    (s) => s.checkedOutAt || s.status === "CHECKED_OUT",
  ).length;
  const byStatus = new Map<string, number>();
  for (const s of [...arrivals, ...departures]) {
    byStatus.set(s.status, (byStatus.get(s.status) ?? 0) + 1);
  }

  const arrivalsByDay = new Map<string, number>();
  for (const s of arrivals) {
    const day = dayKey(s.checkInDate);
    arrivalsByDay.set(day, (arrivalsByDay.get(day) ?? 0) + 1);
  }
  const departuresByDay = new Map<string, number>();
  for (const s of departures) {
    const day = dayKey(s.checkOutDate);
    departuresByDay.set(day, (departuresByDay.get(day) ?? 0) + 1);
  }

  const available = Math.max(0, rooms - inHouse);

  return {
    kpis: {
      arrivals: arrivals.length,
      checkIns,
      departures: departures.length,
      checkOuts,
      rooms,
      inHouse,
      available,
      occupancyPct: rooms > 0 ? Math.round((inHouse / rooms) * 1000) / 10 : 0,
    },
    flowByDay: days.map((day) => ({
      day,
      entrees: arrivalsByDay.get(day) ?? 0,
      sorties: departuresByDay.get(day) ?? 0,
    })),
    byStatus: [...byStatus.entries()].map(([name, value]) => ({ name, value })),
    arrivals: arrivals.slice(0, 40).map((s) => ({
      id: s.id,
      guestName: s.guestName,
      status: s.status,
      room: s.room?.number ?? "?",
      checkInDate: s.checkInDate,
      checkOutDate: s.checkOutDate,
    })),
    departures: departures.slice(0, 40).map((s) => ({
      id: s.id,
      guestName: s.guestName,
      status: s.status,
      room: s.room?.number ?? "?",
      checkInDate: s.checkInDate,
      checkOutDate: s.checkOutDate,
    })),
  };
}
