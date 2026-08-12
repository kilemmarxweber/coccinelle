import { requireBranchContext } from "@/lib/branch/require-branch-context";
import {
  listShopCategoriesAction,
  listShopProductsAction,
} from "@/lib/boutique/actions";
import { BoutiqueProduitsClient } from "./produits-client";

type PageProps = {
  params: Promise<{ organizationId: string; branchId: string }>;
};

export default async function BoutiqueProduitsPage({ params }: PageProps) {
  const { organizationId, branchId } = await params;
  const branch = await requireBranchContext({
    organizationId,
    branchId,
    requireModule: "boutique",
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
