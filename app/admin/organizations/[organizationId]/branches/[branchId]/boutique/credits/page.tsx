import { requireBranchContext } from "@/lib/branch/require-branch-context";
import { listDeptCustomersAction } from "@/lib/dept-credit/actions";
import { CreditsClient } from "./credits-client";

type PageProps = {
  params: Promise<{ organizationId: string; branchId: string }>;
};

export default async function BoutiqueCreditsPage({ params }: PageProps) {
  const { organizationId, branchId } = await params;
  await requireBranchContext({ organizationId, branchId, requireModule: "boutique" });
  const customers = await listDeptCustomersAction(organizationId, branchId);
  return (
    <CreditsClient
      organizationId={organizationId}
      branchId={branchId}
      customers={customers.map((c) => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        creditLimitUsd: c.creditLimitUsd,
        openUsd: c.credits.reduce((s, x) => s + x.totalUsd - x.paidUsd, 0),
      }))}
    />
  );
}
