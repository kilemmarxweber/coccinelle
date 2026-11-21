"use server";

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { isAppAdminRole, normalizeOrgRole, ORG_ROLE } from "@/lib/permissions";
import prisma from "@/lib/prisma";
import { findingFingerprint, saleWithoutStockDrafts, type IntegrityDraft } from "@/lib/bia/integrity";

async function requireBiaReader(organizationId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) throw new Error("Non authentifié.");
  if (isAppAdminRole(session.user.role)) {
    return { user: session.user, technical: true };
  }
  const member = await prisma.member.findFirst({
    where: { organizationId, userId: session.user.id },
    select: { role: true },
  });
  if (!member) throw new Error("Organisation inaccessible.");
  const role = normalizeOrgRole(member.role);
  if (role === ORG_ROLE.USER) {
    throw new Error("Le BIA est réservé au PCA et à l'admin IT.");
  }
  return { user: session.user, technical: role === ORG_ROLE.ADMIN };
}

export async function getDatabaseHealthAction(organizationId: string) {
  await requireBiaReader(organizationId);
  try {
    await prisma.$queryRaw`SELECT 1`;
    const rows = await prisma.$queryRaw<{ count: number }[]>`
      SELECT count(*)::int AS count FROM pg_stat_activity
    `;
    return { ok: true as const, connections: Number(rows[0]?.count ?? 0) };
  } catch {
    return { ok: false as const, connections: null };
  }
}

export async function runIntegrityChecksAction(organizationId: string) {
  const { user } = await requireBiaReader(organizationId);
  const since = new Date();
  since.setDate(since.getDate() - 31);

  const [sales, remittances, sessions] = await Promise.all([
    prisma.shopSale.findMany({
      where: {
        status: "ENCAISSEE",
        paidAt: { gte: since },
        branch: { organizationId },
      },
      select: {
        id: true,
        ticketNumber: true,
        branchId: true,
        items: { select: { productId: true, quantity: true } },
        stockMovements: { select: { kind: true, productId: true, quantity: true } },
      },
      take: 300,
    }),
    prisma.cashRemittance.findMany({
      where: { organizationId, status: "PREPARED" },
      select: {
        id: true,
        number: true,
        fromBranchId: true,
        expectedUsd: true,
        declaredUsd: true,
      },
      take: 100,
    }),
    prisma.cashSession.findMany({
      where: {
        status: "CLOSED",
        closedAt: { gte: since },
        branch: { organizationId },
        varianceUsd: { not: null },
      },
      select: {
        id: true,
        branchId: true,
        varianceUsd: true,
      },
      take: 100,
    }),
  ]);

  const drafts: IntegrityDraft[] = [
    ...saleWithoutStockDrafts(sales),
    ...remittances.map(
      (row): IntegrityDraft => ({
        ruleCode: "VERSEMENT_SANS_RECEPTION",
        severity: "MOYENNE",
        title: `Versement ${row.number} sans réception`,
        detail: `Déclaré ${row.declaredUsd.toFixed(2)} $ · théorique ${row.expectedUsd.toFixed(2)} $.`,
        entityType: "CashRemittance",
        entityId: row.id,
        branchId: row.fromBranchId,
      }),
    ),
    ...sessions
      .filter((row) => Math.abs(row.varianceUsd ?? 0) >= 0.01)
      .map(
        (row): IntegrityDraft => ({
          ruleCode: "ECART_CAISSE",
          severity: "ELEVEE",
          title: "Écart de caisse à la clôture",
          detail: `Écart ${row.varianceUsd?.toFixed(2)} $.`,
          entityType: "CashSession",
          entityId: row.id,
          branchId: row.branchId,
        }),
      ),
  ];

  for (const draft of drafts) {
    const fingerprint = findingFingerprint(draft.ruleCode, draft.entityId);
    await prisma.integrityFinding.upsert({
      where: {
        organizationId_fingerprint: { organizationId, fingerprint },
      },
      create: {
        organizationId,
        branchId: draft.branchId,
        ruleCode: draft.ruleCode,
        severity: draft.severity,
        title: draft.title,
        detail: draft.detail,
        entityType: draft.entityType,
        entityId: draft.entityId,
        fingerprint,
      },
      update: {
        title: draft.title,
        detail: draft.detail,
        severity: draft.severity,
        detectedAt: new Date(),
      },
    });
  }

  await prisma.auditEvent.create({
    data: {
      organizationId,
      entityType: "BiaIntegrityRun",
      entityId: organizationId,
      action: "RUN_CHECKS",
      actorUserId: user.id,
      actorName: user.name?.trim() || user.email || "Admin IT",
      reason: `${drafts.length} constat(s) détectés, aucune donnée métier modifiée.`,
    },
  });

  return { detected: drafts.length };
}

export async function listBiaOverviewAction(organizationId: string) {
  await requireBiaReader(organizationId);
  const [findings, incidents, auditCount] = await Promise.all([
    prisma.integrityFinding.findMany({
      where: { organizationId },
      orderBy: { detectedAt: "desc" },
      take: 80,
      include: { branch: { select: { name: true } }, incident: { select: { id: true, status: true } } },
    }),
    prisma.biaIncident.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      take: 40,
      include: { events: { orderBy: { createdAt: "desc" }, take: 3 } },
    }),
    prisma.auditEvent.count({
      where: {
        organizationId,
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
    }),
  ]);
  return {
    findings: findings.map((row) => ({
      id: row.id,
      ruleCode: row.ruleCode,
      severity: row.severity,
      status: row.status,
      title: row.title,
      detail: row.detail,
      branchName: row.branch?.name ?? "Organisation",
      detectedAt: row.detectedAt.toISOString(),
      incidentId: row.incident?.id ?? null,
    })),
    incidents: incidents.map((row) => ({
      id: row.id,
      title: row.title,
      severity: row.severity,
      status: row.status,
      assigneeName: row.assigneeName,
      openedByName: row.openedByName,
      createdAt: row.createdAt.toISOString(),
      lastNote: row.events[0]?.note ?? row.events[0]?.action ?? null,
    })),
    auditCount,
  };
}

export async function openBiaIncidentAction(input: {
  organizationId: string;
  findingId: string;
}) {
  const { user } = await requireBiaReader(input.organizationId);
  const finding = await prisma.integrityFinding.findFirst({
    where: { id: input.findingId, organizationId: input.organizationId },
  });
  if (!finding) throw new Error("Constat introuvable.");
  const existing = await prisma.biaIncident.findUnique({
    where: { findingId: finding.id },
  });
  if (existing) return existing.id;
  const name = user.name?.trim() || user.email || "Admin IT";
  const incident = await prisma.biaIncident.create({
    data: {
      organizationId: input.organizationId,
      findingId: finding.id,
      title: finding.title,
      severity: finding.severity,
      openedByUserId: user.id,
      openedByName: name,
      events: {
        create: {
          action: "OUVERTURE",
          actorName: name,
          note: "Ouvert depuis le constat. La donnée métier n'est pas modifiée.",
        },
      },
    },
  });
  await prisma.integrityFinding.update({
    where: { id: finding.id },
    data: { status: "QUALIFIE" },
  });
  return incident.id;
}

export async function advanceBiaIncidentAction(input: {
  organizationId: string;
  incidentId: string;
  status: "EN_COURS" | "RESOLU" | "CLOS";
  note: string;
}) {
  const { user } = await requireBiaReader(input.organizationId);
  const note = input.note.trim();
  if (note.length < 4) throw new Error("Indiquez une note d'au moins 4 caractères.");
  const incident = await prisma.biaIncident.findFirst({
    where: { id: input.incidentId, organizationId: input.organizationId },
  });
  if (!incident) throw new Error("Incident introuvable.");
  const name = user.name?.trim() || user.email || "Admin IT";
  await prisma.$transaction([
    prisma.biaIncident.update({
      where: { id: incident.id },
      data: {
        status: input.status,
        closedAt: input.status === "CLOS" ? new Date() : null,
      },
    }),
    prisma.biaIncidentEvent.create({
      data: {
        incidentId: incident.id,
        action: input.status,
        actorName: name,
        note,
      },
    }),
    ...(incident.findingId
      ? [
          prisma.integrityFinding.update({
            where: { id: incident.findingId },
            data: {
              status: input.status === "CLOS" || input.status === "RESOLU" ? "RESOLU" : "QUALIFIE",
              resolvedAt: input.status === "CLOS" || input.status === "RESOLU" ? new Date() : null,
            },
          }),
        ]
      : []),
  ]);
}
