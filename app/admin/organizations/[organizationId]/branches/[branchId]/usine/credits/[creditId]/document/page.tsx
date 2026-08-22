import { requireBranchContext } from "@/lib/branch/require-branch-context";
import { DASH_CARD } from "@/lib/branch/ops-roles";
import { getFactoryCreditAction } from "@/lib/factory/actions";
import { UsineCreditDocument } from "./credit-document";

type PageProps = {
  params: Promise<{ organizationId: string; branchId: string; creditId: string }>;
};

export default async function UsineCreditDocumentPage({ params }: PageProps) {
  const { organizationId, branchId, creditId } = await params;
  const branch = await requireBranchContext({
    organizationId,
    branchId,
    requireModule: "usine",
    requireDashCard: DASH_CARD.USINE_CREDITS,
  });
  const credit = await getFactoryCreditAction(organizationId, branchId, creditId);
  return (
    <UsineCreditDocument
      organizationId={organizationId}
      branchId={branchId}
      branchName={branch.name}
      credit={credit}
    />
  );
}
