import { requireBranchContext } from "@/lib/branch/require-branch-context";
import { DASH_CARD } from "@/lib/branch/ops-roles";
import { listFactoryOrderRequestsAction } from "@/lib/factory/actions";
import { UsineDemandesClient } from "./demandes-client";

type PageProps = {
  params: Promise<{ organizationId: string; branchId: string }>;
};

export default async function UsineDemandesPage({ params }: PageProps) {
  const { organizationId, branchId } = await params;
  await requireBranchContext({
    organizationId,
    branchId,
    requireModule: "usine",
    requireDashCard: DASH_CARD.USINE_CLIENTS,
  });
  const requests = await listFactoryOrderRequestsAction(
    organizationId,
    branchId,
    "ALL",
  );
  return (
    <UsineDemandesClient
      organizationId={organizationId}
      branchId={branchId}
      requests={requests}
    />
  );
}
