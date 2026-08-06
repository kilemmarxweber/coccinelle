import { requireBranchContext } from "@/lib/branch/require-branch-context";
import { BranchModulePlaceholder } from "../../_components/branch-module-placeholder";

type PageProps = {
  params: Promise<{ organizationId: string; branchId: string }>;
};

export default async function AgenceHubPage({ params }: PageProps) {
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
      title="Module Agence"
      description="Voyage : réservations, trajets, colis, embarquement. Les écrans métier seront branchés ici (migration depuis /agences)."
    />
  );
}
