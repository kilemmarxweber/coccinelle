import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { requireBranchContext } from "@/lib/branch/require-branch-context";
import { auth } from "@/lib/auth";
import { hasOrganizationPermission } from "@/lib/auth/organization-permission";
import {
  getActiveExchangeRate,
  getForeignOpenCashSessions,
  getOpenCashSession,
} from "@/lib/cash/actions";
import {
  listHeldSalesAction,
  listShopProductsAction,
} from "@/lib/boutique/actions";
import { listPendingPosReceptionsAction } from "@/lib/warehouse/actions";
import {
  getLiveShiftSituationAction,
  getServiceStockGateAction,
} from "@/lib/hotel/service-stock";
import { boutiqueRoutes } from "@/lib/branch/paths";
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

  const stockCanOperate = await hasOrganizationPermission(organizationId, {
    service_stock: ["ouvrir"],
  });

  const [
    productsRaw,
    heldSales,
    cashSession,
    foreignCashSessions,
    pendingReceptions,
    stockGate,
    liveSituation,
    rate,
  ] = await Promise.all([
    listShopProductsAction(organizationId, branchId, { activeOnly: true }),
    listHeldSalesAction(organizationId, branchId),
    getOpenCashSession(branchId, userId),
    getForeignOpenCashSessions(branchId, userId),
    listPendingPosReceptionsAction(organizationId, branchId),
    getServiceStockGateAction(organizationId, branchId),
    getLiveShiftSituationAction(organizationId, branchId),
    getActiveExchangeRate(branchId),
  ]);

  const products = productsRaw.map((p) => {
    if (!stockGate.ready) {
      return { ...p, stockQty: 0, availableQty: 0 };
    }
    const floatQty = stockGate.floatByItemId[p.id] ?? 0;
    return {
      ...p,
      stockQty: floatQty,
      availableQty: Math.max(0, floatQty - p.heldQty),
    };
  });

  return (
    <>
      {!stockGate.ready ? (
        <div className="mx-auto max-w-6xl px-4 pt-4">
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm">
            {stockGate.foreignSession && stockCanOperate ? (
              <>
                Service stock encore ouvert par{" "}
                <strong>{stockGate.foreignSession.vendorDisplayName}</strong> (
                {stockGate.foreignSession.number}) — clôturez-le, puis ouvrez le
                vôtre.{" "}
              </>
            ) : (
              <>
                Service stock non ouvert — les ventes POS sont bloquées tant que
                le float n’est pas attribué depuis le stock auxiliaire.{" "}
              </>
            )}
            {stockCanOperate ? (
              <Link
                className="font-semibold underline underline-offset-2"
                href={`${boutiqueRoutes.serviceStock(organizationId, branchId)}?ouvrir=1`}
              >
                Ouvrir le service stock
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}
      <BoutiquePosClient
        organizationId={organizationId}
        branchId={branchId}
        branchName={branch.name}
        products={products}
        heldSales={heldSales}
        cashSession={cashSession}
        foreignCashSessions={foreignCashSessions}
        pendingReceptions={pendingReceptions}
        currentUserName={
          sessionAuth?.user?.name?.trim() ||
          sessionAuth?.user?.email ||
          "Caissier"
        }
        stockReady={stockGate.ready}
        stockSession={stockGate.session}
        stockForeignSession={stockCanOperate ? stockGate.foreignSession : null}
        liveSituation={liveSituation}
        stockCanOperate={stockCanOperate}
        rate={rate}
      />
    </>
  );
}
