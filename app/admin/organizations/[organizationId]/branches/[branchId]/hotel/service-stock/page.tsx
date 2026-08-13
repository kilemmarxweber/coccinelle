import { headers } from "next/headers";
import { requireBranchContext } from "@/lib/branch/require-branch-context";
import { DASH_CARD } from "@/lib/branch/ops-roles";
import { auth } from "@/lib/auth";
import { getActiveExchangeRate } from "@/lib/cash/actions";
import {
  getOpenServiceStockSessionAction,
  getPendingHandoverFloatAction,
  listBranchStaffForServiceStockAction,
  listDepotSellableItemsAction,
  listServiceStockSessionsAction,
} from "@/lib/hotel/service-stock";
import { ServiceStockClient } from "./service-stock-client";

type PageProps = {
  params: Promise<{ organizationId: string; branchId: string }>;
};

export default async function ServiceStockPage({ params }: PageProps) {
  const { organizationId, branchId } = await params;
  const branch = await requireBranchContext({
    organizationId,
    branchId,
    requireModule: "hotel",
    requireHospitality: "restaurant",
    requireDashCard: DASH_CARD.SERVICE_STOCK,
  });
  const sessionAuth = await auth.api.getSession({ headers: await headers() });
  const [session, staff, depotItems, history, rate, pendingHandover] =
    await Promise.all([
      getOpenServiceStockSessionAction(organizationId, branchId),
      listBranchStaffForServiceStockAction(organizationId, branchId),
      listDepotSellableItemsAction(organizationId, branchId),
      listServiceStockSessionsAction(organizationId, branchId),
      getActiveExchangeRate(branchId),
      getPendingHandoverFloatAction(organizationId, branchId),
    ]);

  return (
    <ServiceStockClient
      organizationId={organizationId}
      branchId={branchId}
      branchName={branch.name}
      session={session}
      staff={staff}
      depotItems={depotItems}
      history={history}
      pendingHandover={pendingHandover}
      rate={rate}
      currentUserName={
        sessionAuth?.user?.name?.trim() ||
        sessionAuth?.user?.email ||
        "Manager"
      }
    />
  );
}
