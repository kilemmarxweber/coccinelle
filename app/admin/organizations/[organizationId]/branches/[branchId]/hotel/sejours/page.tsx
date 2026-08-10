import { requireBranchContext } from "@/lib/branch/require-branch-context";
import { hasOrganizationPermission } from "@/lib/hotel/hotel-permission";
import {
  listStayFormOptions,
  listStays,
} from "@/lib/hotel/list-stays";
import { isStayListFilter, type StayListFilter } from "@/lib/hotel/stay-status";
import { HotelStaysPanel } from "@/components/hotel/hotel-stays-panel";

type PageProps = {
  params: Promise<{ organizationId: string; branchId: string }>;
  searchParams: Promise<{ filter?: string }>;
};

export default async function HotelSejoursPage({
  params,
  searchParams,
}: PageProps) {
  const { organizationId, branchId } = await params;
  const sp = await searchParams;
  const branch = await requireBranchContext({
    organizationId,
    branchId,
    requireModule: "hotel",
  });

  const rawFilter = sp.filter ?? "";
  const filter: StayListFilter = isStayListFilter(rawFilter)
    ? rawFilter
    : "upcoming";

  const [stays, formOptions, canCreateStay] = await Promise.all([
    listStays(branch.id, filter),
    listStayFormOptions(branch.id),
    hasOrganizationPermission(organizationId, { hotel_stay: ["create"] }),
  ]);

  return (
    <HotelStaysPanel
      organizationId={organizationId}
      branchId={branch.id}
      filter={filter}
      stays={stays}
      formOptions={formOptions}
      canCreateStay={canCreateStay}
    />
  );
}
