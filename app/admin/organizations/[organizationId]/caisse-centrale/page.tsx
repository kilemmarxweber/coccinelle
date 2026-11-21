import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import { getCentralCashDashboardAction } from "@/lib/central-cash/actions";
import { CaisseCentraleClient } from "./caisse-centrale-client";

type PageProps = { params: Promise<{ organizationId: string }> };

export default async function CaisseCentralePage({ params }: PageProps) {
  const { organizationId } = await params;
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, name: true },
  });
  if (!org) notFound();
  const data = await getCentralCashDashboardAction(organizationId);
  return (
    <CaisseCentraleClient
        organizationId={organizationId}
        orgName={org.name}
        data={data}
      />
  );
}
