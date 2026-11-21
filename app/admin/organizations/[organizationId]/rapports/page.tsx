import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import { listOrgReportBranchesAction } from "@/lib/org/reports-actions";
import { isCafeYayoOrg } from "@/lib/org/yayo";
import { OrgRapportsClient } from "./org-rapports-client";

type PageProps = { params: Promise<{ organizationId: string }> };

export default async function OrgRapportsPage({ params }: PageProps) {
  const { organizationId } = await params;
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, name: true, slug: true, metadata: true },
  });
  if (!org) notFound();

  const branches = await listOrgReportBranchesAction(organizationId);

  return (
    <OrgRapportsClient
      organizationId={organizationId}
      orgName={org.name}
      branches={branches}
      hideOccupancy={isCafeYayoOrg(org)}
    />
  );
}
