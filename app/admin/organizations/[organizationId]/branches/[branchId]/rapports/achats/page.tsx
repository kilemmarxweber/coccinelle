import { requireBranchContext } from "@/lib/branch/require-branch-context";
import { getPurchasesReportAction } from "@/lib/hotel/reports/actions";
import { defaultReportRange } from "@/lib/hotel/reports/period";
import { PurchasesReportClient } from "../_components/report-clients";

type PageProps = {
  params: Promise<{ organizationId: string; branchId: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
};

export default async function RapportAchatsPage({
  params,
  searchParams,
}: PageProps) {
  const { organizationId, branchId } = await params;
  const sp = await searchParams;
  const branch = await requireBranchContext({
    organizationId,
    branchId,
    requireDashCard: "rapport_achats",
  });
  const fallback = defaultReportRange(30);
  const from = sp.from?.slice(0, 10) || fallback.from;
  const to = sp.to?.slice(0, 10) || fallback.to;
  const data = await getPurchasesReportAction({
    organizationId,
    branchId,
    from,
    to,
  });

  return (
    <PurchasesReportClient
      organizationId={organizationId}
      branchId={branchId}
      branchName={branch.name}
      from={from}
      to={to}
      data={data}
    />
  );
}
