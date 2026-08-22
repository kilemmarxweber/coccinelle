import { requireBranchContext } from "@/lib/branch/require-branch-context";
import { DASH_CARD } from "@/lib/branch/ops-roles";
import {
  listShopCategoriesAction,
  listShopProductsAction,
} from "@/lib/boutique/actions";
import { BoutiqueProduitsClient } from "../../boutique/produits/produits-client";

type PageProps = {
  params: Promise<{ organizationId: string; branchId: string }>;
};

export default async function UsineProduitsPage({ params }: PageProps) {
  const { organizationId, branchId } = await params;
  const branch = await requireBranchContext({
    organizationId,
    branchId,
    requireModule: "usine",
    requireDashCard: DASH_CARD.BOUTIQUE_PRODUITS,
  });
  const [products, categories] = await Promise.all([
    listShopProductsAction(organizationId, branchId),
    listShopCategoriesAction(organizationId, branchId),
  ]);
  return (
    <BoutiqueProduitsClient
      organizationId={organizationId}
      branchId={branchId}
      branchName={branch.name}
      products={products}
      categories={categories}
    />
  );
}
