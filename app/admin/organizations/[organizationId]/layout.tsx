"use client";

import { useEffect, type ReactNode } from "react";
import { useParams, usePathname } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { OrganizationSwitcher } from "@/components/org/organization-switcher";

/** Espace branche : navbar fixe dédiée — pas de switcher au-dessus. */
function isBranchWorkspacePath(pathname: string): boolean {
  return /^\/admin\/organizations\/[^/]+\/branches\/(?!new(?:\/|$))[^/]+/.test(
    pathname,
  );
}

export default function OrganizationSectionLayout({
  children,
}: {
  children: ReactNode;
}) {
  const params = useParams();
  const pathname = usePathname();
  const organizationId = params.organizationId as string;
  const branchWorkspace = isBranchWorkspacePath(pathname);

  useEffect(() => {
    void authClient.organization.setActive({ organizationId });
  }, [organizationId]);

  if (branchWorkspace) {
    return <>{children}</>;
  }

  return (
    <div className="flex flex-col">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 pt-4 sm:px-6 lg:px-8">
        <OrganizationSwitcher />
      </div>
      {children}
    </div>
  );
}
