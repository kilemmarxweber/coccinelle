import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import { CreateBranchForm } from "./components/create-branch-form";

type PageProps = { params: Promise<{ organizationId: string }> };

export default async function NewBranchPage({ params }: PageProps) {
  const { organizationId } = await params;
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, name: true },
  });
  if (!org) notFound();

  return <CreateBranchForm organizationId={org.id} organizationName={org.name} />;
}
