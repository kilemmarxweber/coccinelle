import { requireBranchContext } from "@/lib/branch/require-branch-context";
import { DASH_CARD } from "@/lib/branch/ops-roles";
import {
  listFactoryBatchesAction,
  listFactoryProductsAction,
  listFactoryRecipesAction,
} from "@/lib/factory/actions";
import { UsineProductionClient } from "./production-client";

type PageProps = {
  params: Promise<{ organizationId: string; branchId: string }>;
};

export default async function UsineProductionPage({ params }: PageProps) {
  const { organizationId, branchId } = await params;
  await requireBranchContext({
    organizationId,
    branchId,
    requireModule: "usine",
    requireDashCard: DASH_CARD.USINE_PRODUCTION,
  });
  const [recipes, batches, products] = await Promise.all([
    listFactoryRecipesAction(organizationId, branchId),
    listFactoryBatchesAction(organizationId, branchId),
    listFactoryProductsAction(organizationId, branchId),
  ]);
  return (
    <UsineProductionClient
      organizationId={organizationId}
      branchId={branchId}
      recipes={recipes}
      batches={batches}
      products={products}
    />
  );
}
