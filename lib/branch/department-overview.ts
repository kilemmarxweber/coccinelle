import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { canAccessBranch } from "@/lib/branch/user-branches";
import { getActiveExchangeRate } from "@/lib/cash/actions";
import prisma from "@/lib/prisma";

const TZ = "Africa/Kinshasa";

export type DayValue = { day: string; value: number };
export type PaySlice = { name: string; value: number };
export type StockDay = {
  day: string;
  entrees: number;
  sorties: number;
  pertes: number;
};
export type FinanceDay = { day: string; ca: number; depenses: number };

export type DepartmentOverview = {
  branchName: string;
  rate: number | null;
  salesToday: number;
  salesYesterday: number;
  txToday: number;
  txYesterday: number;
  lowStockCount: number;
  toRemit: number;
  series: { d7: DayValue[]; d30: DayValue[]; month: DayValue[] };
  payments: { d7: PaySlice[]; d30: PaySlice[]; month: PaySlice[] };
  stockFlow: StockDay[];
  finance: FinanceDay[];
  activity: {
    id: string;
    at: string;
    ticket: string;
    cashier: string;
    amount: number;
    status: string;
  }[];
  alerts: { id: string; name: string; qty: number }[];
  cash: {
    open: boolean;
    floatAndMovements: number;
    declared: number | null;
    gap: number | null;
  };
};

const PAY_LABEL: Record<string, string> = {
  CASH: "Espèces",
  MOBILE_MONEY: "Mobile Money",
  CARTE: "Carte",
  BANK: "Banque",
};

function ymd(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function addDays(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00+01:00`);
  d.setUTCDate(d.getUTCDate() + days);
  return ymd(d);
}

function daysFrom(fromIso: string, toIso: string) {
  const out: string[] = [];
  let cur = fromIso;
  while (cur <= toIso) {
    out.push(cur);
    cur = addDays(cur, 1);
  }
  return out;
}

function usdOf(
  payment: { amountForeign: number | null; amountCdf: number },
  rate: number | null,
) {
  if (payment.amountForeign != null && payment.amountForeign !== 0) {
    return payment.amountForeign;
  }
  if (rate && rate > 0) return payment.amountCdf / rate;
  return payment.amountCdf;
}

function sumByDay(
  rows: { day: string; amount: number }[],
  days: string[],
): DayValue[] {
  const map = new Map<string, number>();
  for (const row of rows) map.set(row.day, (map.get(row.day) ?? 0) + row.amount);
  return days.map((day) => ({
    day,
    value: Math.round((map.get(day) ?? 0) * 100) / 100,
  }));
}

export async function getDepartmentOverview(
  organizationId: string,
  branchId: string,
): Promise<DepartmentOverview> {
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

  const today = ymd(new Date());
  const yesterday = addDays(today, -1);
  const start30 = addDays(today, -29);
  const monthStart = `${today.slice(0, 8)}01`;
  const start14 = addDays(today, -13);
  const fromIso = [start30, monthStart, start14].sort()[0]!;
  const from = new Date(`${fromIso}T00:00:00+01:00`);

  const [rateRow, sales, payments, warehouseMoves, shopMoves, expenses, alerts, lowStockCount, openSessions, prepared] =
    await Promise.all([
      getActiveExchangeRate(branchId),
      prisma.shopSale.findMany({
        where: {
          branchId,
          status: "ENCAISSEE",
          paidAt: { gte: from },
        },
        select: {
          id: true,
          ticketNumber: true,
          totalAmount: true,
          cashierName: true,
          paidAt: true,
          status: true,
        },
        orderBy: { paidAt: "desc" },
      }),
      prisma.payment.findMany({
        where: {
          branchId,
          shopSaleId: { not: null },
          confirmationStatus: "CONFIRMED",
          paidAt: { gte: from },
        },
        select: {
          method: true,
          amountCdf: true,
          amountForeign: true,
          paidAt: true,
        },
      }),
      prisma.warehouseMovement.findMany({
        where: {
          branchId,
          createdAt: { gte: new Date(`${start14}T00:00:00+01:00`) },
          kind: { in: ["ENTREE", "SORTIE", "PERTE"] },
        },
        select: { kind: true, quantity: true, createdAt: true },
      }),
      prisma.shopStockMovement.findMany({
        where: {
          branchId,
          createdAt: { gte: new Date(`${start14}T00:00:00+01:00`) },
          kind: { in: ["ENTREE", "SORTIE"] },
        },
        select: { kind: true, quantity: true, createdAt: true },
      }),
      prisma.branchExpense.findMany({
        where: {
          branchId,
          kind: "DEPENSE",
          createdAt: { gte: new Date(`${start14}T00:00:00+01:00`) },
        },
        select: { amountUsd: true, createdAt: true },
      }),
      prisma.shopProduct.findMany({
        where: { branchId, active: true, stockQty: { lte: 5 } },
        orderBy: { stockQty: "asc" },
        take: 6,
        select: { id: true, name: true, stockQty: true },
      }),
      prisma.shopProduct.count({
        where: { branchId, active: true, stockQty: { lte: 5 } },
      }),
      prisma.cashSession.findMany({
        where: { branchId, status: "OPEN" },
        select: {
          id: true,
          openingFloat: true,
          declaredCashUsd: true,
        },
      }),
      prisma.cashRemittance.aggregate({
        where: { fromBranchId: branchId, status: "PREPARED" },
        _sum: { expectedUsd: true },
      }),
    ]);

  const rate = rateRow?.rate && rateRow.rate > 0 ? rateRow.rate : null;
  const saleRows = sales
    .filter((sale) => sale.paidAt)
    .map((sale) => ({
      day: ymd(sale.paidAt!),
      amount: sale.totalAmount,
      sale,
    }));

  const salesToday = saleRows
    .filter((row) => row.day === today)
    .reduce((sum, row) => sum + row.amount, 0);
  const salesYesterday = saleRows
    .filter((row) => row.day === yesterday)
    .reduce((sum, row) => sum + row.amount, 0);

  const payRows = payments.map((payment) => ({
    day: ymd(payment.paidAt),
    method: payment.method,
    amount: usdOf(payment, rate),
  }));

  function slices(days: Set<string>): PaySlice[] {
    const totals = new Map<string, number>();
    for (const key of ["CASH", "MOBILE_MONEY", "CARTE", "BANK"]) totals.set(key, 0);
    for (const row of payRows) {
      if (!days.has(row.day)) continue;
      totals.set(row.method, (totals.get(row.method) ?? 0) + row.amount);
    }
    return [...totals.entries()].map(([method, value]) => ({
      name: PAY_LABEL[method] ?? method,
      value: Math.round(value * 100) / 100,
    }));
  }

  const d7 = new Set(daysFrom(addDays(today, -6), today));
  const d30 = new Set(daysFrom(start30, today));
  const monthDays = daysFrom(monthStart, today);

  const stockDays = daysFrom(start14, today);
  const stockMap = new Map<string, StockDay>(
    stockDays.map((day) => [day, { day, entrees: 0, sorties: 0, pertes: 0 }]),
  );
  for (const move of [...warehouseMoves, ...shopMoves]) {
    const bucket = stockMap.get(ymd(move.createdAt));
    if (!bucket) continue;
    if (move.kind === "ENTREE") bucket.entrees += move.quantity;
    else if (move.kind === "SORTIE") bucket.sorties += move.quantity;
    else if (move.kind === "PERTE") bucket.pertes += move.quantity;
  }

  const financeDays = daysFrom(start14, today);
  const financeMap = new Map<string, FinanceDay>(
    financeDays.map((day) => [day, { day, ca: 0, depenses: 0 }]),
  );
  for (const row of saleRows) {
    const bucket = financeMap.get(row.day);
    if (bucket) bucket.ca += row.amount;
  }
  for (const expense of expenses) {
    const bucket = financeMap.get(ymd(expense.createdAt));
    if (bucket) bucket.depenses += expense.amountUsd;
  }

  let movementsUsd = 0;
  if (openSessions.length > 0) {
    const sessionPayments = await prisma.payment.findMany({
      where: { cashSessionId: { in: openSessions.map((s) => s.id) } },
      select: {
        method: true,
        confirmationStatus: true,
        amountCdf: true,
        amountForeign: true,
      },
    });
    for (const payment of sessionPayments) {
      if (payment.method === "BANK") continue;
      if (payment.confirmationStatus === "PENDING") continue;
      movementsUsd += usdOf(payment, rate);
    }
  }
  const opening = openSessions.reduce((sum, s) => sum + s.openingFloat, 0);
  const floatAndMovements = Math.round((opening + movementsUsd) * 100) / 100;
  const declaredValues = openSessions
    .map((s) => s.declaredCashUsd)
    .filter((value): value is number => value != null);
  const declared =
    declaredValues.length > 0
      ? Math.round(declaredValues.reduce((sum, value) => sum + value, 0) * 100) / 100
      : null;
  const preparedUsd = prepared._sum.expectedUsd ?? 0;

  return {
    branchName: branch.name,
    rate,
    salesToday: Math.round(salesToday * 100) / 100,
    salesYesterday: Math.round(salesYesterday * 100) / 100,
    txToday: saleRows.filter((row) => row.day === today).length,
    txYesterday: saleRows.filter((row) => row.day === yesterday).length,
    lowStockCount,
    toRemit: Math.round((preparedUsd > 0 ? preparedUsd : floatAndMovements) * 100) / 100,
    series: {
      d7: sumByDay(saleRows, [...d7]),
      d30: sumByDay(saleRows, [...d30]),
      month: sumByDay(saleRows, monthDays),
    },
    payments: {
      d7: slices(d7),
      d30: slices(d30),
      month: slices(new Set(monthDays)),
    },
    stockFlow: [...stockMap.values()],
    finance: [...financeMap.values()].map((row) => ({
      day: row.day,
      ca: Math.round(row.ca * 100) / 100,
      depenses: Math.round(row.depenses * 100) / 100,
    })),
    activity: saleRows.slice(0, 8).map((row) => ({
      id: row.sale.id,
      at: row.sale.paidAt!.toISOString(),
      ticket: row.sale.ticketNumber,
      cashier: row.sale.cashierName?.trim() || "—",
      amount: row.sale.totalAmount,
      status: row.sale.status,
    })),
    alerts: alerts.map((product) => ({
      id: product.id,
      name: product.name,
      qty: product.stockQty,
    })),
    cash: {
      open: openSessions.length > 0,
      floatAndMovements,
      declared,
      gap:
        declared == null
          ? null
          : Math.round((floatAndMovements - declared) * 100) / 100,
    },
  };
}
