import type { ReactNode } from "react";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { GitBranch } from "lucide-react";
import { DashboardNavbar } from "@/components/layout/dashboard-navbar";
import { BranchNotificationsBell } from "@/components/layout/branch-notifications-bell";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/auth";
import { canAccessBranch } from "@/lib/branch/user-branches";
import {
  branchDashboardPath,
  organizationBranchesPath,
} from "@/lib/branch/paths";

type LayoutProps = {
  children: ReactNode;
  params: Promise<{ organizationId: string; branchId: string }>;
};

function typeLabel(type: string) {
  if (type === "HOTEL") return "Hôtel";
  if (type === "BOUTIQUE") return "Boutique";
  return "Agence";
}

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

  return (
    <div className="min-h-svh bg-background">
      <DashboardNavbar
        title={branch.name}
        subtitle={`${branch.organizationName} · ${typeLabel(branch.type)} · ${branch.code}`}
        titleHref={branchDashboardPath(organizationId, branchId)}
        actions={
          <div className="flex items-center gap-2">
            {branch.type === "HOTEL" ? (
              <BranchNotificationsBell
                organizationId={organizationId}
                branchId={branchId}
              />
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="hidden gap-1.5 sm:inline-flex"
              render={
                <Link href={organizationBranchesPath(organizationId)} />
              }
            >
              <GitBranch className="size-3.5" />
              Branches
            </Button>
          </div>
        }
      />
      {children}
    </div>
  );
}
