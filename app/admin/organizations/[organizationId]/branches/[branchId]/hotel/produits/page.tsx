import { requireBranchContext } from "@/lib/branch/require-branch-context";
import { getActiveExchangeRate } from "@/lib/cash/actions";
import {
  ensureHotelMenuSeedAction,
  listAllMenuItemsAction,
} from "@/lib/hotel/actions";
import { ProduitsClient } from "./produits-client";

type PageProps = {
  params: Promise<{ organizationId: string; branchId: string }>;
};

export default async function HotelProduitsPage({ params }: PageProps) {
  const { organizationId, branchId } = await params;
  await requireBranchContext({
    organizationId,
    branchId,
    requireModule: "hotel",
    requireHospitality: "restaurant",
    requireDashCard: "produits_hotel",
  });
  await ensureHotelMenuSeedAction(organizationId, branchId);
  const [items, rate] = await Promise.all([
    listAllMenuItemsAction(organizationId, branchId),
    getActiveExchangeRate(branchId),
  ]);
  return (
    <ProduitsClient
      organizationId={organizationId}
      branchId={branchId}
      items={items}
      rate={rate}
    />
  );
}
