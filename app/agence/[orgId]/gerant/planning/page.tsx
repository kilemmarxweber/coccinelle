import { GerantPlanningView } from "@/components/agence/gerant-planning-view";
import { assertOrganizationPermission } from "@/lib/auth/organization-permission";
import {
  defaultPlanningPeriod,
  listPlanningDeparts,
  listPlanningTrajetOptions,
} from "@/lib/planning/list-planning-departs";

type GerantPlanningPageProps = {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
};

function isIsoDay(value: string | undefined): value is string {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export default async function GerantPlanningPage({
  params,
  searchParams,
}: GerantPlanningPageProps) {
  const { orgId } = await params;
  const sp = await searchParams;
  const defaults = defaultPlanningPeriod();
  const periodFrom = isIsoDay(sp.from) ? sp.from : defaults.from;
  const periodTo = isIsoDay(sp.to) ? sp.to : defaults.to;
  const period =
    periodFrom <= periodTo
      ? { from: periodFrom, to: periodTo }
      : { from: periodTo, to: periodFrom };

  const [departs, trajets, canUpdate, canCancel, canCreate] = await Promise.all([
    listPlanningDeparts(orgId, period),
    listPlanningTrajetOptions(orgId),
    assertOrganizationPermission(orgId, { depart: ["modifier"] }),
    assertOrganizationPermission(orgId, { depart: ["annuler"] }),
    assertOrganizationPermission(orgId, { depart: ["ajouter"] }),
  ]);

  return (
    <GerantPlanningView
      organizationId={orgId}
      periodFrom={period.from}
      periodTo={period.to}
      departs={departs}
      trajets={trajets}
      canUpdate={canUpdate.ok}
      canCancel={canCancel.ok}
      canCreate={canCreate.ok}
    />
  );
}
