import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import { getAuditBoardsAction, listAuditEventsAction } from "@/lib/audit/actions";
import { resolvePcaPeriod } from "@/lib/org/pca-period";
import { toIsoDate } from "@/lib/hotel/reports/period";
import { AuditClient } from "./audit-client";

type PageProps = {
  params: Promise<{ organizationId: string }>;
  searchParams: Promise<{
    vue?: string;
    annee?: string;
    mois?: string;
    jour?: string;
    n?: string;
  }>;
};

export default async function AuditPage({ params, searchParams }: PageProps) {
  const { organizationId } = await params;
  const query = await searchParams;
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, name: true },
  });
  if (!org) notFound();
  const now = new Date();
  const period = resolvePcaPeriod(query, now);
  const [events, boards] = await Promise.all([
    listAuditEventsAction({
      organizationId,
      from: period.from.toISOString(),
      to: period.to.toISOString(),
    }),
    getAuditBoardsAction(organizationId),
  ]);
  return (
    <AuditClient
      organizationId={organizationId}
      orgName={org.name}
      events={events}
      boards={boards}
      period={{
        view: period.view,
        year: period.year,
        month: period.month,
        day: period.day,
        span: period.span,
        reportKind: period.reportKind,
        periodLabel: period.periodLabel,
        rangeLabel: period.rangeLabel,
        from: toIsoDate(period.from),
        to: toIsoDate(period.to),
        todayYear: now.getFullYear(),
        todayMonth: now.getMonth() + 1,
        todayDay: now.getDate(),
      }}
    />
  );
}
