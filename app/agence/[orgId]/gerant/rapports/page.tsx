import { GerantRapportsView } from "@/components/agence/gerant-rapports-view";
import { PageHeader } from "@/components/layout/page-header";
import { assertOrganizationPermission } from "@/lib/auth/organization-permission";
import {
  getGerantCaRapport,
  parseCaPeriod,
} from "@/lib/reports/gerant-ca";

type GerantRapportsPageProps = {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function GerantRapportsPage({
  params,
  searchParams,
}: GerantRapportsPageProps) {
  const { orgId } = await params;
  const sp = await searchParams;

  const perm = await assertOrganizationPermission(orgId, {
    rapport_agence: ["voir"],
  });
  if (!perm.ok) {
    return (
      <div className="flex min-h-full flex-col">
        <PageHeader
          title="Rapports"
          subtitle={perm.message}
        />
        <p className="px-4 py-8 text-sm text-muted-foreground md:px-6">
          Accès réservé aux rôles avec la permission{" "}
          <code className="text-xs">rapport_agence:voir</code>.
        </p>
      </div>
    );
  }

  const period = parseCaPeriod(sp);
  const rapport = await getGerantCaRapport(orgId, period);

  return <GerantRapportsView rapport={rapport} />;
}
