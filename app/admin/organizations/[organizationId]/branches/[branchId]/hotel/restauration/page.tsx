import { requireBranchContext } from "@/lib/branch/require-branch-context";
import {
  ensureHotelMenuSeedAction,
  listMenuItemsAction,
  listOrdersByStatusAction,
} from "@/lib/hotel/actions";
import { RestaurationClient } from "./restauration-client";

type PageProps = {
  params: Promise<{ organizationId: string; branchId: string }>;
};

export default async function RestaurationPage({ params }: PageProps) {
  const { organizationId, branchId } = await params;
  await requireBranchContext({
    organizationId,
    branchId,
    requireModule: "hotel",
  });
  await ensureHotelMenuSeedAction(organizationId, branchId);
  const [menuItems, orders] = await Promise.all([
    listMenuItemsAction(organizationId, branchId),
    listOrdersByStatusAction(organizationId, branchId, [
      "ENVOYEE",
      "EN_PREPARATION",
      "PRETE",
      "EN_CAISSE",
      "PAYEE",
      "LIVREE",
    ]),
  ]);
  return (
    <RestaurationClient
      organizationId={organizationId}
      branchId={branchId}
      menuItems={menuItems}
      orders={orders}
    />
  );
}
