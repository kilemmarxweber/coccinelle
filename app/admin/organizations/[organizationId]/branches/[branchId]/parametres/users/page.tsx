import { requireBranchContext } from "@/lib/branch/require-branch-context";
import { DASH_CARD } from "@/lib/branch/ops-roles";
import { listAssignableOpsRolesAction } from "@/lib/branch/privilege-actions";
import { isCommerceBranchType } from "@/lib/payroll/bootstrap";
import prisma from "@/lib/prisma";
import {
  listAssignableOrgRolesAction,
  listBranchStaffAction,
} from "../../equipe/actions";
import { EquipeClient } from "../../equipe/equipe-client";
import { ParametresShell } from "../parametres-section-nav";

type PageProps = {
  params: Promise<{ organizationId: string; branchId: string }>;
};

export default async function BranchParametresUsersPage({ params }: PageProps) {
  const { organizationId, branchId } = await params;
  const branch = await requireBranchContext({
    organizationId,
    branchId,
    requireDashCard: DASH_CARD.EQUIPE,
  });

  const [staffRes, rolesRes, opsRoles, org] = await Promise.all([
    listBranchStaffAction(organizationId, branchId),
    listAssignableOrgRolesAction(organizationId),
    listAssignableOpsRolesAction(),
    prisma.organization.findUnique({
      where: { id: organizationId },
      select: { slug: true },
    }),
  ]);

  return (
    <ParametresShell
      title="Utilisateurs"
      subtitle={`Comptes de ${branch.name}. Admin ou User — jamais owner.`}
      organizationId={organizationId}
      branchId={branchId}
      active="users"
      wide
    >
      <EquipeClient
        organizationId={organizationId}
        organizationSlug={org?.slug ?? "org"}
        branchId={branchId}
        branchName={branch.name}
        initialStaff={staffRes.ok ? staffRes.staff : []}
        initialCapabilities={staffRes.capabilities}
        initialRoles={rolesRes.ok ? rolesRes.roles : []}
        initialOpsRoles={opsRoles.map((r) => ({
          slug: r.slug,
          label: r.label,
        }))}
        isCommerce={isCommerceBranchType(branch.type)}
        hideSectionNav
        embedded
      />
    </ParametresShell>
  );
}
