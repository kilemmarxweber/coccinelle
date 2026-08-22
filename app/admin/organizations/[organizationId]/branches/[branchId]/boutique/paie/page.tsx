import { requireBranchContext } from "@/lib/branch/require-branch-context";
import { resolveCurrentBranchOpsRole } from "@/lib/branch/resolve-ops-role";
import { capabilitiesFromOpsRole, getMonthPayload } from "@/lib/payroll/service";
import { redirect } from "next/navigation";
import { boutiqueRoutes } from "@/lib/branch/paths";
import { PaieMoisClient } from "./paie-client";

type PageProps = {
  params: Promise<{ organizationId: string; branchId: string }>;
};

export default async function PaieMoisPage({ params }: PageProps) {
  const { organizationId, branchId } = await params;
  const branch = await requireBranchContext({
    organizationId,
    branchId,
    requireCommerce: true,
  });
  const opsRole = await resolveCurrentBranchOpsRole(organizationId, branchId);
  const caps = capabilitiesFromOpsRole(opsRole);
  if (!caps.canManage) {
    redirect(boutiqueRoutes.paieMoi(organizationId, branchId));
  }
  const data = await getMonthPayload({ branchId });
  return (
    <PaieMoisClient
      organizationId={organizationId}
      branchId={branchId}
      branchName={branch.name}
      data={data}
      caps={caps}
    />
  );
}
