import { requireBranchContext } from "@/lib/branch/require-branch-context";
import { hasOrganizationPermission } from "@/lib/hotel/hotel-permission";
import { listRoomsBoard } from "@/lib/hotel/list-rooms-board";
import { HotelRoomBoard } from "@/components/hotel/hotel-room-board";

type PageProps = {
  params: Promise<{ organizationId: string; branchId: string }>;
};

export default async function HotelChambresPage({ params }: PageProps) {
  const { organizationId, branchId } = await params;
  const branch = await requireBranchContext({
    organizationId,
    branchId,
    requireModule: "hotel",
  });

  const [board, canManageInventory, canUpdateStatus] = await Promise.all([
    listRoomsBoard(branch.id),
    hasOrganizationPermission(organizationId, { hotel_room: ["create"] }),
    hasOrganizationPermission(organizationId, { hotel_room: ["update"] }),
  ]);

  return (
    <HotelRoomBoard
      organizationId={organizationId}
      branchId={branch.id}
      initial={board}
      canManageInventory={canManageInventory}
      canUpdateStatus={canUpdateStatus}
    />
  );
}
