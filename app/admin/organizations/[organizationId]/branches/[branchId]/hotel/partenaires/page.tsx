import { requireBranchContext } from "@/lib/branch/require-branch-context";
import { DASH_CARD } from "@/lib/branch/ops-roles";
import { listBranchPartnersAction } from "@/lib/partners/actions";
import { PartnersClient } from "@/components/partners/partners-client";

type PageProps = {
  params: Promise<{ organizationId: string; branchId: string }>;
};

export default async function HotelPartenairesPage({ params }: PageProps) {
  const { organizationId, branchId } = await params;
  await requireBranchContext({
    organizationId,
    branchId,
    requireModule: "hotel",
    requireHospitality: "stays",
    requireDashCard: DASH_CARD.CLIENTS_PARTENAIRES,
  });
  const partners = await listBranchPartnersAction(organizationId, branchId, {
    includeInactive: true,
  });
  return (
    <PartnersClient
      organizationId={organizationId}
      branchId={branchId}
      partners={partners}
      variant="hotel"
    />
  );
}
