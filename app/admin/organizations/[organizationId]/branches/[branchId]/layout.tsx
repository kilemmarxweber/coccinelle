import type { ReactNode } from "react";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { BranchWorkspace } from "@/components/branch/branch-workspace";
import { auth } from "@/lib/auth";
import { appName } from "@/lib/app-name";
import { canAccessBranch } from "@/lib/branch/user-branches";
import { loadBranchCustomerUiTheme } from "@/lib/branch/load-customer-ui-theme";
import { branchDashboardPath } from "@/lib/branch/paths";
import { resolveCurrentBranchOpsRole } from "@/lib/branch/resolve-ops-role";
import { getViewResourcesForRole } from "@/lib/branch/privileges";
import { isHospitality } from "@/lib/branch/hospitality";

type LayoutProps = {
  children: ReactNode;
  params: Promise<{ organizationId: string; branchId: string }>;
};

export default async function BranchWorkspaceLayout({
  children,
  params,
}: LayoutProps) {
  const { organizationId, branchId } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    redirect(
      `/auth/sign-in?callbackUrl=${encodeURIComponent(branchDashboardPath(organizationId, branchId))}`,
    );
  }

  const branch = await canAccessBranch(
    session.user.id,
    session.user.role,
    branchId,
  );
  if (!branch || branch.organizationId !== organizationId) notFound();

  const [opsRole, customerUi] = await Promise.all([
    resolveCurrentBranchOpsRole(organizationId, branchId),
    loadBranchCustomerUiTheme(branchId),
  ]);
  const viewResources =
    isHospitality(branch.type) || branch.type === "USINE"
      ? await getViewResourcesForRole(opsRole)
      : "ALL";
  const allowedCardIds =
    viewResources === "ALL"
      ? ("ALL" as const)
      : Array.from(viewResources);

  const userName =
    session.user.name?.trim() || session.user.email || "Visiteur";

  return (
    <BranchWorkspace
      organizationId={organizationId}
      branchId={branchId}
      branchName={branch.name}
      branchType={branch.type}
      hasStays={branch.hasStays}
      hasRestaurant={branch.hasRestaurant}
      appName={appName()}
      opsRole={opsRole}
      allowedCardIds={allowedCardIds}
      userName={userName}
      customerUiTheme={customerUi.theme}
      customerUiEnabled={customerUi.isCustom}
    >
      {children}
    </BranchWorkspace>
  );
}
