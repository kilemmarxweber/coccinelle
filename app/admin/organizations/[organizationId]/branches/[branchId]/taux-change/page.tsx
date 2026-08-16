import { requireBranchContext } from "@/lib/branch/require-branch-context";
import { DASH_CARD } from "@/lib/branch/ops-roles";
import { listExchangeRatesAction } from "@/lib/cash/actions";
import { TauxChangeClient } from "./taux-change-client";

type PageProps = {
  params: Promise<{ organizationId: string; branchId: string }>;
};

export default async function TauxChangePage({ params }: PageProps) {
  const { organizationId, branchId } = await params;
  await requireBranchContext({
    organizationId,
    branchId,
    requireDashCard: DASH_CARD.TAUX_CHANGE,
  });
  const rates = await listExchangeRatesAction(organizationId, branchId);
  return (
    <TauxChangeClient
      organizationId={organizationId}
      branchId={branchId}
      rates={rates}
    />
  );
}
