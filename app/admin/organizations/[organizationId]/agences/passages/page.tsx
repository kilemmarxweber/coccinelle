import { PageHeader } from "@/components/layout/page-header";
import { assertOrganizationPermission } from "@/lib/auth/organization-permission";
import { todayIsoLocal } from "@/lib/search-departs/day-bounds";
import { EmbarquementClient } from "./components/embarquement-client";
import { listBoardingDepartsAction } from "./actions";

type PageProps = { params: Promise<{ organizationId: string }> };

export default async function EmbarquementPage({ params }: PageProps) {
  const { organizationId } = await params;

  const perm = await assertOrganizationPermission(organizationId, {
    embarquement: ["scanner"],
  });

  const date = todayIsoLocal();
  const departsResult = perm.ok
    ? await listBoardingDepartsAction(organizationId, date)
    : null;

  return (
    <div className="min-h-screen pb-10">
      <PageHeader
        title="Embarquement"
        subtitle="Scan QR et contrôle des passagers"
        showBack
      />
      <EmbarquementClient
        organizationId={organizationId}
        canScan={perm.ok}
        denyMessage={perm.ok ? undefined : perm.message}
        initialDate={date}
        initialDeparts={
          departsResult?.ok ? departsResult.data : []
        }
      />
    </div>
  );
}
