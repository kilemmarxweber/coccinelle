import { requireBranchContext } from "@/lib/branch/require-branch-context";
import prisma from "@/lib/prisma";
import { MarketingClient } from "./marketing-client";

type PageProps = {
  params: Promise<{ organizationId: string; branchId: string }>;
};

export default async function BoutiqueMarketingPage({ params }: PageProps) {
  const { organizationId, branchId } = await params;
  await requireBranchContext({ organizationId, branchId, requireModule: "boutique" });
  const top = await prisma.shopSaleItem.groupBy({
    by: ["name"],
    where: { sale: { branchId, status: "ENCAISSEE" } },
    _sum: { quantity: true },
    orderBy: { _sum: { quantity: "desc" } },
    take: 10,
  });
  const promos = await prisma.shopProduct.findMany({
    where: { branchId, promoActive: true, active: true },
    select: { id: true, name: true, price: true, promoPrice: true, promoLabel: true },
    take: 20,
  });
  return (
    <MarketingClient
      organizationId={organizationId}
      branchId={branchId}
      top={top.map((t) => ({ name: t.name, qty: t._sum.quantity ?? 0 }))}
      promos={promos}
    />
  );
}
