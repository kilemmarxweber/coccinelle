import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { hotelRoutes } from "@/lib/branch/paths";
import { canAccessBranch } from "@/lib/branch/user-branches";
import { requireBranchContext } from "@/lib/branch/require-branch-context";
import { resolveBranchMenuSections } from "@/lib/branch/resolve-branch-menu";
import { BranchDashboard } from "./branch-dashboard";
import { BranchMenuSections } from "./branch-menu-sections";

type PageProps = {
  params: Promise<{ organizationId: string; branchId: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { organizationId, branchId } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return { title: "Branche — Coccinelle" };
  }
  const branch = await canAccessBranch(
    session.user.id,
    session.user.role,
    branchId,
  );
  if (!branch || branch.organizationId !== organizationId) {
    return { title: "Branche introuvable" };
  }
  return {
    title: `${branch.name} — Coccinelle`,
    description: `Espace de gestion — ${branch.name}`,
  };
}

export default async function BranchDashboardPage({ params }: PageProps) {
  const { organizationId, branchId } = await params;
  const branch = await requireBranchContext({ organizationId, branchId });

  // Hôtel : toujours le shell Admin hôtel (pas le hub agence avec Plane / billets).
  if (branch.type === "HOTEL") {
    redirect(hotelRoutes.root(branch.organizationId, branch.id));
  }

  const menuSections = await resolveBranchMenuSections(
    branch.organizationId,
    branch.id,
    branch.type,
  );

  return (
    <BranchDashboard
      organizationId={branch.organizationId}
      branchId={branch.id}
      branchName={branch.name}
      branchCode={branch.code}
      branchType={branch.type}
      organizationName={branch.organizationName}
    >
      <BranchMenuSections sections={menuSections} />
    </BranchDashboard>
  );
}
