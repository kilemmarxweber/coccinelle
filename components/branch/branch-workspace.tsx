"use client";

import { Suspense, useEffect, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { BranchSidebar } from "@/components/branch/branch-sidebar";
import { BranchWorkspaceHeader } from "@/components/branch/branch-workspace-header";
import { ApplyCustomerUiTheme } from "@/components/theme/apply-customer-ui-theme";
import type { OpsRole } from "@/lib/branch/ops-roles";
import type { CustomerUiTheme } from "@/lib/branch/customer-ui-theme";

export function BranchWorkspace(props: {
  organizationId: string;
  branchId: string;
  branchName: string;
  branchType: string;
  hasStays: boolean;
  hasRestaurant: boolean;
  appName: string;
  opsRole: OpsRole;
  allowedCardIds?: string[] | "ALL";
  userName: string;
  customerUiTheme: CustomerUiTheme;
  customerUiEnabled: boolean;
  children: ReactNode;
}) {
  return (
    <Suspense fallback={<div className="min-h-svh bg-background" />}>
      <BranchWorkspaceShell {...props} />
    </Suspense>
  );
}

function BranchWorkspaceShell(props: {
  organizationId: string;
  branchId: string;
  branchName: string;
  branchType: string;
  hasStays: boolean;
  hasRestaurant: boolean;
  appName: string;
  opsRole: OpsRole;
  allowedCardIds?: string[] | "ALL";
  userName: string;
  customerUiTheme: CustomerUiTheme;
  customerUiEnabled: boolean;
  children: ReactNode;
}) {
  const embed = useSearchParams().get("embed") === "1";

  useEffect(() => {
    if (embed) return;
    document.documentElement.classList.add("branch-shell");
    return () => document.documentElement.classList.remove("branch-shell");
  }, [embed]);

  if (embed) {
    return <div className="min-h-0 bg-background">{props.children}</div>;
  }

  return (
    <SidebarProvider className="branch-shell min-h-svh min-w-0 overflow-x-hidden">
      <ApplyCustomerUiTheme
        theme={props.customerUiTheme}
        enabled={props.customerUiEnabled}
      />
      <BranchSidebar
        organizationId={props.organizationId}
        branchId={props.branchId}
        branchName={props.branchName}
        branchType={props.branchType}
        hasStays={props.hasStays}
        hasRestaurant={props.hasRestaurant}
        appName={props.appName}
        opsRole={props.opsRole}
        allowedCardIds={props.allowedCardIds}
      />
      <SidebarInset className="min-h-svh max-h-svh min-w-0 overflow-hidden bg-muted/40">
        <BranchWorkspaceHeader
          organizationId={props.organizationId}
          branchId={props.branchId}
          branchName={props.branchName}
          branchType={props.branchType}
          opsRole={props.opsRole}
          userName={props.userName}
        />
        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden">
          {props.children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
