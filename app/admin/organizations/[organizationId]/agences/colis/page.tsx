import { PageHeader } from "@/components/layout/page-header";
import { assertOrganizationPermission } from "@/lib/auth/organization-permission";
import { ColisManager } from "./components/colis-manager";
import { listColisAction } from "./actions";

type PageProps = {
  params: Promise<{ organizationId: string }>;
  searchParams: Promise<{ statut?: string }>;
};

export default async function ColisPage({ params, searchParams }: PageProps) {
  const { organizationId } = await params;
  const { statut } = await searchParams;

  const readPerm = await assertOrganizationPermission(organizationId, {
    colis: ["voir"],
  });
  const updatePerm = await assertOrganizationPermission(organizationId, {
    colis: ["modifier"],
  });

  const list = readPerm.ok
    ? await listColisAction(organizationId, { statut })
    : null;

  return (
    <div className="min-h-screen pb-10">
      <PageHeader
        title="Colis"
        subtitle="Suivi des envois et destinataires"
        showBack
      />
      <ColisManager
        organizationId={organizationId}
        canRead={readPerm.ok}
        canUpdate={updatePerm.ok}
        denyMessage={readPerm.ok ? undefined : readPerm.message}
        initialItems={list?.ok ? list.data : []}
      />
    </div>
  );
}
