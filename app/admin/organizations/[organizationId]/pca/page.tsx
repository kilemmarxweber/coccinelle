import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import { getPcaDashboardAction } from "@/lib/org/pca-actions";
import { PcaClient } from "./pca-client";

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

export default async function PcaPage({ params, searchParams }: PageProps) {
  const { organizationId } = await params;
  const query = await searchParams;
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, name: true },
  });
  if (!org) notFound();
  const data = await getPcaDashboardAction(organizationId, query);
  return (
    <PcaClient organizationId={organizationId} orgName={org.name} data={data} />
  );
}
