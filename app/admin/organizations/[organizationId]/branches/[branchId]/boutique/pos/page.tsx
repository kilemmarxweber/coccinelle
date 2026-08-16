import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireBranchContext } from "@/lib/branch/require-branch-context";
import { auth } from "@/lib/auth";
import {
  getForeignOpenCashSessions,
  getOpenCashSession,
} from "@/lib/cash/actions";
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
    requireDashCard: "pos",
  });
  const sessionAuth = await auth.api.getSession({ headers: await headers() });
  const userId = sessionAuth?.user?.id;
  if (!userId) redirect("/auth/sign-in");

  const [products, heldSales, cashSession, foreignCashSessions] =
    await Promise.all([
      listShopProductsAction(organizationId, branchId, { activeOnly: true }),
      listHeldSalesAction(organizationId, branchId),
      getOpenCashSession(branchId, userId),
      getForeignOpenCashSessions(branchId, userId),
    ]);
  return (
    <BoutiquePosClient
      organizationId={organizationId}
      branchId={branchId}
      branchName={branch.name}
      products={products}
      heldSales={heldSales}
      cashSession={cashSession}
      foreignCashSessions={foreignCashSessions}
    />
  );
}
