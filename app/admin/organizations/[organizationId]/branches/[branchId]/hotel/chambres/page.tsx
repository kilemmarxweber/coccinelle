import { requireBranchContext } from "@/lib/branch/require-branch-context";
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
  const board = await listRoomsBoard(branch.id);

  return (
    <HotelRoomBoard
      organizationId={organizationId}
      branchId={branch.id}
      branchName={branch.name}
      initial={board}
    />
  );
}
