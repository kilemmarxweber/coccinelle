import { notFound } from "next/navigation";
import { requireBranchContext } from "@/lib/branch/require-branch-context";
import { hasOrganizationPermission } from "@/lib/hotel/hotel-permission";
import {
  getStayDetail,
  listStayFormOptions,
} from "@/lib/hotel/list-stays";
import { HotelStayDetail } from "@/components/hotel/hotel-stay-detail";

type PageProps = {
  params: Promise<{
    organizationId: string;
    branchId: string;
    stayId: string;
  }>;
};

export default async function HotelSejourDetailPage({ params }: PageProps) {
  const { organizationId, branchId, stayId } = await params;
  const branch = await requireBranchContext({
    organizationId,
    branchId,
    requireModule: "hotel",
  });

  const [stay, formOptions, canUpdateStay] = await Promise.all([
    getStayDetail(branch.id, stayId),
    listStayFormOptions(branch.id),
    hasOrganizationPermission(organizationId, { hotel_stay: ["update"] }),
  ]);

  if (!stay) {
    notFound();
  }

  return (
    <HotelStayDetail
      organizationId={organizationId}
      branchId={branch.id}
      stay={stay}
      formOptions={formOptions}
      canUpdateStay={canUpdateStay}
    />
  );
}
