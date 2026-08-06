"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AdminTopBar } from "@/components/layout/admin-top-bar";
import { MobileNav } from "@/components/layout/mobile-nav";

/**
 * Espace branche (hub + modules agence/hotel/boutique/caisse) :
 * `/admin/organizations/:orgId/branches/:branchId/...` (hors `/new`).
 */
function isBranchWorkspacePath(pathname: string): boolean {
  return /^\/admin\/organizations\/[^/]+\/branches\/(?!new(?:\/|$))[^/]+/.test(
    pathname,
  );
}

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  if (isBranchWorkspacePath(pathname)) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <AdminTopBar />
      <main className="flex-1 pb-[76px] md:pb-0">{children}</main>
      <MobileNav />
    </div>
  );
}
