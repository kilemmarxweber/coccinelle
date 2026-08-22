import { headers } from "next/headers";
import { requireBranchContext } from "@/lib/branch/require-branch-context";
import { resolveCurrentBranchOpsRole } from "@/lib/branch/resolve-ops-role";
import { capabilitiesFromOpsRole, getSelfPayload } from "@/lib/payroll/service";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { MoiClient } from "./moi-client";

type PageProps = {
  params: Promise<{ organizationId: string; branchId: string }>;
};

export default async function PaieMoiPage({ params }: PageProps) {
  const { organizationId, branchId } = await params;
  const branch = await requireBranchContext({
    organizationId,
    branchId,
    requireCommerce: true,
  });
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/auth/sign-in");
  const opsRole = await resolveCurrentBranchOpsRole(organizationId, branchId);
  const caps = capabilitiesFromOpsRole(opsRole);
  const data = await getSelfPayload({ branchId, userId: session.user.id });
  return (
    <MoiClient
      organizationId={organizationId}
      branchId={branchId}
      branchName={branch.name}
      data={data}
      caps={caps}
    />
  );
}
