import { requireBranchContext } from "@/lib/branch/require-branch-context";
import { resolveCurrentBranchOpsRole } from "@/lib/branch/resolve-ops-role";
import { capabilitiesFromOpsRole } from "@/lib/payroll/service";
import { getPresencesPayload } from "@/lib/payroll/service";
import { redirect } from "next/navigation";
import { boutiqueRoutes } from "@/lib/branch/paths";
import { PresencesClient } from "./presences-client";

type PageProps = {
  params: Promise<{ organizationId: string; branchId: string }>;
  searchParams: Promise<{ jour?: string }>;
};

export default async function PaiePresencesPage({ params, searchParams }: PageProps) {
  const { organizationId, branchId } = await params;
  const { jour } = await searchParams;
  const branch = await requireBranchContext({
    organizationId,
    branchId,
    requireModule: "boutique",
  });
  const opsRole = await resolveCurrentBranchOpsRole(organizationId, branchId);
  const caps = capabilitiesFromOpsRole(opsRole);
  if (!caps.canPoint) {
    redirect(boutiqueRoutes.paieMoi(organizationId, branchId));
  }
  const data = await getPresencesPayload({ branchId, ymd: jour });
  return (
    <PresencesClient
      organizationId={organizationId}
      branchId={branchId}
      branchName={branch.name}
      timezone={data.timezone}
      ymd={data.ymd}
      isWorkday={data.isWorkday}
      periodStatus={data.period.status}
      agents={data.agents}
      caps={caps}
    />
  );
}
