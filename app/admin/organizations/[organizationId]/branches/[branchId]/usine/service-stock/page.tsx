import { headers } from "next/headers";
import { requireBranchContext } from "@/lib/branch/require-branch-context";
import { DASH_CARD } from "@/lib/branch/ops-roles";
import { auth } from "@/lib/auth";
import { getActiveExchangeRate } from "@/lib/cash/actions";
import { usineRoutes } from "@/lib/branch/paths";
import {
  getLiveShiftSituationAction,
  getOpenServiceStockSessionAction,
  getPendingHandoverFloatAction,
  listBranchStaffForServiceStockAction,
  listDepotSellableItemsAction,
  listServiceStockSessionsAction,
} from "@/lib/hotel/service-stock";
import { ServiceStockClient } from "../../hotel/service-stock/service-stock-client";

type PageProps = {
  params: Promise<{ organizationId: string; branchId: string }>;
  searchParams: Promise<{ ouvrir?: string }>;
};

export default async function UsineServiceStockPage({
  params,
  searchParams,
}: PageProps) {
  const { organizationId, branchId } = await params;
  const { ouvrir } = await searchParams;
  const branch = await requireBranchContext({
    organizationId,
    branchId,
    requireModule: "usine",
    requireDashCard: DASH_CARD.SERVICE_STOCK,
  });
  const sessionAuth = await auth.api.getSession({ headers: await headers() });
  const [
    stockState,
    staff,
    depotItems,
    history,
    rate,
    pendingHandover,
    liveSituation,
  ] = await Promise.all([
    getOpenServiceStockSessionAction(organizationId, branchId),
    listBranchStaffForServiceStockAction(organizationId, branchId),
    listDepotSellableItemsAction(organizationId, branchId),
    listServiceStockSessionsAction(organizationId, branchId),
    getActiveExchangeRate(branchId),
    getPendingHandoverFloatAction(organizationId, branchId),
    getLiveShiftSituationAction(organizationId, branchId),
  ]);

  return (
    <ServiceStockClient
      organizationId={organizationId}
      branchId={branchId}
      branchName={branch.name}
      session={stockState.session}
      foreignSession={stockState.foreignSession}
      proposedFloat={stockState.proposedFloat}
      staff={staff}
      depotItems={depotItems}
      history={history}
      liveSituation={liveSituation}
      pendingHandover={pendingHandover}
      rate={rate}
      currentUserId={sessionAuth?.user?.id ?? ""}
      currentUserName={
        sessionAuth?.user?.name?.trim() ||
        sessionAuth?.user?.email ||
        "Manager"
      }
      autoOpen={ouvrir === "1"}
      subtitle="float marketeur · dépôt production → ouverture / clôture signées"
      sellHref={usineRoutes.pos(organizationId, branchId)}
      sellLabel="La vente cash"
      depotEmptyHint="Aucun produit fini actif au dépôt production."
    />
  );
}
