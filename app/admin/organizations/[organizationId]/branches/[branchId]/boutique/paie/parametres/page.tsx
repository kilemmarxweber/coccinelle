import { requireBranchContext } from "@/lib/branch/require-branch-context";
import { resolveCurrentBranchOpsRole } from "@/lib/branch/resolve-ops-role";
import { capabilitiesFromOpsRole, loadSettings } from "@/lib/payroll/service";
import { redirect } from "next/navigation";
import { boutiqueRoutes } from "@/lib/branch/paths";
import { PaieSettingsClient } from "./parametres-client";

type PageProps = {
  params: Promise<{ organizationId: string; branchId: string }>;
};

export default async function PaieParametresPage({ params }: PageProps) {
  const { organizationId, branchId } = await params;
  const branch = await requireBranchContext({
    organizationId,
    branchId,
    requireModule: "boutique",
  });
  const opsRole = await resolveCurrentBranchOpsRole(organizationId, branchId);
  const caps = capabilitiesFromOpsRole(opsRole);
  if (!caps.canManage) {
    redirect(boutiqueRoutes.paieMoi(organizationId, branchId));
  }
  const settings = await loadSettings(branchId);
  return (
    <PaieSettingsClient
      organizationId={organizationId}
      branchId={branchId}
      branchName={branch.name}
      settings={settings}
      caps={caps}
    />
  );
}
