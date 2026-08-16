import { GerantReservationsView } from "@/components/agence/gerant-reservations-view";
import { assertOrganizationPermission } from "@/lib/auth/organization-permission";
import {
  listGerantReservations,
  parseGerantReservationFilters,
} from "@/lib/reports/list-gerant-reservations";

type GerantReservationsPageProps = {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function GerantReservationsPage({
  params,
  searchParams,
}: GerantReservationsPageProps) {
  const { orgId } = await params;
  const sp = await searchParams;

  const perm = await assertOrganizationPermission(orgId, {
    inscription: ["modifier"],
  });
  if (!perm.ok) {
    return (
      <GerantReservationsView
        organizationId={orgId}
        reservations={[]}
        filters={{}}
        errorMessage={perm.message}
      />
    );
  }

  const filters = parseGerantReservationFilters(sp);
  const reservations = await listGerantReservations(orgId, filters);

  return (
    <GerantReservationsView
      organizationId={orgId}
      reservations={reservations}
      filters={filters}
    />
  );
}
