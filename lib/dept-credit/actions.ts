"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { canAccessBranch } from "@/lib/branch/user-branches";
import { boutiqueRoutes } from "@/lib/branch/paths";
import prisma from "@/lib/prisma";
import { writeAuditEvent } from "@/lib/audit/log";

async function ctx(organizationId: string, branchId: string) {
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
  return { user: session.user, branch };
}

export async function listDeptCustomersAction(
  organizationId: string,
  branchId: string,
) {
  await ctx(organizationId, branchId);
  return prisma.deptCustomer.findMany({
    where: { branchId, active: true },
    orderBy: { name: "asc" },
    include: {
      credits: {
        where: { status: { in: ["OPEN", "PARTIAL"] } },
        select: { totalUsd: true, paidUsd: true },
      },
    },
  });
}

export async function upsertDeptCustomerAction(input: {
  organizationId: string;
  branchId: string;
  id?: string;
  name: string;
  phone?: string;
  creditLimitUsd: number;
  notes?: string;
}) {
  await ctx(input.organizationId, input.branchId);
  const name = input.name.trim();
  if (name.length < 2) throw new Error("Nom client requis.");
  const data = {
    name,
    phone: input.phone?.trim() || null,
    creditLimitUsd: Math.max(0, input.creditLimitUsd),
    notes: input.notes?.trim() || null,
  };
  const row = input.id
    ? await prisma.deptCustomer.update({ where: { id: input.id }, data })
    : await prisma.deptCustomer.create({
        data: { ...data, branchId: input.branchId },
      });
  revalidatePath(boutiqueRoutes.pos(input.organizationId, input.branchId));
  return row;
}

export async function createDeptCreditAction(input: {
  organizationId: string;
  branchId: string;
  customerId: string;
  dueAt: string;
  lines: { name: string; qty: number; unitPriceUsd: number }[];
}) {
  const { user, branch } = await ctx(input.organizationId, input.branchId);
  const customer = await prisma.deptCustomer.findFirst({
    where: { id: input.customerId, branchId: input.branchId, active: true },
  });
  if (!customer) throw new Error("Client introuvable.");
  const lines = input.lines
    .map((l) => ({
      nameSnapshot: l.name.trim(),
      qty: Math.floor(l.qty),
      unitPriceUsd: l.unitPriceUsd,
      lineTotalUsd: Math.round(l.qty * l.unitPriceUsd * 100) / 100,
    }))
    .filter((l) => l.qty > 0 && l.unitPriceUsd > 0);
  if (!lines.length) throw new Error("Lignes invalides.");
  const totalUsd = Math.round(lines.reduce((s, l) => s + l.lineTotalUsd, 0) * 100) / 100;
  const open = await prisma.deptCredit.aggregate({
    where: { customerId: customer.id, status: { in: ["OPEN", "PARTIAL"] } },
    _sum: { totalUsd: true, paidUsd: true },
  });
  const outstanding =
    (open._sum.totalUsd ?? 0) - (open._sum.paidUsd ?? 0) + totalUsd;
  if (customer.creditLimitUsd > 0 && outstanding > customer.creditLimitUsd + 0.01) {
    throw new Error(
      `Plafond crédit dépassé (${customer.creditLimitUsd.toFixed(2)} USD).`,
    );
  }
  const count = await prisma.deptCredit.count({ where: { branchId: input.branchId } });
  const number = `CRD-${String(count + 1).padStart(5, "0")}`;
  const dueAt = new Date(input.dueAt);
  const credit = await prisma.deptCredit.create({
    data: {
      branchId: input.branchId,
      customerId: customer.id,
      number,
      dueAt,
      totalUsd,
      createdByUserId: user.id,
      lines: { create: lines },
    },
  });
  await writeAuditEvent({
    organizationId: input.organizationId,
    branchId: input.branchId,
    entityType: "CREDIT",
    entityId: credit.id,
    action: "CREATE",
    actorUserId: user.id,
    actorName: user.name || user.email || "Vendeur",
    newValue: { number, totalUsd, customer: customer.name },
  });
  revalidatePath(boutiqueRoutes.pos(input.organizationId, branch.id));
  return credit;
}

export async function payDeptCreditAction(input: {
  organizationId: string;
  branchId: string;
  creditId: string;
  amountUsd: number;
}) {
  const { user } = await ctx(input.organizationId, input.branchId);
  const credit = await prisma.deptCredit.findFirst({
    where: { id: input.creditId, branchId: input.branchId },
  });
  if (!credit) throw new Error("Crédit introuvable.");
  const paid = Math.min(input.amountUsd, credit.totalUsd - credit.paidUsd);
  if (!(paid > 0)) throw new Error("Montant invalide.");
  const paidUsd = Math.round((credit.paidUsd + paid) * 100) / 100;
  const status =
    paidUsd >= credit.totalUsd - 0.01 ? "SETTLED" : "PARTIAL";
  await prisma.deptCredit.update({
    where: { id: credit.id },
    data: { paidUsd, status },
  });
  await writeAuditEvent({
    organizationId: input.organizationId,
    branchId: input.branchId,
    entityType: "CREDIT",
    entityId: credit.id,
    action: "PAY",
    actorUserId: user.id,
    actorName: user.name || user.email || "Caissier",
    newValue: { paidUsd, status },
  });
  return { ok: true as const, status, paidUsd };
}
