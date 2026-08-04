import { GerantDashboardView } from "@/components/agence/gerant-dashboard-view";
import { getGerantDashboard } from "@/lib/reports/gerant-dashboard";

type GerantOverviewPageProps = {
  params: Promise<{ orgId: string }>;
};

export default async function GerantOverviewPage({
  params,
}: GerantOverviewPageProps) {
  const { orgId } = await params;
  const data = await getGerantDashboard(orgId);

  return <GerantDashboardView data={data} />;
}
