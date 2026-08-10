import { requireBranchContext } from "@/lib/branch/require-branch-context";
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
  });
  await ensureHotelMenuSeedAction(organizationId, branchId);
  const items = await listAllMenuItemsAction(organizationId, branchId);
  return (
    <ProduitsClient
      organizationId={organizationId}
      branchId={branchId}
      items={items}
    />
  );
}
