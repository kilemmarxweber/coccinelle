import prisma from "@/lib/prisma";

const WINDOW_DAYS = 31;

export async function loadControlBoards(organizationId: string) {
  const since = new Date();
  since.setDate(since.getDate() - WINDOW_DAYS);

  const [sessions, remittances, movements, members, invitations, activeSessions] =
    await Promise.all([
      prisma.cashSession.findMany({
        where: {
          branch: { organizationId },
          OR: [{ openedAt: { gte: since } }, { status: "OPEN" }],
        },
        orderBy: { openedAt: "desc" },
        take: 40,
        include: { branch: { select: { name: true } } },
      }),
      prisma.cashRemittance.count({
        where: { organizationId, status: { not: "RECEIVED" } },
      }),
      prisma.warehouseMovement.findMany({
        where: { branch: { organizationId }, createdAt: { gte: since } },
        orderBy: { createdAt: "desc" },
        take: 60,
        include: {
          branch: { select: { name: true } },
          product: { select: { name: true } },
        },
      }),
      prisma.member.findMany({
        where: { organizationId },
        orderBy: { createdAt: "desc" },
        take: 40,
        include: {
          user: {
            select: { name: true, mustChangePassword: true, banned: true },
          },
        },
      }),
      prisma.invitation.findMany({
        where: { organizationId, status: "pending" },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: { id: true, email: true, role: true, status: true, createdAt: true },
      }),
      prisma.session.count({
        where: {
          expiresAt: { gt: new Date() },
          user: { members: { some: { organizationId } } },
        },
      }),
    ]);

  const closed = sessions.filter((row) => row.status === "CLOSED");
  const clean = closed.filter((row) => Math.abs(row.varianceUsd ?? 0) < 0.01);
  const varianceUsd = round2(
    closed.reduce((sum, row) => sum + (row.varianceUsd ?? 0), 0),
  );

  const kindCount = new Map<string, number>();
  let inQty = 0;
  let outQty = 0;
  for (const row of movements) {
    kindCount.set(row.kind, (kindCount.get(row.kind) ?? 0) + 1);
    if (row.kind === "ENTREE" || row.kind === "RETOUR") inQty += row.quantity;
    if (row.kind === "SORTIE" || row.kind === "PERTE" || row.kind === "CONSO") {
      outQty += row.quantity;
    }
  }

  return {
    windowDays: WINDOW_DAYS,
    updatedAt: new Date().toISOString(),
    cash: {
      sessions: sessions.length,
      closed: closed.length,
      open: sessions.filter((row) => row.status === "OPEN").length,
      clean: clean.length,
      varianceUsd,
      pendingRemittances: remittances,
      rows: sessions.slice(0, 8).map((row) => ({
        id: row.id,
        branch: row.branch.name,
        status: row.status,
        expected: row.expectedCashUsd,
        declared: row.declaredCashUsd,
        variance: row.varianceUsd,
        at: (row.closedAt ?? row.openedAt).toISOString(),
      })),
    },
    stock: {
      movements: movements.length,
      inQty,
      outQty,
      adjustments: kindCount.get("AJUSTEMENT") ?? 0,
      losses: (kindCount.get("PERTE") ?? 0) + (kindCount.get("INVENTAIRE") ?? 0),
      byKind: [...kindCount.entries()]
        .map(([kind, count]) => ({ kind, count }))
        .sort((a, b) => b.count - a.count),
      rows: movements.slice(0, 8).map((row) => ({
        id: row.id,
        at: row.createdAt.toISOString(),
        branch: row.branch.name,
        product: row.product.name,
        kind: row.kind,
        quantity: row.quantity,
        before: row.stockBefore,
        after: row.stockAfter,
      })),
    },
    access: {
      members: members.length,
      invitations: invitations.length,
      activeSessions,
      mustChange: members.filter((row) => row.user.mustChangePassword).length,
      suspended: members.filter((row) => row.user.banned).length,
      rows: members.slice(0, 8).map((row) => ({
        id: row.id,
        name: row.user.name?.trim() || "Compte",
        role: row.role,
        since: row.createdAt.toISOString(),
        mustChange: row.user.mustChangePassword,
        suspended: Boolean(row.user.banned),
      })),
      invites: invitations.map((row) => ({
        id: row.id,
        email: row.email,
        role: row.role ?? "user",
        status: row.status,
      })),
    },
  };
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

export type ControlBoards = Awaited<ReturnType<typeof loadControlBoards>>;
