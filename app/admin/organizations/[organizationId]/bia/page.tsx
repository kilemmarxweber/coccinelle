import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import {
  getDatabaseHealthAction,
  getBiaBoardsAction,
  listBiaOverviewAction,
} from "@/lib/bia/actions";
import { BiaClient } from "./bia-client";

type PageProps = { params: Promise<{ organizationId: string }> };

export default async function BiaPage({ params }: PageProps) {
  const { organizationId } = await params;
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, name: true },
  });
  if (!org) notFound();
  const [health, overview, boards] = await Promise.all([
    getDatabaseHealthAction(organizationId),
    listBiaOverviewAction(organizationId),
    getBiaBoardsAction(organizationId),
  ]);
  return (
    <BiaClient
      organizationId={organizationId}
      orgName={org.name}
      health={health}
      overview={overview}
      boards={boards}
    />
  );
}
