import { requireBranchContext } from "@/lib/branch/require-branch-context";
import { DASH_CARD } from "@/lib/branch/ops-roles";
import { listFactoryCustomersAction } from "@/lib/factory/actions";
import { UsineClientsClient } from "./clients-client";

type PageProps = {
  params: Promise<{ organizationId: string; branchId: string }>;
};

export default async function UsineClientsPage({ params }: PageProps) {
  const { organizationId, branchId } = await params;
  await requireBranchContext({
    organizationId,
    branchId,
    requireModule: "usine",
    requireDashCard: DASH_CARD.USINE_CLIENTS,
  });
  const customers = await listFactoryCustomersAction(organizationId, branchId);
  return (
    <UsineClientsClient
      organizationId={organizationId}
      branchId={branchId}
      customers={customers}
    />
  );
}
