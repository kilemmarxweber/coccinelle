import { requireBranchContext } from "@/lib/branch/require-branch-context";
import { listBranchPartnersAction } from "@/lib/partners/actions";
import { PartnersClient } from "@/components/partners/partners-client";

type PageProps = {
  params: Promise<{ organizationId: string; branchId: string }>;
};

export default async function AgenceClientsPage({ params }: PageProps) {
  const { organizationId, branchId } = await params;
  await requireBranchContext({
    organizationId,
    branchId,
    requireModule: "agence",
    requireDashCard: "clients",
  });
  const partners = await listBranchPartnersAction(organizationId, branchId, {
    includeInactive: true,
  });
  return (
    <PartnersClient
      organizationId={organizationId}
      branchId={branchId}
      partners={partners}
      variant="agence"
    />
  );
}
