import { requireBranchContext } from "@/lib/branch/require-branch-context";
import { getOpenCashSession } from "@/lib/cash/actions";
import {
  listHeldSalesAction,
  listShopProductsAction,
} from "@/lib/boutique/actions";
import { BoutiquePosClient } from "./pos-client";

type PageProps = {
  params: Promise<{ organizationId: string; branchId: string }>;
};

export default async function BoutiquePosPage({ params }: PageProps) {
  const { organizationId, branchId } = await params;
  const branch = await requireBranchContext({
    organizationId,
    branchId,
    requireModule: "boutique",
  });
  const [products, heldSales, cashSession] = await Promise.all([
    listShopProductsAction(organizationId, branchId, { activeOnly: true }),
    listHeldSalesAction(organizationId, branchId),
    getOpenCashSession(branchId),
  ]);
  return (
    <BoutiquePosClient
      organizationId={organizationId}
      branchId={branchId}
      branchName={branch.name}
      products={products}
      heldSales={heldSales}
      cashSession={cashSession}
    />
  );
}
