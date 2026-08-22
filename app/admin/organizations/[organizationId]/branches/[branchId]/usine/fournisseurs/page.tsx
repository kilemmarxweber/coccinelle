import { requireBranchContext } from "@/lib/branch/require-branch-context";
import { DASH_CARD } from "@/lib/branch/ops-roles";
import { listFactorySuppliersAction } from "@/lib/factory/actions";
import { UsineFournisseursClient } from "./fournisseurs-client";

type PageProps = {
  params: Promise<{ organizationId: string; branchId: string }>;
};

export default async function UsineFournisseursPage({ params }: PageProps) {
  const { organizationId, branchId } = await params;
  await requireBranchContext({
    organizationId,
    branchId,
    requireModule: "usine",
    requireDashCard: DASH_CARD.USINE_FOURNISSEURS,
  });
  const suppliers = await listFactorySuppliersAction(organizationId, branchId);
  return (
    <UsineFournisseursClient
      organizationId={organizationId}
      branchId={branchId}
      suppliers={suppliers}
    />
  );
}
