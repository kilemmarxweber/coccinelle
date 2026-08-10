import type { Metadata } from "next";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { canAccessBranch } from "@/lib/branch/user-branches";
import { requireBranchContext } from "@/lib/branch/require-branch-context";
import { BranchDashboard } from "./branch-dashboard";

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

  return (
    <BranchDashboard
      organizationId={branch.organizationId}
      branchId={branch.id}
      branchName={branch.name}
      branchCode={branch.code}
      branchType={branch.type}
      hasStays={branch.hasStays}
      hasRestaurant={branch.hasRestaurant}
      hasAvion={branch.hasAvion}
      hasBus={branch.hasBus}
      hasBateau={branch.hasBateau}
      hasPharmacie={branch.hasPharmacie}
      hasShop={branch.hasShop}
      hasAlimentation={branch.hasAlimentation}
      organizationName={branch.organizationName}
    />
  );
}
