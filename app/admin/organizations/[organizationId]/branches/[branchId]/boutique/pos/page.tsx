import { requireBranchContext } from "@/lib/branch/require-branch-context";
import { BranchModulePlaceholder } from "../../_components/branch-module-placeholder";

type PageProps = {
  params: Promise<{ organizationId: string; branchId: string }>;
};

export default async function BoutiquePosPage({ params }: PageProps) {
  const { organizationId, branchId } = await params;
  const branch = await requireBranchContext({
    organizationId,
    branchId,
    requireModule: "boutique",
  });
  return (
    <BranchModulePlaceholder
      organizationId={organizationId}
      branchId={branchId}
      branchName={branch.name}
      title="Point de vente"
      description="Caisse POS — panier, ticket, remises."
    />
  );
}
