import { requireBranchContext } from "@/lib/branch/require-branch-context";
import { resolveBranchMenuSections } from "@/lib/branch/resolve-branch-menu";
import { BranchMenuSections } from "../branch-menu-sections";

type PageProps = {
  params: Promise<{ organizationId: string; branchId: string }>;
};

export default async function HotelHubPage({ params }: PageProps) {
  const { organizationId, branchId } = await params;
  const branch = await requireBranchContext({
    organizationId,
    branchId,
    requireModule: "hotel",
  });
  const sections = await resolveBranchMenuSections(
    organizationId,
    branch.id,
    "HOTEL",
  );

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-6 sm:px-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Accueil hôtel</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Hébergement, séjours et restauration
        </p>
      </header>

      <BranchMenuSections
        sections={sections}
        emptyMessage="Aucune action hôtel disponible pour votre rôle."
        columnsClassName="sm:grid-cols-2 lg:grid-cols-3"
      />
    </div>
  );
}
