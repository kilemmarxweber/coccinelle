import { requireBranchContext } from "@/lib/branch/require-branch-context";
import {
  listShopProductsAction,
  listShopStockMovementsAction,
} from "@/lib/boutique/actions";
import { BoutiqueStockClient } from "./stock-client";

type PageProps = {
  params: Promise<{ organizationId: string; branchId: string }>;
};

export default async function BoutiqueStockPage({ params }: PageProps) {
  const { organizationId, branchId } = await params;
  const branch = await requireBranchContext({
    organizationId,
    branchId,
    requireModule: "boutique",
    requireDashCard: "boutique_stock",
  });
  const [products, movements] = await Promise.all([
    listShopProductsAction(organizationId, branchId),
    listShopStockMovementsAction(organizationId, branchId),
  ]);
  return (
    <BoutiqueStockClient
      organizationId={organizationId}
      branchId={branchId}
      branchName={branch.name}
      products={products}
      movements={movements}
    />
  );
}
