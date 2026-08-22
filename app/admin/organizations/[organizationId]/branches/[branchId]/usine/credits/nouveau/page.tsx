import { requireBranchContext } from "@/lib/branch/require-branch-context";
import { DASH_CARD } from "@/lib/branch/ops-roles";
import {
  listFactoryCustomersAction,
  listFactoryFloatProductsAction,
} from "@/lib/factory/actions";
import { UsineCreditNewClient } from "./credit-new-client";

type PageProps = {
  params: Promise<{ organizationId: string; branchId: string }>;
  searchParams: Promise<{ lines?: string; family?: string }>;
};

export default async function UsineCreditNewPage({ params, searchParams }: PageProps) {
  const { organizationId, branchId } = await params;
  const { lines, family } = await searchParams;
  const branch = await requireBranchContext({
    organizationId,
    branchId,
    requireModule: "usine",
    requireDashCard: DASH_CARD.USINE_CREDITS,
  });
  const [customers, products] = await Promise.all([
    listFactoryCustomersAction(organizationId, branchId),
    listFactoryFloatProductsAction(organizationId, branchId),
  ]);
  const catalog = products.filter((p) => {
    if (p.finishedFamily === "EAU" && !branch.hasEau) return false;
    if (p.finishedFamily === "VIN" && !branch.hasVin) return false;
    return true;
  });
  return (
    <UsineCreditNewClient
      organizationId={organizationId}
      branchId={branchId}
      branchName={branch.name}
      customers={customers}
      products={catalog}
      hasEau={branch.hasEau}
      hasVin={branch.hasVin}
      initialLines={lines}
      initialFamily={family}
    />
  );
}
