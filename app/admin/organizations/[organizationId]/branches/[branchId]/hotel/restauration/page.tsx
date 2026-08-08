import { requireBranchContext } from "@/lib/branch/require-branch-context";
import { hasOrganizationPermission } from "@/lib/hotel/hotel-permission";
import {
  listFnbFormOptions,
  listFoodOrders,
  listMenuCategories,
  listRestaurantTables,
} from "@/lib/hotel/list-fnb";
import { listUpcomingTableReservations } from "@/lib/hotel/list-table-reservations";
import { HotelRestaurationPanel } from "@/components/hotel/hotel-restauration-panel";

type PageProps = {
  params: Promise<{ organizationId: string; branchId: string }>;
};

export default async function HotelRestaurationPage({ params }: PageProps) {
  const { organizationId, branchId } = await params;
  const branch = await requireBranchContext({
    organizationId,
    branchId,
    requireModule: "hotel",
  });

  const [
    categories,
    orders,
    tables,
    tableReservations,
    formOptions,
    canCreate,
    canUpdate,
    canDelete,
  ] = await Promise.all([
    listMenuCategories(branch.id),
    listFoodOrders(branch.id),
    listRestaurantTables(branch.id),
    listUpcomingTableReservations(branch.id),
    listFnbFormOptions(branch.id),
    hasOrganizationPermission(organizationId, { hotel_fnb: ["create"] }),
    hasOrganizationPermission(organizationId, { hotel_fnb: ["update"] }),
    hasOrganizationPermission(organizationId, { hotel_fnb: ["delete"] }),
  ]);

  return (
    <HotelRestaurationPanel
      organizationId={organizationId}
      branchId={branch.id}
      branchName={branch.name}
      categories={categories}
      orders={orders}
      tables={tables}
      tableReservations={tableReservations}
      formOptions={formOptions}
      canCreate={canCreate}
      canUpdate={canUpdate}
      canDelete={canDelete}
    />
  );
}
