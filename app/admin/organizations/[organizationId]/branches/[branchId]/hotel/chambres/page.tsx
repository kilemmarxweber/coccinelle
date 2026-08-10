import { requireBranchContext } from "@/lib/branch/require-branch-context";
import { listRoomsWithTypesAction } from "@/lib/hotel/actions";
import { ChambresClient } from "./chambres-client";

type PageProps = {
  params: Promise<{ organizationId: string; branchId: string }>;
};

export default async function ChambresPage({ params }: PageProps) {
  const { organizationId, branchId } = await params;
  await requireBranchContext({
    organizationId,
    branchId,
    requireModule: "hotel",
    requireHospitality: "stays",
  });
  const rooms = await listRoomsWithTypesAction(organizationId, branchId);
  return (
    <ChambresClient
      organizationId={organizationId}
      branchId={branchId}
      rooms={rooms}
    />
  );
}
