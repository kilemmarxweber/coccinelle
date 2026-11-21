"use server";

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { isAppAdminRole } from "@/lib/permissions";
import prisma from "@/lib/prisma";
import { paymentAmountUsd, toIsoDate } from "@/lib/hotel/reports/period";
import { pcaTargetPct, resolvePcaPeriod, type PcaView } from "@/lib/org/pca-period";

async function assertOrg(organizationId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) throw new Error("Non authentifié.");
  if (!isAppAdminRole(session.user.role)) {
    const m = await prisma.member.findFirst({
      where: { organizationId, userId: session.user.id },
      select: { id: true },
    });
    if (!m) throw new Error("Organisation inaccessible.");
  }
}

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export async function getPcaDashboardAction(
  organizationId: string,
  periodInput?: {
    vue?: string | null;
    annee?: string | null;
    mois?: string | null;
    jour?: string | null;
    n?: string | null;
  },
) {
  await assertOrg(organizationId);
  const now = new Date();
  const period = resolvePcaPeriod(periodInput ?? {}, now);
  const bounds = { gte: period.from, lte: period.to };
  const refDay = period.includesToday ? startOfDay(now) : startOfDay(period.to);
  const branches = await prisma.branch.findMany({
    where: { organizationId, status: { not: "CLOSED" } },
    select: {
      id: true,
      name: true,
      code: true,
      type: true,
      salesTargetUsd: true,
    },
    orderBy: { name: "asc" },
  });
  const branchIds = branches.map((b) => b.id);

  const [payments, remittances, sessions, unjustified, corrections, credits, deptCredits, expenses, sales] =
    await Promise.all([
      prisma.payment.findMany({
        where: {
          branchId: { in: branchIds },
          paidAt: bounds,
          expenseId: null,
          purchaseOrderId: null,
        },
        select: {
          branchId: true,
          amountCdf: true,
          amountForeign: true,
          exchangeRateUsed: true,
          paidAt: true,
          shopSale: { select: { status: true } },
        },
      }),
      prisma.cashRemittance.findMany({
        where: period.includesToday
          ? { organizationId, status: { in: ["PREPARED", "DISPUTED"] } }
          : {
              organizationId,
              status: { in: ["PREPARED", "DISPUTED"] },
              createdAt: bounds,
            },
        include: { fromBranch: { select: { name: true } } },
      }),
      prisma.cashSession.findMany({
        where: {
          branchId: { in: branchIds },
          closedAt: bounds,
          varianceUsd: { not: 0 },
        },
        select: {
          id: true,
          branchId: true,
          varianceUsd: true,
          expectedCashUsd: true,
          declaredCashUsd: true,
        },
      }),
      prisma.purchaseOrder.findMany({
        where: {
          branchId: { in: branchIds },
          justificationMissing: true,
          ...(period.includesToday ? {} : { createdAt: bounds }),
        },
        select: { id: true, number: true, branchId: true, buyerAdvanceUsd: true },
      }),
      prisma.shopSale.findMany({
        where: {
          branchId: { in: branchIds },
          status: "CORRIGEE",
          correctedAt: bounds,
        },
        select: { id: true, ticketNumber: true, branchId: true, totalAmount: true },
      }),
      prisma.factoryCredit.findMany({
        where: {
          branchId: { in: branchIds },
          status: { in: ["OPEN", "PARTIAL"] },
        },
        select: { totalUsd: true, paidUsd: true, branchId: true },
      }),
      prisma.deptCredit.findMany({
        where: {
          branchId: { in: branchIds },
          status: { in: ["OPEN", "PARTIAL"] },
        },
        select: { totalUsd: true, paidUsd: true, branchId: true },
      }),
      prisma.branchExpense.findMany({
        where: { branchId: { in: branchIds }, createdAt: bounds },
        select: { amountUsd: true, branchId: true, kind: true, createdAt: true },
      }),
      prisma.shopSale.findMany({
        where: {
          branchId: { in: branchIds },
          paidAt: bounds,
          status: "ENCAISSEE",
        },
        select: {
          branchId: true,
          items: { select: { productId: true, quantity: true } },
        },
      }),
    ]);

  const byBranch = new Map(
    branches.map((b) => [
      b.id,
      {
        ...b,
        salesDayUsd: 0,
        salesMonthUsd: 0,
        expensesMonthUsd: 0,
        creditsOpenUsd: 0,
        cmvUsd: 0,
      },
    ]),
  );

  for (const p of payments) {
    if (p.shopSale?.status === "CORRIGEE") continue;
    const usd = paymentAmountUsd(
      {
        amountCdf: p.amountCdf,
        amountForeign: p.amountForeign,
      },
      p.exchangeRateUsed ?? null,
    );
    const row = byBranch.get(p.branchId);
    if (!row) continue;
    if (usd <= 0) continue;
    row.salesMonthUsd += usd;
    if (p.paidAt >= refDay && p.paidAt <= period.to) row.salesDayUsd += usd;
  }
  for (const e of expenses) {
    const row = byBranch.get(e.branchId);
    if (row && e.kind !== "PRET_PROPRIETAIRE") row.expensesMonthUsd += e.amountUsd;
  }
  for (const c of credits) {
    const row = byBranch.get(c.branchId);
    if (row) row.creditsOpenUsd += c.totalUsd - c.paidUsd;
  }
  for (const c of deptCredits) {
    const row = byBranch.get(c.branchId);
    if (row) row.creditsOpenUsd += c.totalUsd - c.paidUsd;
  }

  const productIds = [
    ...new Set(
      sales
        .flatMap((s) => s.items.map((i) => i.productId))
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const costs = productIds.length
    ? await prisma.warehouseProduct.findMany({
        where: { shopProductId: { in: productIds } },
        select: { shopProductId: true, unitCostUsd: true, branchId: true },
      })
    : [];
  const costByKey = new Map(
    costs.map((c) => [`${c.branchId}:${c.shopProductId}`, c.unitCostUsd]),
  );
  for (const sale of sales) {
    const row = byBranch.get(sale.branchId);
    if (!row) continue;
    for (const item of sale.items) {
      const unit = costByKey.get(`${sale.branchId}:${item.productId}`) ?? 0;
      row.cmvUsd += unit * item.quantity;
    }
  }

  const departments = [...byBranch.values()].map((d) => {
    const ca = d.salesMonthUsd;
    const cmv = d.cmvUsd;
    const margin = ca - cmv;
    const result = margin - d.expensesMonthUsd;
    return {
      ...d,
      salesDayUsd: round2(d.salesDayUsd),
      salesMonthUsd: round2(d.salesMonthUsd),
      expensesMonthUsd: round2(d.expensesMonthUsd),
      creditsOpenUsd: round2(d.creditsOpenUsd),
      cmvUsd: round2(cmv),
      marginUsd: round2(margin),
      resultUsd: round2(result),
      vsTargetPct: pcaTargetPct(
        d.salesMonthUsd,
        d.salesTargetUsd,
        period.monthsInPeriod,
        period.span,
      ),
    };
  });

  const alerts: { kind: string; label: string }[] = [];
  for (const s of sessions) {
    const b = byBranch.get(s.branchId);
    alerts.push({
      kind: "caisse",
      label: `Écart caisse ${b?.name ?? ""} : ${s.varianceUsd?.toFixed(2)} USD`,
    });
  }
  for (const r of remittances) {
    alerts.push({
      kind: "versement",
      label: `Versement ${r.number} (${r.fromBranch.name}) en attente`,
    });
  }
  for (const p of unjustified) {
    const b = byBranch.get(p.branchId);
    alerts.push({
      kind: "achat",
      label: `Achat ${p.number} non justifié · ${b?.name ?? ""}`,
    });
  }
  for (const c of corrections) {
    const b = byBranch.get(c.branchId);
    alerts.push({
      kind: "correction",
      label: `Vente ${c.ticketNumber} corrigée · ${b?.name ?? ""}`,
    });
  }

  const salesDay = round2(departments.reduce((s, d) => s + d.salesDayUsd, 0));
  const salesMonth = round2(departments.reduce((s, d) => s + d.salesMonthUsd, 0));
  const cmvMonth = round2(departments.reduce((s, d) => s + d.cmvUsd, 0));
  const marginMonth = round2(departments.reduce((s, d) => s + d.marginUsd, 0));
  const expensesMonth = round2(
    departments.reduce((s, d) => s + d.expensesMonthUsd, 0),
  );
  const resultMonth = round2(departments.reduce((s, d) => s + d.resultUsd, 0));
  const creditsOpen = round2(
    departments.reduce((s, d) => s + d.creditsOpenUsd, 0),
  );
  const toRemit = round2(remittances.reduce((s, r) => s + r.declaredUsd, 0));
  const monthlyTargetSum = departments.reduce(
    (s, d) => s + (d.salesTargetUsd && d.salesTargetUsd > 0 ? d.salesTargetUsd : 0),
    0,
  );
  const vsTargetPctTotal = pcaTargetPct(
    salesMonth,
    monthlyTargetSum,
    period.monthsInPeriod,
    period.span,
  );

  const dailyMap = new Map<string, { ventes: number; charges: number }>();
  const buckets =
    period.seriesGrain === "mois"
      ? eachMonthInclusive(period.from, period.to)
      : eachDayInclusive(period.from, period.to);
  for (const iso of buckets) {
    dailyMap.set(iso, { ventes: 0, charges: 0 });
  }
  for (const p of payments) {
    if (p.shopSale?.status === "CORRIGEE") continue;
    const usd = paymentAmountUsd(
      {
        amountCdf: p.amountCdf,
        amountForeign: p.amountForeign,
      },
      p.exchangeRateUsed ?? null,
    );
    if (usd <= 0) continue;
    const row = dailyMap.get(bucketKey(p.paidAt, period.seriesGrain));
    if (row) row.ventes += usd;
  }
  for (const e of expenses) {
    if (e.kind === "PRET_PROPRIETAIRE") continue;
    const row = dailyMap.get(bucketKey(e.createdAt, period.seriesGrain));
    if (row) row.charges += e.amountUsd;
  }
  const series = [...dailyMap.entries()].map(([day, v]) => ({
    day,
    ventes: round2(v.ventes),
    charges: round2(v.charges),
  }));

  return {
    view: period.view satisfies PcaView,
    year: period.year,
    month: period.month,
    day: period.day,
    span: period.span,
    reportKind: period.reportKind,
    from: toIsoDate(period.from),
    to: toIsoDate(period.to),
    periodLabel: period.periodLabel,
    rangeLabel: period.rangeLabel,
    dayKpiLabel: period.dayKpiLabel,
    periodKpiLabel: period.periodKpiLabel,
    periodColumnLabel: period.periodColumnLabel,
    seriesGrain: period.seriesGrain,
    includesToday: period.includesToday,
    todayYear: now.getFullYear(),
    todayMonth: now.getMonth() + 1,
    todayDay: now.getDate(),
    salesDay,
    salesMonth,
    cmvMonth,
    marginMonth,
    expensesMonth,
    resultMonth,
    creditsOpen,
    toRemit,
    vsTargetPctTotal,
    alerts,
    departments,
    series,
  };
}

function eachDayInclusive(from: Date, to: Date) {
  const days: string[] = [];
  const cur = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const end = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  while (cur <= end) {
    days.push(toIsoDate(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

function eachMonthInclusive(from: Date, to: Date) {
  const months: string[] = [];
  const cur = new Date(from.getFullYear(), from.getMonth(), 1);
  const end = new Date(to.getFullYear(), to.getMonth(), 1);
  while (cur <= end) {
    months.push(toIsoDate(cur));
    cur.setMonth(cur.getMonth() + 1);
  }
  return months;
}

function bucketKey(date: Date, grain: "jour" | "mois") {
  if (grain === "jour") return toIsoDate(date);
  return toIsoDate(new Date(date.getFullYear(), date.getMonth(), 1));
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export async function setBranchSalesTargetAction(input: {
  organizationId: string;
  branchId: string;
  salesTargetUsd: number;
}) {
  await assertOrg(input.organizationId);
  await prisma.branch.updateMany({
    where: { id: input.branchId, organizationId: input.organizationId },
    data: { salesTargetUsd: input.salesTargetUsd },
  });
  return { ok: true as const };
}
