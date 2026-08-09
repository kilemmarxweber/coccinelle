import { requireBranchContext } from "@/lib/branch/require-branch-context";
import { getArticlesReportAction } from "@/lib/hotel/reports/actions";
import { defaultReportRange } from "@/lib/hotel/reports/period";
import { ArticlesReportClient } from "../_components/report-clients";

type PageProps = {
  params: Promise<{ organizationId: string; branchId: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
};

export default async function RapportArticlesPage({
  params,
  searchParams,
}: PageProps) {
  const { organizationId, branchId } = await params;
  const sp = await searchParams;
  const branch = await requireBranchContext({ organizationId, branchId });
  const fallback = defaultReportRange(30);
  const from = sp.from?.slice(0, 10) || fallback.from;
  const to = sp.to?.slice(0, 10) || fallback.to;
  const data = await getArticlesReportAction({
    organizationId,
    branchId,
    from,
    to,
  });

  return (
    <ArticlesReportClient
      organizationId={organizationId}
      branchId={branchId}
      branchName={branch.name}
      from={from}
      to={to}
      data={data}
    />
  );
}
