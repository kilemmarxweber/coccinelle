import { Suspense } from "react";
import Link from "next/link";
import { headers } from "next/headers";
import { requireBranchContext } from "@/lib/branch/require-branch-context";
import { canAccessStays } from "@/lib/branch/hospitality";
import { hotelRoutes } from "@/lib/branch/paths";
import { DASH_CARD } from "@/lib/branch/ops-roles";
import { auth } from "@/lib/auth";
import { getActiveExchangeRate } from "@/lib/cash/actions";
import {
  ensureHotelMenuSeedAction,
  listActiveStaysForChargeAction,
  listMenuItemsAction,
  listOrdersByStatusAction,
} from "@/lib/hotel/actions";
import {
  getServiceStockGateAction,
  listServiceStockSessionsAction,
} from "@/lib/hotel/service-stock";
import { RestaurationClient } from "./restauration-client";

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
  const [menuItemsRaw, orders, rate, activeStays, stockGate, stockHistory] =
    await Promise.all([
      listMenuItemsAction(organizationId, branchId),
      listOrdersByStatusAction(organizationId, branchId, [
        "ENVOYEE",
        "EN_PREPARATION",
        "PRETE",
        "EN_CAISSE",
        "PAYEE",
        "LIVREE",
      ]),
      getActiveExchangeRate(branchId),
      hasStays
        ? listActiveStaysForChargeAction(organizationId, branchId)
        : Promise.resolve([]),
      getServiceStockGateAction(organizationId, branchId),
      listServiceStockSessionsAction(organizationId, branchId),
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
            Service stock non ouvert — les produits hors cuisine sont bloqués.{" "}
            <Link
              className="font-semibold underline underline-offset-2"
              href={hotelRoutes.serviceStock(organizationId, branchId)}
            >
              Ouvrir le service stock
            </Link>
          </div>
        </div>
      ) : (
        <div className="mx-auto max-w-6xl px-4 pt-4">
          <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 px-4 py-2 text-xs text-muted-foreground">
            Float service {stockGate.session?.number} · entrant{" "}
            {stockGate.session?.vendorDisplayName}
          </div>
        </div>
      )}
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
        stockHistory={stockHistory}
      />
    </Suspense>
  );
}
