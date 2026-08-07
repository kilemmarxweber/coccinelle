import { requireBranchContext } from "@/lib/branch/require-branch-context";
import {
  getActiveExchangeRate,
  getOpenCashSession,
  getTodayPaymentsAction,
  listOpenFoliosAction,
  listReadyOrdersAction,
} from "@/lib/cash/actions";
import {
  ensureHotelMenuSeedAction,
  listMenuItemsAction,
} from "@/lib/hotel/actions";
import { CaisseClient } from "./caisse-client";

type PageProps = {
  params: Promise<{ organizationId: string; branchId: string }>;
};

export default async function BranchCaissePage({ params }: PageProps) {
  const { organizationId, branchId } = await params;
  const branch = await requireBranchContext({ organizationId, branchId });

  if (branch.type === "HOTEL") {
    await ensureHotelMenuSeedAction(organizationId, branchId);
  }

  const [cashSession, rate, folios, readyOrders, todayPayments, menuItems] =
    await Promise.all([
      getOpenCashSession(branchId),
      getActiveExchangeRate(branchId),
      listOpenFoliosAction(organizationId, branchId),
      listReadyOrdersAction(organizationId, branchId),
      getTodayPaymentsAction(organizationId, branchId),
      branch.type === "HOTEL"
        ? listMenuItemsAction(organizationId, branchId)
        : Promise.resolve([]),
    ]);

  return (
    <CaisseClient
      organizationId={organizationId}
      branchId={branchId}
      branchName={branch.name}
      cashSession={cashSession}
      rate={rate}
      folios={folios}
      readyOrders={readyOrders}
      todayPayments={todayPayments}
      menuItems={menuItems}
    />
  );
}
