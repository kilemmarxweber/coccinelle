import { requireBranchContext } from "@/lib/branch/require-branch-context";
import { resolveCurrentBranchOpsRole } from "@/lib/branch/resolve-ops-role";
import { capabilitiesFromOpsRole } from "@/lib/payroll/service";
import { redirect } from "next/navigation";
import { boutiqueRoutes } from "@/lib/branch/paths";
import { PayrollTransactionsClient } from "./transactions-client";

type PageProps = {
  params: Promise<{ organizationId: string; branchId: string }>;
};

export default async function PaieTransactionsPage({ params }: PageProps) {
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
  return (
    <PayrollTransactionsClient
      organizationId={organizationId}
      branchId={branchId}
      branchName={branch.name}
      caps={caps}
    />
  );
}
