import { requireBranchContext } from "@/lib/branch/require-branch-context";
import { DASH_CARD } from "@/lib/branch/ops-roles";
import {
  listFactoryCustomersAction,
  listFactoryFloatProductsAction,
  listFactoryReservationsAction,
} from "@/lib/factory/actions";
import { UsineReservationsClient } from "./reservations-client";

type PageProps = {
  params: Promise<{ organizationId: string; branchId: string }>;
};

export default async function UsineReservationsPage({ params }: PageProps) {
  const { organizationId, branchId } = await params;
  await requireBranchContext({
    organizationId,
    branchId,
    requireModule: "usine",
    requireDashCard: DASH_CARD.USINE_RESERVATIONS,
  });
  const [reservations, customers, products] = await Promise.all([
    listFactoryReservationsAction(organizationId, branchId),
    listFactoryCustomersAction(organizationId, branchId),
    listFactoryFloatProductsAction(organizationId, branchId),
  ]);
  return (
    <UsineReservationsClient
      organizationId={organizationId}
      branchId={branchId}
      reservations={reservations}
      customers={customers.filter((c) => c.active)}
      products={products}
    />
  );
}
