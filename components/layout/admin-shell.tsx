"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { Building2 } from "lucide-react";
import { AdminTopBar } from "@/components/layout/admin-top-bar";
import { DashboardNavbar } from "@/components/layout/dashboard-navbar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

/**
 * Espace branche (hub + modules) :
 * `/admin/organizations/:orgId/branches/:branchId/...` (hors `/new`).
 */
function isBranchWorkspacePath(pathname: string): boolean {
  return /^\/admin\/organizations\/[^/]+\/branches\/(?!new(?:\/|$))[^/]+/.test(
    pathname,
  );
}

/** Console org (liste, hub, branches, membres…) — navbar dashboard, sans MobileNav. */
function isOrgConsolePath(pathname: string): boolean {
  if (isBranchWorkspacePath(pathname)) return false;
  return pathname.startsWith("/admin/organizations");
}

function OrgConsoleNavbar() {
  const pathname = usePathname();
  const params = useParams();
  const { data: orgs } = authClient.useListOrganizations();
  const list = Array.isArray(orgs) ? orgs : [];
  const orgId = params.organizationId as string | undefined;
  const org = orgId ? list.find((o) => o.id === orgId) : undefined;

  const isList = pathname === "/admin/organizations";
  const isNew = pathname.startsWith("/admin/organizations/new");

  let title = "Organisations";
  let subtitle = "Coccinelle · Administration";
  let titleHref = "/admin/organizations";

  if (isNew) {
    title = "Nouvelle organisation";
    subtitle = "Création";
  } else if (org) {
    title = org.name;
    subtitle = org.slug ? `Slug · ${org.slug}` : "Organisation";
    titleHref = `/admin/organizations/${org.id}`;
  }

  const actions =
    org && !isList ? (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="hidden gap-1.5 sm:inline-flex"
        render={<Link href={`/admin/organizations/${org.id}/branches`} />}
      >
        <Building2 className="size-3.5" />
        Branches
      </Button>
    ) : null;

  return (
    <DashboardNavbar
      title={title}
      subtitle={subtitle}
      titleHref={titleHref}
      actions={actions}
    />
  );
}

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  if (isBranchWorkspacePath(pathname)) {
    return <>{children}</>;
  }

  if (isOrgConsolePath(pathname)) {
    return (
      <div className="flex min-h-svh flex-col bg-background text-foreground">
        <OrgConsoleNavbar />
        <main className="flex-1">{children}</main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <AdminTopBar />
      <main className="flex-1 pb-[76px] md:pb-0">{children}</main>
      <MobileNav />
    </div>
  );
}
