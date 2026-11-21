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

export async function getCentralCashDashboardAction(organizationId: string) {
  await assertOrgStaff(organizationId);
  const account = await ensureOrgCashAccount(organizationId);
  const [remittances, journal, branches] = await Promise.all([
    prisma.cashRemittance.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      take: 80,
      include: { fromBranch: { select: { name: true, code: true } } },
    }),
    prisma.centralCashEntry.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      take: 80,
    }),
    prisma.branch.findMany({
      where: { organizationId, status: "ACTIVE" },
      select: { id: true, name: true, code: true },
      orderBy: { name: "asc" },
    }),
  ]);
  return {
    balanceUsd: account.balanceUsd,
    remittances: remittances.map((r) => ({
      id: r.id,
      number: r.number,
      status: r.status,
      expectedUsd: r.expectedUsd,
      declaredUsd: r.declaredUsd,
      receivedUsd: r.receivedUsd,
      varianceDeclaredUsd: r.varianceDeclaredUsd,
      varianceReceivedUsd: r.varianceReceivedUsd,
      createdAt: r.createdAt.toISOString(),
      receivedAt: r.receivedAt?.toISOString() ?? null,
      branchName: r.fromBranch.name,
      branchCode: r.fromBranch.code,
      note: r.note,
    })),
    journal: journal.map((j) => ({
      id: j.id,
      number: j.number,
      kind: j.kind,
      amountUsd: j.amountUsd,
      justification: j.justification,
      createdAt: j.createdAt.toISOString(),
    })),
    branches,
  };
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
