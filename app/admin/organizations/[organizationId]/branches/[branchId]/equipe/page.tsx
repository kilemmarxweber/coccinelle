import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import {
  listAssignableOrgRolesAction,
  listBranchStaffAction,
} from "./actions";
import { EquipeClient } from "./equipe-client";

type PageProps = {
  params: Promise<{ organizationId: string; branchId: string }>;
};

export default async function BranchEquipePage({ params }: PageProps) {
  const { organizationId, branchId } = await params;

  const branch = await prisma.branch.findFirst({
    where: { id: branchId, organizationId },
    select: { id: true, name: true, type: true },
  });
  if (!branch) notFound();

  const [staffRes, rolesRes] = await Promise.all([
    listBranchStaffAction(organizationId, branchId),
    listAssignableOrgRolesAction(organizationId),
  ]);

  return (
    <EquipeClient
      organizationId={organizationId}
      branchId={branchId}
      branchName={branch.name}
      initialStaff={staffRes.ok ? staffRes.staff : []}
      initialCapabilities={staffRes.capabilities}
      initialRoles={rolesRes.ok ? rolesRes.roles : []}
      isCommerce={branch.type === "BOUTIQUE"}
    />
  );
}
