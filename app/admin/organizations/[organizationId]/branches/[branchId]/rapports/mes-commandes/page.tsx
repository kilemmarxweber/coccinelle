import { requireBranchContext } from "@/lib/branch/require-branch-context";
import { DASH_CARD } from "@/lib/branch/ops-roles";
import { getMyOrdersReportAction } from "@/lib/hotel/reports/actions";
import { defaultReportRange } from "@/lib/hotel/reports/period";
import { MyOrdersReportClient } from "../_components/ops-report-clients";

type PageProps = {
  params: Promise<{ organizationId: string; branchId: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
};

export default async function MesCommandesReportPage({
  params,
  searchParams,
}: PageProps) {
  const { organizationId, branchId } = await params;
  const sp = await searchParams;
  const branch = await requireBranchContext({
    organizationId,
    branchId,
    requireModule: "hotel",
    requireHospitality: "restaurant",
    requireDashCard: DASH_CARD.RAPPORT_MES_COMMANDES,
  });
  const fallback = defaultReportRange(14);
  const from = sp.from?.slice(0, 10) || fallback.from;
  const to = sp.to?.slice(0, 10) || fallback.to;
  const data = await getMyOrdersReportAction({
    organizationId,
    branchId,
    from,
    to,
  });

  return (
    <MyOrdersReportClient
      organizationId={organizationId}
      branchId={branchId}
      branchName={branch.name}
      from={from}
      to={to}
      data={data}
    />
  );
}
