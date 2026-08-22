import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { requireBranchContext } from "@/lib/branch/require-branch-context";
import { DASH_CARD } from "@/lib/branch/ops-roles";
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
import {
  getLiveShiftSituationAction,
  getServiceStockGateAction,
} from "@/lib/hotel/service-stock";
import { usineRoutes } from "@/lib/branch/paths";
import { BoutiquePosClient } from "../../boutique/pos/pos-client";

type PageProps = {
  params: Promise<{ organizationId: string; branchId: string }>;
};

export default async function UsinePosPage({ params }: PageProps) {
  const { organizationId, branchId } = await params;
  const branch = await requireBranchContext({
    organizationId,
    branchId,
    requireModule: "usine",
    requireDashCard: DASH_CARD.POS,
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
    stockGate,
    liveSituation,
    rate,
  ] = await Promise.all([
    listShopProductsAction(organizationId, branchId, { activeOnly: true }),
    listHeldSalesAction(organizationId, branchId),
    getOpenCashSession(branchId, userId),
    getForeignOpenCashSessions(branchId, userId),
    getServiceStockGateAction(organizationId, branchId),
    getLiveShiftSituationAction(organizationId, branchId),
    getActiveExchangeRate(branchId),
  ]);

  const products = productsRaw
    .filter((p) => {
      if (p.productKind === "CONSUMABLE") return false;
      if (p.finishedFamily === "EAU" && !branch.hasEau) return false;
      if (p.finishedFamily === "VIN" && !branch.hasVin) return false;
      return true;
    })
    .map((p) => {
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
            Float marketeur non ouvert — les ventes cash sont bloquées.{" "}
            {stockCanOperate ? (
              <Link
                className="font-semibold underline underline-offset-2"
                href={`${usineRoutes.serviceStock(organizationId, branchId)}?ouvrir=1`}
              >
                Ouvrir le float
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
        pendingReceptions={[]}
        currentUserName={
          sessionAuth?.user?.name?.trim() ||
          sessionAuth?.user?.email ||
          "Marketeur"
        }
        stockReady={stockGate.ready}
        stockSession={stockGate.session}
        stockForeignSession={stockCanOperate ? stockGate.foreignSession : null}
        liveSituation={liveSituation}
        stockCanOperate={stockCanOperate}
        rate={rate}
        catalogMode="usine"
        hasEau={branch.hasEau}
        hasVin={branch.hasVin}
        creditNewHref={usineRoutes.creditNew(organizationId, branchId)}
        depotHref={usineRoutes.depot(organizationId, branchId)}
      />
    </>
  );
}
