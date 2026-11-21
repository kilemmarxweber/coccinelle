import { requireBranchContext } from "@/lib/branch/require-branch-context";
import { listTodayEncaissedSalesAction } from "@/lib/boutique/actions";
import { VentesClient } from "./ventes-client";

type PageProps = {
  params: Promise<{ organizationId: string; branchId: string }>;
};

export default async function BoutiqueVentesPage({ params }: PageProps) {
  const { organizationId, branchId } = await params;
  await requireBranchContext({ organizationId, branchId, requireModule: "boutique" });
  const sales = await listTodayEncaissedSalesAction(organizationId, branchId);
  return (
    <VentesClient
      organizationId={organizationId}
      branchId={branchId}
      sales={sales.map((s) => ({
        ...s,
        paidAt: s.paidAt?.toISOString() ?? null,
      }))}
    />
  );
}
