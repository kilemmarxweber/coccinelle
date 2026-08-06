import { requireBranchContext } from "@/lib/branch/require-branch-context";
import { BranchModulePlaceholder } from "../_components/branch-module-placeholder";

type PageProps = {
  params: Promise<{ organizationId: string; branchId: string }>;
};

export default async function TauxChangePage({ params }: PageProps) {
  const { organizationId, branchId } = await params;
  const branch = await requireBranchContext({ organizationId, branchId });
  return (
    <BranchModulePlaceholder
      organizationId={organizationId}
      branchId={branchId}
      branchName={branch.name}
      title="Taux de Change"
      description="Mise à jour des devises pour les ventes et la caisse de cette branche."
    />
  );
}
