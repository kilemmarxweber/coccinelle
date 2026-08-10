import { requireBranchContext } from "@/lib/branch/require-branch-context";
import { listOrdersByStatusAction } from "@/lib/hotel/actions";
import { CuisineClient } from "./cuisine-client";

type PageProps = {
  params: Promise<{ organizationId: string; branchId: string }>;
};

export default async function CuisinePage({ params }: PageProps) {
  const { organizationId, branchId } = await params;
  await requireBranchContext({
    organizationId,
    branchId,
    requireModule: "hotel",
    requireHospitality: "restaurant",
  });
  const orders = await listOrdersByStatusAction(organizationId, branchId, [
    "ENVOYEE",
    "EN_PREPARATION",
  ]);
  return (
    <CuisineClient
      organizationId={organizationId}
      branchId={branchId}
      orders={orders}
    />
  );
}
