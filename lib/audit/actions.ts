"use server";

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { isAppAdminRole } from "@/lib/permissions";
import prisma from "@/lib/prisma";

export async function listAuditEventsAction(input: {
  organizationId: string;
  branchId?: string;
  entityType?: string;
  take?: number;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) throw new Error("Non authentifié.");
  const isAdmin = isAppAdminRole(session.user.role);
  if (!isAdmin) {
    const member = await prisma.member.findFirst({
      where: { organizationId: input.organizationId, userId: session.user.id },
      select: { id: true },
    });
    if (!member) throw new Error("Organisation inaccessible.");
  }

  const rows = await prisma.auditEvent.findMany({
    where: {
      organizationId: input.organizationId,
      ...(input.branchId ? { branchId: input.branchId } : {}),
      ...(input.entityType ? { entityType: input.entityType } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: input.take ?? 200,
    include: { branch: { select: { name: true, code: true } } },
  });

  return rows.map((r) => ({
    id: r.id,
    createdAt: r.createdAt.toISOString(),
    entityType: r.entityType,
    entityId: r.entityId,
    action: r.action,
    actorName: r.actorName,
    reason: r.reason,
    branchName: r.branch?.name ?? "Organisation",
    oldValue: r.oldValue,
    newValue: r.newValue,
  }));
}
