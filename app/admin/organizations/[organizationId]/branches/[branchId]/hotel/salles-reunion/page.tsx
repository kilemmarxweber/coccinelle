import { requireBranchContext } from "@/lib/branch/require-branch-context";
import { getActiveExchangeRate } from "@/lib/cash/actions";
import {
  listRoomTypesAction,
  listRoomsWithTypesAction,
} from "@/lib/hotel/actions";
import { ChambresClient } from "../chambres/chambres-client";

type PageProps = {
  params: Promise<{ organizationId: string; branchId: string }>;
};

export default async function SallesReunionPage({ params }: PageProps) {
  const { organizationId, branchId } = await params;
  await requireBranchContext({
    organizationId,
    branchId,
    requireModule: "hotel",
    requireHospitality: "stays",
  });
  const [rooms, roomTypes, rate] = await Promise.all([
    listRoomsWithTypesAction(organizationId, branchId, { kind: "MEETING" }),
    listRoomTypesAction(organizationId, branchId, { kind: "MEETING" }),
    getActiveExchangeRate(branchId),
  ]);
  return (
    <ChambresClient
      organizationId={organizationId}
      branchId={branchId}
      rooms={rooms}
      roomTypes={roomTypes}
      rate={rate}
      spaceKind="MEETING"
    />
  );
}
