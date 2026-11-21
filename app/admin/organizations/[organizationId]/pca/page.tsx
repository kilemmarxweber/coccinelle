import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import { getPcaDashboardAction } from "@/lib/org/pca-actions";
import { PcaClient } from "./pca-client";

type PageProps = { params: Promise<{ organizationId: string }> };

export default async function PcaPage({ params }: PageProps) {
  const { organizationId } = await params;
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, name: true },
  });
  if (!org) notFound();
  const data = await getPcaDashboardAction(organizationId);
  return (
    <PcaClient organizationId={organizationId} orgName={org.name} data={data} />
  );
}
