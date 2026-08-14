import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireBranchContext } from "@/lib/branch/require-branch-context";
import { auth } from "@/lib/auth";
import { getActiveExchangeRate, getOpenCashSession } from "@/lib/cash/actions";
import {
  listCatalogProductsAction,
  listProductCategoriesAction,
  listPurchaseOrdersAction,
} from "@/lib/purchases/actions";
import { BonsCommandeClient } from "./bons-commande-client";

type PageProps = {
  params: Promise<{ organizationId: string; branchId: string }>;
};

export default async function BonsCommandePage({ params }: PageProps) {
  const { organizationId, branchId } = await params;
  const branch = await requireBranchContext({ organizationId, branchId });
  const sessionAuth = await auth.api.getSession({ headers: await headers() });
  const userId = sessionAuth?.user?.id;
  if (!userId) redirect("/auth/sign-in");

  const [orders, catalog, categories, rate, cashSession] = await Promise.all([
    listPurchaseOrdersAction(organizationId, branchId),
    listCatalogProductsAction(organizationId, branchId),
    listProductCategoriesAction(organizationId, branchId),
    getActiveExchangeRate(branchId),
    getOpenCashSession(branchId, userId),
  ]);
  return (
    <BonsCommandeClient
      organizationId={organizationId}
      branchId={branchId}
      branchName={branch.name}
      branchType={branch.type}
      orders={orders}
      catalog={catalog}
      categories={categories}
      rate={rate}
      hasOpenCashSession={Boolean(cashSession)}
    />
  );
}
