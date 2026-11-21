import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import { listAuditEventsAction } from "@/lib/audit/actions";
import { AuditClient } from "./audit-client";

type PageProps = { params: Promise<{ organizationId: string }> };

export default async function AuditPage({ params }: PageProps) {
  const { organizationId } = await params;
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, name: true },
  });
  if (!org) notFound();
  const events = await listAuditEventsAction({ organizationId });
  return (
    <AuditClient
      organizationId={organizationId}
      orgName={org.name}
      events={events}
    />
  );
}
