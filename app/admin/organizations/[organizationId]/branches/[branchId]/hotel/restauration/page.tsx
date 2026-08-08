import { Suspense } from "react";
import { requireBranchContext } from "@/lib/branch/require-branch-context";
import {
  ensureHotelMenuSeedAction,
  listMenuItemsAction,
  listOrdersByStatusAction,
} from "@/lib/hotel/actions";
import { RestaurationClient } from "./restauration-client";

type PageProps = {
  params: Promise<{ organizationId: string; branchId: string }>;
  searchParams: Promise<{ view?: string }>;
};

export default async function RestaurationPage({
  params,
  searchParams,
}: PageProps) {
  const { organizationId, branchId } = await params;
  const { view } = await searchParams;
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
    <Suspense fallback={null}>
      <RestaurationClient
        organizationId={organizationId}
        branchId={branchId}
        menuItems={menuItems}
        orders={orders}
        initialView={view === "suivi" ? "suivi" : undefined}
      />
    </Suspense>
  );
}
