import { redirect } from "next/navigation";
import { requireBranchContext } from "@/lib/branch/require-branch-context";
import { hotelRoutes } from "@/lib/branch/paths";

type PageProps = {
  params: Promise<{ organizationId: string; branchId: string }>;
};

export default async function HotelHubPage({ params }: PageProps) {
  const { organizationId, branchId } = await params;
  await requireBranchContext({
    organizationId,
    branchId,
    requireModule: "hotel",
  });
  redirect(hotelRoutes.sejours(organizationId, branchId));
}
