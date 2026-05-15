"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

function useAdminTitle(): string {
  const pathname = usePathname();
  const params = useParams();
  const { data: orgs } = authClient.useListOrganizations();

  if (pathname === "/admin") return "Accueil";

  if (pathname.startsWith("/admin/organizations/new")) return "Nouvelle organisation";

  const orgId = params.organizationId as string | undefined;
  if (orgId && pathname.startsWith(`/admin/organizations/${orgId}`)) {
    if (pathname.includes(`/${orgId}/members/new`)) return "Nouveau membre";
    if (pathname.includes(`/${orgId}/members/`) && pathname.endsWith("/edit")) return "Modifier le membre";
    if (pathname.includes(`/${orgId}/members`)) return "Membres";
    if (pathname.includes(`/${orgId}/roles`)) return "Rôles & permissions";

    const list = Array.isArray(orgs) ? orgs : [];
    const org = list.find((o) => o.id === orgId);
    return org?.name ?? "Organisation";
  }

  if (pathname.startsWith("/admin/organizations")) return "Organisations";

  if (pathname.startsWith("/admin/account")) return "Compte";
  if (pathname.startsWith("/admin/settings")) return "Paramètres";
  if (pathname.startsWith("/admin/help")) return "Centre d’aide";

  return "Administration";
}

export function AdminTopBar() {
  const title = useAdminTitle();

  return (
    <header
      className={cn(
        "sticky top-0 z-40 flex min-h-14 shrink-0 items-center justify-between gap-3 border-b bg-background/95 px-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pt-[max(0px,env(safe-area-inset-top))] backdrop-blur",
        "supports-backdrop-filter:bg-background/80 md:px-6",
      )}
    >
      <h1 className="min-w-0 truncate text-lg font-semibold leading-tight">{title}</h1>
      <div className="flex shrink-0 items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-10"
          aria-label="Notifications"
          title="Notifications (bientôt)"
        >
          <Bell className="size-5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="hidden sm:inline-flex"
          render={<Link href="/" />}
        >
          Site
        </Button>
      </div>
    </header>
  );
}
