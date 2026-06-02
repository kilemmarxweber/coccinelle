import { TrajetsManager } from "./components/trajets-manager";
import { getTrajetsForOrganizationAction } from "./actions";

type PageProps = { params: Promise<{ organizationId: string }> };

export default async function TrajetsPage({ params }: PageProps) {
  const { organizationId } = await params;
  const result = await getTrajetsForOrganizationAction(organizationId);
  const base = `/admin/organizations/${organizationId}/agences`;

  if (!result.ok) {
    return (
      <TrajetsManager
        organizationId={organizationId}
        trajets={[]}
        guichetHref={`${base}/reservations/guichet`}
      />
    );
  }

  return (
    <TrajetsManager
      organizationId={organizationId}
      trajets={result.data}
      guichetHref={`${base}/reservations/guichet`}
    />
  );
}
