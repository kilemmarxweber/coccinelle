"use client";

import Link from "next/link";
import { GitBranch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { BranchNotificationsBell } from "@/components/layout/branch-notifications-bell";
import { organizationBranchesPath } from "@/lib/branch/paths";
import { isHospitality } from "@/lib/branch/hospitality";
import { opsRoleLabel, type OpsRole } from "@/lib/branch/ops-roles";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export function BranchWorkspaceHeader(props: {
  organizationId: string;
  branchId: string;
  branchName: string;
  branchType: string;
  opsRole: OpsRole;
  userName: string;
}) {
  return (
    <header className="sticky top-0 z-50 flex h-16 w-full min-w-0 shrink-0 items-center gap-3 overflow-hidden border-b border-border bg-background/85 px-4 text-foreground backdrop-blur-md sm:px-6">
      <SidebarTrigger className="text-muted-foreground hover:bg-muted hover:text-foreground" />

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

        <div className="flex min-w-0 items-center gap-2.5 rounded-full py-1 pr-1 pl-1">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
            {initials(props.userName)}
          </div>
          <div className="hidden min-w-0 sm:block">
            <p className="truncate text-[13px] font-semibold leading-tight text-foreground">
              {props.userName}
            </p>
            <p className="truncate text-[11px] text-muted-foreground">
              {props.branchName} · {opsRoleLabel(props.opsRole)}
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}
