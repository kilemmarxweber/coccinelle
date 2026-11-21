"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { isAppAdminRole, normalizeOrgRole, ORG_ROLE } from "@/lib/permissions";
import prisma from "@/lib/prisma";
import { writeAuditEvent } from "@/lib/audit/log";
import {
  ensureOrgCashAccount,
  postCentralMovement,
  receiveRemittance,
} from "@/lib/central-cash/service";
import { toIsoDate } from "@/lib/hotel/reports/period";
import { resolvePcaPeriod, type PcaView } from "@/lib/org/pca-period";

async function assertOrgStaff(organizationId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) throw new Error("Non authentifié.");
  const isAdmin = isAppAdminRole(session.user.role);
  const membership = await prisma.member.findFirst({
    where: { organizationId, userId: session.user.id },
    select: { role: true },
  });
  if (!isAdmin && !membership) {
    throw new Error("Organisation inaccessible.");
  }
  return { user: session.user, membership };
}

function canReceive(role: string | undefined, isAdmin: boolean) {
  if (isAdmin) return true;
  const n = normalizeOrgRole(role);
  return n === ORG_ROLE.OWNER || n === ORG_ROLE.ADMIN;
}

export async function getCentralCashDashboardAction(
  organizationId: string,
  periodInput: {
    vue?: string | null;
    annee?: string | null;
    mois?: string | null;
    jour?: string | null;
    n?: string | null;
  } = {},
) {
  await assertOrgStaff(organizationId);
  const now = new Date();
  const period = resolvePcaPeriod(periodInput, now);
  const bounds = { gte: period.from, lte: period.to };
  const previous = previousWindow(period.from, period.span);
  const account = await ensureOrgCashAccount(organizationId);
  const [remittances, journal, previousJournal, branches] = await Promise.all([
    prisma.cashRemittance.findMany({
      where: period.includesToday
        ? {
            organizationId,
            OR: [{ createdAt: bounds }, { status: { not: "RECEIVED" } }],
          }
        : { organizationId, createdAt: bounds },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { fromBranch: { select: { name: true, code: true } } },
    }),
    prisma.centralCashEntry.findMany({
      where: { organizationId, createdAt: bounds },
      orderBy: { createdAt: "desc" },
      take: 400,
      include: {
        remittance: {
          select: {
            number: true,
            fromBranch: { select: { name: true, code: true } },
          },
        },
      },
    }),
    prisma.centralCashEntry.findMany({
      where: {
        organizationId,
        createdAt: { gte: previous.from, lte: previous.to },
      },
      select: { amountUsd: true },
    }),
    prisma.branch.findMany({
      where: { organizationId, status: "ACTIVE" },
      select: { id: true, name: true, code: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const inflowsUsd = round2(
    journal.reduce((sum, row) => sum + (row.amountUsd > 0 ? row.amountUsd : 0), 0),
  );
  const outflowsUsd = round2(
    journal.reduce(
      (sum, row) => sum + (row.amountUsd < 0 ? Math.abs(row.amountUsd) : 0),
      0,
    ),
  );
  const netUsd = round2(inflowsUsd - outflowsUsd);
  const previousNetUsd = round2(
    previousJournal.reduce((sum, row) => sum + row.amountUsd, 0),
  );
  const series = buildSeries(journal, period.from, period.to, period.seriesGrain);
  const byDepartment = new Map<string, { name: string; code: string; amountUsd: number }>();
  for (const row of journal) {
    if (row.kind !== "REMITTANCE_IN" || !row.remittance) continue;
    const branch = row.remittance.fromBranch;
    const current = byDepartment.get(branch.code) ?? {
      name: branch.name,
      code: branch.code,
      amountUsd: 0,
    };
    current.amountUsd += row.amountUsd;
    byDepartment.set(branch.code, current);
  }
  const departments = [...byDepartment.values()]
    .map((row) => ({ ...row, amountUsd: round2(row.amountUsd) }))
    .sort((a, b) => b.amountUsd - a.amountUsd);

  const alerts: { kind: string; label: string }[] = [];
  for (const rem of remittances) {
    if (rem.status === "PREPARED") {
      alerts.push({
        kind: "attente",
        label: `Versement ${rem.number} (${rem.fromBranch.name}) en attente de réception.`,
      });
    } else if (rem.status === "DISPUTED") {
      alerts.push({
        kind: "ecart",
        label: `Écart sur ${rem.number} (${rem.fromBranch.name}) : ${rem.varianceReceivedUsd?.toFixed(2) ?? "0.00"} USD.`,
      });
    }
  }

  const top = [...journal]
    .sort((a, b) => Math.abs(b.amountUsd) - Math.abs(a.amountUsd))
    .slice(0, 4)
    .map((row) => ({
      id: row.id,
      number: row.number,
      kind: row.kind,
      amountUsd: row.amountUsd,
      justification: row.justification,
      createdAt: row.createdAt.toISOString(),
      branchName: row.remittance?.fromBranch.name ?? null,
    }));

  const pending = remittances.filter((row) => row.status !== "RECEIVED");

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
    seriesGrain: period.seriesGrain,
    includesToday: period.includesToday,
    todayYear: now.getFullYear(),
    todayMonth: now.getMonth() + 1,
    todayDay: now.getDate(),
    balanceUsd: round2(account.balanceUsd),
    inflowsUsd,
    outflowsUsd,
    netUsd,
    previousNetUsd,
    netDeltaPct: changePct(netUsd, previousNetUsd),
    pendingCount: pending.length,
    pendingUsd: round2(pending.reduce((sum, row) => sum + row.declaredUsd, 0)),
    disputedCount: remittances.filter((row) => row.status === "DISPUTED").length,
    series,
    departments,
    top,
    alerts,
    remittances: remittances.map((row) => ({
      id: row.id,
      number: row.number,
      status: row.status,
      expectedUsd: row.expectedUsd,
      declaredUsd: row.declaredUsd,
      receivedUsd: row.receivedUsd,
      varianceDeclaredUsd: row.varianceDeclaredUsd,
      varianceReceivedUsd: row.varianceReceivedUsd,
      createdAt: row.createdAt.toISOString(),
      receivedAt: row.receivedAt?.toISOString() ?? null,
      branchName: row.fromBranch.name,
      branchCode: row.fromBranch.code,
      note: row.note,
    })),
    journal: journal.map((row) => ({
      id: row.id,
      number: row.number,
      kind: row.kind,
      amountUsd: row.amountUsd,
      justification: row.justification,
      createdAt: row.createdAt.toISOString(),
      branchName: row.remittance?.fromBranch.name ?? null,
    })),
    branches,
  };
}

function previousWindow(from: Date, span: number) {
  const to = new Date(from.getTime() - 1);
  const start = new Date(to.getFullYear(), to.getMonth(), to.getDate() - (span - 1), 0, 0, 0, 0);
  return { from: start, to };
}

function buildSeries(
  journal: { amountUsd: number; createdAt: Date }[],
  from: Date,
  to: Date,
  grain: "jour" | "mois",
) {
  const buckets = grain === "mois" ? eachMonth(from, to) : eachDay(from, to);
  const map = new Map(buckets.map((day) => [day, { day, entrees: 0, sorties: 0 }]));
  for (const row of journal) {
    const key = grain === "mois"
      ? toIsoDate(new Date(row.createdAt.getFullYear(), row.createdAt.getMonth(), 1))
      : toIsoDate(row.createdAt);
    const bucket = map.get(key);
    if (!bucket) continue;
    if (row.amountUsd >= 0) bucket.entrees += row.amountUsd;
    else bucket.sorties += Math.abs(row.amountUsd);
  }
  return [...map.values()].map((row) => ({
    day: row.day,
    entrees: round2(row.entrees),
    sorties: round2(row.sorties),
  }));
}

function eachDay(from: Date, to: Date) {
  const days: string[] = [];
  const cur = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const end = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  while (cur <= end) {
    days.push(toIsoDate(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

function eachMonth(from: Date, to: Date) {
  const months: string[] = [];
  const cur = new Date(from.getFullYear(), from.getMonth(), 1);
  const end = new Date(to.getFullYear(), to.getMonth(), 1);
  while (cur <= end) {
    months.push(toIsoDate(cur));
    cur.setMonth(cur.getMonth() + 1);
  }
  return months;
}

function changePct(current: number, previous: number) {
  if (Math.abs(previous) < 0.005) return null;
  return Math.round(((current - previous) / Math.abs(previous)) * 1000) / 10;
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

export async function receiveRemittanceAction(input: {
  organizationId: string;
  remittanceId: string;
  receivedUsd: number;
  note?: string;
}) {
  const { user, membership } = await assertOrgStaff(input.organizationId);
  const isAdmin = isAppAdminRole(user.role);
  if (!canReceive(membership?.role, isAdmin)) {
    throw new Error("Seul le comptable / owner peut accuser réception.");
  }
  const rem = await receiveRemittance({
    organizationId: input.organizationId,
    remittanceId: input.remittanceId,
    receivedUsd: input.receivedUsd,
    userId: user.id,
    note: input.note,
  });
  await writeAuditEvent({
    organizationId: input.organizationId,
    branchId: rem.fromBranchId,
    entityType: "REMITTANCE",
    entityId: rem.id,
    action: "RECEIVE",
    actorUserId: user.id,
    actorName: user.name || user.email || "Comptable",
    reason: input.note,
    newValue: {
      receivedUsd: rem.receivedUsd,
      status: rem.status,
    },
  });
  revalidatePath(`/admin/organizations/${input.organizationId}/caisse-centrale`);
  revalidatePath(`/admin/organizations/${input.organizationId}/pca`);
  return rem;
}

export async function postCentralCashAction(input: {
  organizationId: string;
  kind: "ENTRY" | "EXIT";
  amountUsd: number;
  justification: string;
}) {
  const { user, membership } = await assertOrgStaff(input.organizationId);
  const isAdmin = isAppAdminRole(user.role);
  if (!canReceive(membership?.role, isAdmin)) {
    throw new Error("Approbation comptable requise pour un mouvement coffre.");
  }
  const entry = await postCentralMovement({
    ...input,
    userId: user.id,
  });
  await writeAuditEvent({
    organizationId: input.organizationId,
    entityType: "CASH",
    entityId: entry.id,
    action: input.kind,
    actorUserId: user.id,
    actorName: user.name || user.email || "Comptable",
    reason: input.justification,
    newValue: { amountUsd: entry.amountUsd, kind: entry.kind },
  });
  revalidatePath(`/admin/organizations/${input.organizationId}/caisse-centrale`);
  return entry;
}
