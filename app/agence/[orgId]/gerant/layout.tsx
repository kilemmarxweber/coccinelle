import type { ReactNode } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { GerantSidebar } from "@/components/Custom/GerantSidebar";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { legacyGuichetPath } from "@/lib/agence/routes";
import { auth } from "@/lib/auth";
import {
  canAccessGerantShell,
  resolveGerantNavLinks,
} from "@/lib/auth/gerant-access";
import { getSessionOrganizationContext } from "@/lib/auth/org-membership";

type GerantLayoutProps = {
  children: ReactNode;
  params: Promise<{ orgId: string }>;
};

export default async function GerantShellLayout({
  children,
  params,
}: GerantLayoutProps) {
  const { orgId } = await params;
  const allowed = await canAccessGerantShell(orgId);

  if (!allowed) {
    redirect(legacyGuichetPath(orgId));
  }

  const navItems = await resolveGerantNavLinks(orgId);
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });
  const orgContext = session?.user
    ? await getSessionOrganizationContext(
        session.user.id,
        session.session.activeOrganizationId ?? orgId,
      )
    : null;

  const orgName = orgContext?.name ?? "Agence";

  return (
    <SidebarProvider>
      <GerantSidebar orgName={orgName} items={navItems} />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4 md:px-6">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <span className="truncate text-sm text-muted-foreground">
            Pilotage agence
          </span>
        </header>
        <div className="flex flex-1 flex-col">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
