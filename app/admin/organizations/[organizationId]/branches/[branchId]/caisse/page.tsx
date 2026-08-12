import { redirect } from "next/navigation";
import { Suspense } from "react";
import { requireBranchContext } from "@/lib/branch/require-branch-context";
import { isHospitality } from "@/lib/branch/hospitality";
import { boutiqueRoutes } from "@/lib/branch/paths";
import {
  getActiveExchangeRate,
  getOpenCashSession,
  getTodayPaymentsAction,
  listOpenFoliosAction,
  listReadyOrdersAction,
} from "@/lib/cash/actions";
import {
  ensureHotelMenuSeedAction,
  listActiveStaysForChargeAction,
  listMenuItemsAction,
} from "@/lib/hotel/actions";
import { CaisseClient } from "./caisse-client";

type PageProps = {
  params: Promise<{ organizationId: string; branchId: string }>;
};

export default async function BranchCaissePage({ params }: PageProps) {
  const { organizationId, branchId } = await params;
  const branch = await requireBranchContext({ organizationId, branchId });

  // Commerce : toute vente passe par le Point de vente.
  if (branch.type === "BOUTIQUE") {
    redirect(boutiqueRoutes.pos(organizationId, branchId));
  }

  const hospitality = isHospitality(branch.type);
  const hasStays = hospitality && branch.hasStays;
  const hasRestaurant = hospitality && branch.hasRestaurant;

  if (hasRestaurant) {
    await ensureHotelMenuSeedAction(organizationId, branchId);
  }

  const [cashSession, rate, folios, readyOrders, todayPayments, menuItems, activeStays] =
    await Promise.all([
      getOpenCashSession(branchId),
      getActiveExchangeRate(branchId),
      hasStays
        ? listOpenFoliosAction(organizationId, branchId)
        : Promise.resolve([]),
      hasRestaurant
        ? listReadyOrdersAction(organizationId, branchId)
        : Promise.resolve([]),
      getTodayPaymentsAction(organizationId, branchId),
      hasRestaurant
        ? listMenuItemsAction(organizationId, branchId)
        : Promise.resolve([]),
      hasStays && hasRestaurant
        ? listActiveStaysForChargeAction(organizationId, branchId)
        : Promise.resolve([]),
    ]);

  return (
    <Suspense fallback={null}>
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
        activeStays={activeStays}
        hasStays={hasStays}
        hasRestaurant={hasRestaurant}
      />
    </Suspense>
  );
}
