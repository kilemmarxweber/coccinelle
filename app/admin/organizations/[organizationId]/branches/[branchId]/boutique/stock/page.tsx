import { requireBranchContext } from "@/lib/branch/require-branch-context";
import {
  listShopProductsAction,
  listShopStockMovementsAction,
} from "@/lib/boutique/actions";
import { getWarehouseDashboardAction } from "@/lib/warehouse/actions";
import { BoutiqueStockClient } from "./stock-client";

type PageProps = {
  params: Promise<{ organizationId: string; branchId: string }>;
  searchParams: Promise<{ tab?: string }>;
};

const STOCK_TABS = ["vue", "principal", "auxiliaire", "bons", "mouvements"] as const;

export default async function BoutiqueStockPage({
  params,
  searchParams,
}: PageProps) {
  const { organizationId, branchId } = await params;
  const { tab } = await searchParams;
  const branch = await requireBranchContext({
    organizationId,
    branchId,
    requireModule: "boutique",
    requireDashCard: "boutique_stock",
  });
  const [warehouse, products, movements] = await Promise.all([
    getWarehouseDashboardAction(organizationId, branchId),
    listShopProductsAction(organizationId, branchId),
    listShopStockMovementsAction(organizationId, branchId),
  ]);
  const initialTab =
    tab && (STOCK_TABS as readonly string[]).includes(tab)
      ? (tab as (typeof STOCK_TABS)[number])
      : "vue";
  return (
    <BoutiqueStockClient
      organizationId={organizationId}
      branchId={branchId}
      branchName={branch.name}
      warehouse={warehouse}
      shopProducts={products}
      shopMovements={movements}
      initialTab={initialTab}
    />
  );
}
