import { requireBranchContext } from "@/lib/branch/require-branch-context";
import { DASH_CARD } from "@/lib/branch/ops-roles";
import {
  listConsumableItemsAction,
  listStockMovementsAction,
} from "@/lib/hotel/actions";
import prisma from "@/lib/prisma";
import { LivraisonClient } from "./livraison-client";

type PageProps = {
  params: Promise<{ organizationId: string; branchId: string }>;
};

export default async function HotelLivraisonPage({ params }: PageProps) {
  const { organizationId, branchId } = await params;
  await requireBranchContext({
    organizationId,
    branchId,
    requireModule: "hotel",
    requireHospitality: "livraison",
    requireDashCard: DASH_CARD.LIVRAISON,
  });
  const [items, movements, branch] = await Promise.all([
    listConsumableItemsAction(organizationId, branchId),
    listStockMovementsAction(organizationId, branchId, { limit: 200 }),
    prisma.branch.findFirst({
      where: { id: branchId, organizationId },
      select: {
        name: true,
        imageUrl: true,
        address: true,
        city: true,
        phone: true,
        email: true,
      },
    }),
  ]);
  return (
    <LivraisonClient
      organizationId={organizationId}
      branchId={branchId}
      branch={{
        name: branch?.name ?? "Branche",
        imageUrl: branch?.imageUrl ?? null,
        address: branch?.address ?? null,
        city: branch?.city ?? null,
        phone: branch?.phone ?? null,
        email: branch?.email ?? null,
      }}
      items={items}
      movements={movements}
    />
  );
}
