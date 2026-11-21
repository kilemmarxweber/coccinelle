"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, Leaf, LogOut } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  branchSidebarNav,
  type BranchSidebarEntry,
} from "@/lib/branch/branch-menus";
import { branchDashboardPath } from "@/lib/branch/paths";
import { type OpsRole } from "@/lib/branch/ops-roles";
import { cn } from "@/lib/utils";

const itemClass =
  "relative h-9 rounded-lg px-2.5 text-[13px] font-medium text-white/80 hover:bg-white/10 hover:text-white data-active:bg-[#1b9a4b] data-active:font-medium data-active:text-white data-active:hover:bg-[#1b9a4b] data-active:hover:text-white [&_svg]:text-white/80 hover:[&_svg]:text-white data-active:[&_svg]:text-white";

const openGroupParentClass =
  "relative h-9 rounded-lg px-2.5 text-[13px] font-medium text-white/90 hover:bg-white/10 hover:text-white data-active:bg-transparent data-active:font-medium data-active:text-white data-active:shadow-none data-active:hover:bg-white/10 [&_svg]:text-white";

const subItemClass =
  "h-8 rounded-md text-[12.5px] text-white/75 hover:bg-white/10 hover:text-white data-active:bg-[#1b9a4b] data-active:font-medium data-active:text-white data-active:hover:bg-[#1b9a4b] data-active:hover:text-white [&>svg]:text-white/75! hover:[&>svg]:text-white! data-active:[&>svg]:text-white!";

function isPathActive(pathname: string, href: string, exact?: boolean) {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function isBestPathMatch(pathname: string, href: string, candidates: string[]) {
  const matches = candidates.filter((h) => isPathActive(pathname, h));
  if (matches.length === 0) return false;
  const best = matches.reduce((a, b) => (a.length >= b.length ? a : b));
  return best === href;
}

function entryIsActive(pathname: string, entry: BranchSidebarEntry) {
  if (entry.href) {
    return isPathActive(pathname, entry.href, !entry.id);
  }
  return Boolean(entry.children?.some((c) => isPathActive(pathname, c.href)));
}

export function BranchSidebar(props: {
  organizationId: string;
  branchId: string;
  branchName: string;
  branchType: string;
  hasStays: boolean;
  hasRestaurant: boolean;
  hasProduction?: boolean;
  appName: string;
  opsRole: OpsRole;
  allowedCardIds?: string[] | "ALL";
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { setOpenMobile, isMobile } = useSidebar();

  async function handleSignOut() {
    await authClient.signOut();
    router.replace("/auth/sign-in");
    router.refresh();
  }
  const items = branchSidebarNav(
    props.organizationId,
    props.branchId,
    props.branchType,
    {
      hasStays: props.hasStays,
      hasRestaurant: props.hasRestaurant,
      hasProduction: props.hasProduction,
    },
    props.opsRole,
    props.allowedCardIds,
  );

  const [openGroup, setOpenGroup] = useState<string | null>(() => {
    const active = items.find(
      (entry) => entry.children && entryIsActive(pathname, entry),
    );
    return active?.title ?? null;
  });

  useEffect(() => {
    if (isMobile) setOpenMobile(false);
  }, [pathname, isMobile, setOpenMobile]);

  useEffect(() => {
    const active = items.find(
      (entry) => entry.children && entryIsActive(pathname, entry),
    );
    if (active) setOpenGroup(active.title);
    // Only follow route changes — opening another group must not snap back.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  function toggleGroup(title: string) {
    setOpenGroup((prev) => (prev === title ? null : title));
  }

  const dashHref = branchDashboardPath(
    props.organizationId,
    props.branchId,
  );

  return (
    <Sidebar
      collapsible="offcanvas"
      className="border-r-0 bg-sidebar text-sidebar-foreground"
    >
      <SidebarHeader className="px-3 py-4">
        <Link
          href={dashHref}
          className="flex items-center gap-2.5 rounded-lg px-1 py-0.5"
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/15">
            <Leaf className="size-4 text-white" aria-hidden />
          </span>
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-sm font-semibold text-white">
              {props.appName}
            </span>
            <span className="block truncate text-[11px] text-white/70">
              {props.branchName}
            </span>
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-2">
        <SidebarGroup className="p-0">
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {items.map((entry) => {
                const hasChildren = Boolean(entry.children?.length);
                const expanded = hasChildren && openGroup === entry.title;
                const childHrefs = entry.children?.map((c) => c.href) ?? [];

                if (!hasChildren && entry.href) {
                  const exactDash = entry.href === dashHref;
                  return (
                    <SidebarMenuItem key={entry.title}>
                      <SidebarMenuButton
                        isActive={
                          exactDash
                            ? pathname === entry.href
                            : isPathActive(pathname, entry.href)
                        }
                        tooltip={entry.title}
                        className={itemClass}
                        render={<Link href={entry.href} />}
                        onClick={() => {
                          if (openGroup != null) setOpenGroup(null);
                        }}
                      >
                        <entry.icon />
                        <span>{entry.title}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                }

                return (
                  <SidebarMenuItem key={entry.title}>
                    <div>
                      <SidebarMenuButton
                        isActive={expanded}
                        tooltip={entry.title}
                        className={expanded ? openGroupParentClass : itemClass}
                        onClick={() => toggleGroup(entry.title)}
                      >
                        <entry.icon />
                        <span>{entry.title}</span>
                        <ChevronDown
                          className={cn(
                            "ml-auto size-3.5 text-white/70 transition-transform",
                            expanded ? "rotate-0 text-white" : "-rotate-90",
                          )}
                        />
                      </SidebarMenuButton>
                      {expanded ? (
                        <SidebarMenuSub className="mx-1 mb-0.5 border-0 px-1 py-1">
                          {entry.children!.map((child) => {
                            const ChildIcon = child.icon;
                            return (
                              <SidebarMenuSubItem key={child.href}>
                                <SidebarMenuSubButton
                                  isActive={isBestPathMatch(
                                    pathname,
                                    child.href,
                                    childHrefs,
                                  )}
                                  className={subItemClass}
                                  render={<Link href={child.href} />}
                                >
                                  {ChildIcon ? <ChildIcon /> : null}
                                  <span>{child.title}</span>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            );
                          })}
                        </SidebarMenuSub>
                      ) : null}
                    </div>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="gap-2 px-3 py-3">
        <div className="rounded-xl bg-black/15 px-3 py-2.5">
          <p className="truncate text-sm font-semibold text-white">
            {props.branchName}
          </p>
          <p className="text-[11px] text-white/70">Département</p>
        </div>
        <p className="flex items-center gap-2 px-1 text-[11px] text-white/80">
          <span className="size-2 rounded-full bg-[#86efac]" />
          Synchronisé
        </p>
        <button
          type="button"
          onClick={handleSignOut}
          className="flex h-9 items-center gap-2 rounded-lg px-2.5 text-[13px] font-medium text-white/90 hover:bg-white/10"
        >
          <LogOut className="size-4" />
          Déconnexion
        </button>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
