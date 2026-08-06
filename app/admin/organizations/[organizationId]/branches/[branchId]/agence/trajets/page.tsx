import { requireBranchContext } from "@/lib/branch/require-branch-context";
import { BranchModulePlaceholder } from "../../_components/branch-module-placeholder";

type PageProps = {
  params: Promise<{ organizationId: string; branchId: string }>;
};

export default async function AgenceTrajetsPage({ params }: PageProps) {
  const { organizationId, branchId } = await params;
  const branch = await requireBranchContext({
    organizationId,
    branchId,
    requireModule: "agence",
  });
  return (
    <BranchModulePlaceholder
      organizationId={organizationId}
      branchId={branchId}
      branchName={branch.name}
      title="Trajets"
      description="Lignes et tarifs scopés à cette branche AGENCE."
    />
  );
}
