import { redirect } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";
import { headers } from "next/headers";
import { requireBranchContext } from "@/lib/branch/require-branch-context";
import { isHospitality } from "@/lib/branch/hospitality";
import { boutiqueRoutes, hotelRoutes } from "@/lib/branch/paths";
import { auth } from "@/lib/auth";
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
import {
  getServiceStockGateAction,
  listServiceStockSessionsAction,
} from "@/lib/hotel/service-stock";
import { CaisseClient } from "./caisse-client";

type PageProps = {
  params: Promise<{ organizationId: string; branchId: string }>;
};

export default async function BranchCaissePage({ params }: PageProps) {
  const { organizationId, branchId } = await params;
  const branch = await requireBranchContext({ organizationId, branchId });
  // Hospitalité : filtre métier caissier / owner / …
  if (isHospitality(branch.type)) {
    const { canSeeDashCard, DASH_CARD } = await import("@/lib/branch/ops-roles");
    const { resolveCurrentBranchOpsRole } = await import(
      "@/lib/branch/resolve-ops-role"
    );
    const ops = await resolveCurrentBranchOpsRole(organizationId, branchId);
    if (!canSeeDashCard(ops, DASH_CARD.CAISSE)) {
      redirect(`/admin/organizations/${organizationId}/branches/${branchId}`);
    }
  }

  if (branch.type === "BOUTIQUE") {
    redirect(boutiqueRoutes.pos(organizationId, branchId));
  }

  const hospitality = isHospitality(branch.type);
  const hasStays = hospitality && branch.hasStays;
  const hasRestaurant = hospitality && branch.hasRestaurant;

  if (hasRestaurant) {
    await ensureHotelMenuSeedAction(organizationId, branchId);
  }

  const sessionAuth = await auth.api.getSession({ headers: await headers() });

  const [
    cashSession,
    rate,
    folios,
    readyOrders,
    todayPayments,
    menuItemsRaw,
    activeStays,
    stockGate,
    stockHistory,
  ] = await Promise.all([
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
    hasRestaurant
      ? getServiceStockGateAction(organizationId, branchId)
      : Promise.resolve({
          ready: true as const,
          session: null,
          floatByItemId: {} as Record<string, number>,
        }),
    hasRestaurant
      ? listServiceStockSessionsAction(organizationId, branchId)
      : Promise.resolve([]),
  ]);

  const menuItems = menuItemsRaw.map((item) => {
    if (item.needsKitchen) return item;
    if (!stockGate.ready) return { ...item, stockQty: 0 };
    return {
      ...item,
      stockQty: stockGate.floatByItemId[item.id] ?? 0,
    };
  });

  return (
    <Suspense fallback={null}>
      {hasRestaurant && !stockGate.ready ? (
        <div className="mx-auto max-w-6xl px-4 pt-4">
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm">
            Service stock non ouvert — vente rapide hors cuisine bloquée.{" "}
            <Link
              className="font-semibold underline underline-offset-2"
              href={hotelRoutes.serviceStock(organizationId, branchId)}
            >
              Ouvrir le service stock
            </Link>
          </div>
        </div>
      ) : null}
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
        currentUserName={
          sessionAuth?.user?.name?.trim() ||
          sessionAuth?.user?.email ||
          "Manager"
        }
        stockReady={hasRestaurant ? stockGate.ready : false}
        stockSession={stockGate.session}
        stockHistory={stockHistory}
      />
    </Suspense>
  );
}
