import { requireBranchContext } from "@/lib/branch/require-branch-context";
import { DASH_CARD } from "@/lib/branch/ops-roles";
import { listRolesForParametresAction } from "@/lib/branch/privilege-actions";
import { ParametresShell } from "./parametres-section-nav";
import { ParametresRolesClient } from "./parametres-client";

type PageProps = {
  params: Promise<{ organizationId: string; branchId: string }>;
};

export default async function BranchParametresPage({ params }: PageProps) {
  const { organizationId, branchId } = await params;
  await requireBranchContext({
    organizationId,
    branchId,
    requireDashCard: DASH_CARD.PARAMETRES,
  });
  const roles = await listRolesForParametresAction(organizationId, branchId);

  return (
    <ParametresShell
      title="Rôles"
      subtitle="Métiers de la branche et leurs privilèges."
      organizationId={organizationId}
      branchId={branchId}
      active="roles"
      wide
    >
      <ParametresRolesClient
        organizationId={organizationId}
        branchId={branchId}
        initialRoles={roles}
      />
    </ParametresShell>
  );
}
