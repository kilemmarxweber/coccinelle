import { RolesClient } from "./roles-client";
import { listOrgRolesAction } from "./actions";

type PageProps = {
  params: Promise<{ organizationId: string }>;
};

export default async function OrganizationRolesPage({ params }: PageProps) {
  const { organizationId } = await params;
  const result = await listOrgRolesAction(organizationId);

  return (
    <RolesClient
      organizationId={organizationId}
      initialRoles={result.ok ? result.roles : []}
      initialCapabilities={result.capabilities}
    />
  );
}
