import { requireBranchContext } from "@/lib/branch/require-branch-context";
import {
  listConsumableItemsAction,
  listStockMovementsAction,
} from "@/lib/hotel/actions";
import { LivraisonClient } from "./livraison-client";

type PageProps = {
  params: Promise<{ organizationId: string; branchId: string }>;
};

export default async function HotelLivraisonPage({ params }: PageProps) {
  const { organizationId, branchId } = await params;
  await requireBranchContext({
    organizationId,
    branchId,
    requireModule: "hotel",
  });
  const [items, movements] = await Promise.all([
    listConsumableItemsAction(organizationId, branchId),
    listStockMovementsAction(organizationId, branchId, 30),
  ]);
  return (
    <LivraisonClient
      organizationId={organizationId}
      branchId={branchId}
      items={items}
      movements={movements}
    />
  );
}
