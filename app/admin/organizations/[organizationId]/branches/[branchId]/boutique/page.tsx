import { requireBranchContext } from "@/lib/branch/require-branch-context";
import { redirect } from "next/navigation";
import { boutiqueRoutes } from "@/lib/branch/paths";

type PageProps = {
  params: Promise<{ organizationId: string; branchId: string }>;
};

/** /boutique → Point de vente (cœur commerce). */
export default async function BoutiqueRootPage({ params }: PageProps) {
  const { organizationId, branchId } = await params;
  await requireBranchContext({
    organizationId,
    branchId,
    requireModule: "boutique",
  });
  redirect(boutiqueRoutes.pos(organizationId, branchId));
}
