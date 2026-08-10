import { Suspense } from "react";
import { requireBranchContext } from "@/lib/branch/require-branch-context";
import { canAccessStays } from "@/lib/branch/hospitality";
import { getActiveExchangeRate } from "@/lib/cash/actions";
import {
  ensureHotelMenuSeedAction,
  listActiveStaysForChargeAction,
  listMenuItemsAction,
  listOrdersByStatusAction,
} from "@/lib/hotel/actions";
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
  });
  await ensureHotelMenuSeedAction(organizationId, branchId);
  const hasStays = canAccessStays(branch);
  const [menuItems, orders, rate, activeStays] = await Promise.all([
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
  ]);
  return (
    <Suspense fallback={null}>
      <RestaurationClient
        organizationId={organizationId}
        branchId={branchId}
        menuItems={menuItems}
        orders={orders}
        activeStays={activeStays}
        hasStays={hasStays}
        rate={rate}
        initialView={view === "suivi" ? "suivi" : undefined}
      />
    </Suspense>
  );
}
