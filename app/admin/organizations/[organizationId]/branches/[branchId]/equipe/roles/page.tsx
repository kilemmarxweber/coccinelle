import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import { RolesClient } from "@/app/admin/organizations/[organizationId]/roles/roles-client";
import { listOrgRolesAction } from "@/app/admin/organizations/[organizationId]/roles/actions";

type PageProps = {
  params: Promise<{ organizationId: string; branchId: string }>;
};

/**
 * R05 — CRUD rôles org depuis le hub branche.
 * Même OrganizationRole + APIs R03 ; pas de rôle privé à la branche.
 */
export default async function BranchEquipeRolesPage({ params }: PageProps) {
  const { organizationId, branchId } = await params;

  const branch = await prisma.branch.findFirst({
    where: { id: branchId, organizationId },
    select: { id: true, name: true },
  });
  if (!branch) notFound();

  const result = await listOrgRolesAction(organizationId);

  return (
    <RolesClient
      organizationId={organizationId}
      initialRoles={result.ok ? result.roles : []}
      initialCapabilities={result.capabilities}
      branchContext={{
        branchId: branch.id,
        branchName: branch.name,
      }}
    />
  );
}
