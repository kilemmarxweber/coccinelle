import { Suspense } from "react";
import Link from "next/link";
import { headers } from "next/headers";
import { requireBranchContext } from "@/lib/branch/require-branch-context";
import { canAccessStays } from "@/lib/branch/hospitality";
import { hotelRoutes } from "@/lib/branch/paths";
import { DASH_CARD, canOperateServiceStock } from "@/lib/branch/ops-roles";
import { resolveCurrentBranchOpsRole } from "@/lib/branch/resolve-ops-role";
import { auth } from "@/lib/auth";
import { getActiveExchangeRate } from "@/lib/cash/actions";
import {
  ensureHotelMenuSeedAction,
  listActiveStaysForChargeAction,
  listMenuItemsAction,
  listRestaurationSuiviAction,
} from "@/lib/hotel/actions";
import {
  getLiveShiftSituationAction,
  getServiceStockGateAction,
} from "@/lib/hotel/service-stock";
import { RestaurationClient } from "./restauration-client";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ organizationId: string; branchId: string }>;
  searchParams: Promise<{ view?: string }>;
};

export default async function RestaurationPage({
  params,
  searchParams,
}: PageProps) {
  const { organizationId, branchId } = await params;
  const { view } = await searchParams;
  const branch = await requireBranchContext({
    organizationId,
    branchId,
    requireModule: "hotel",
    requireHospitality: "restaurant",
    requireDashCard: DASH_CARD.RESTAURATION,
  });
  await ensureHotelMenuSeedAction(organizationId, branchId);
  const hasStays = canAccessStays(branch);
  const sessionAuth = await auth.api.getSession({ headers: await headers() });
  const opsRole = await resolveCurrentBranchOpsRole(organizationId, branchId);
  const stockCanOperate = canOperateServiceStock(opsRole);
  const [menuItemsRaw, orders, rate, activeStays, stockGate, liveSituation] =
    await Promise.all([
      listMenuItemsAction(organizationId, branchId),
      listRestaurationSuiviAction(organizationId, branchId),
      getActiveExchangeRate(branchId),
      hasStays
        ? listActiveStaysForChargeAction(organizationId, branchId)
        : Promise.resolve([]),
      getServiceStockGateAction(organizationId, branchId),
      getLiveShiftSituationAction(organizationId, branchId),
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
      {!stockGate.ready ? (
        <div className="mx-auto max-w-6xl px-4 pt-4">
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm">
            {stockGate.foreignSession && stockCanOperate ? (
              <>
                Service stock encore ouvert par{" "}
                <strong>{stockGate.foreignSession.vendorDisplayName}</strong> (
                {stockGate.foreignSession.number}) — clôturez-le ci-dessous puis
                ouvrez le vôtre.{" "}
              </>
            ) : (
              <>
                Service stock non ouvert par le caissier — les produits hors
                cuisine sont bloqués.{" "}
              </>
            )}
            {stockCanOperate ? (
              <Link
                className="font-semibold underline underline-offset-2"
                href={hotelRoutes.serviceStock(organizationId, branchId)}
              >
                Service stock
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}
      <RestaurationClient
        organizationId={organizationId}
        branchId={branchId}
        branchName={branch.name}
        menuItems={menuItems}
        orders={orders}
        activeStays={activeStays}
        hasStays={hasStays}
        rate={rate}
        initialView={view === "suivi" ? "suivi" : undefined}
        currentUserName={
          sessionAuth?.user?.name?.trim() ||
          sessionAuth?.user?.email ||
          "Manager"
        }
        stockReady={stockGate.ready}
        stockSession={stockGate.session}
        stockForeignSession={stockCanOperate ? stockGate.foreignSession : null}
        liveSituation={liveSituation}
        stockCanOperate={stockCanOperate}
      />
    </Suspense>
  );
}
