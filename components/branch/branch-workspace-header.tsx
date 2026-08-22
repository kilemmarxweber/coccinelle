"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { GitBranch, LogOut, UserCircle } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { BranchNotificationsBell } from "@/components/layout/branch-notifications-bell";
import { organizationBranchesPath } from "@/lib/branch/paths";
import { isHospitality } from "@/lib/branch/hospitality";
import { opsRoleLabel, type OpsRole } from "@/lib/branch/ops-roles";

export function BranchWorkspaceHeader(props: {
  organizationId: string;
  branchId: string;
  branchName: string;
  branchType: string;
  opsRole: OpsRole;
  userName: string;
}) {
  const router = useRouter();

  async function handleSignOut() {
    await authClient.signOut();
    router.replace("/auth/sign-in");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-50 flex h-14 w-full min-w-0 shrink-0 items-center gap-3 overflow-hidden border-b border-neutral-200 bg-white px-3 text-neutral-900 sm:h-16 sm:px-5">
      <SidebarTrigger className="text-neutral-800" />

      <div className="ml-auto flex min-w-0 items-center gap-2 sm:gap-3">
        <ThemeToggle />
        {isHospitality(props.branchType) ? (
          <BranchNotificationsBell
            organizationId={props.organizationId}
            branchId={props.branchId}
          />
        ) : null}

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="hidden gap-1.5 sm:inline-flex"
          render={<Link href={organizationBranchesPath(props.organizationId)} />}
        >
          <GitBranch className="size-3.5" />
          Branches
        </Button>

        <div className="flex min-w-0 items-center gap-2">
          <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary text-primary-foreground">
            <UserCircle className="size-5" />
          </div>
          <div className="hidden min-w-0 sm:block">
            <p className="truncate text-sm font-semibold leading-tight text-neutral-900">
              {props.userName}
            </p>
            <p className="truncate text-[11px] text-neutral-500 uppercase">
              {props.branchName} / {opsRoleLabel(props.opsRole)}
            </p>
          </div>
        </div>

        <Button
          type="button"
          size="sm"
          onClick={handleSignOut}
          className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <LogOut className="size-3.5" />
          <span className="hidden sm:inline">Déconnexion</span>
        </Button>
      </div>
    </header>
  );
}
