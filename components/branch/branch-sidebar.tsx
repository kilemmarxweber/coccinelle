"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Plane } from "lucide-react";
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
  "h-9 rounded-lg px-2.5 text-[13px] text-primary-foreground hover:bg-white hover:text-neutral-900 data-active:bg-white data-active:font-medium data-active:text-neutral-900 data-active:hover:bg-white data-active:hover:text-neutral-900";

const openGroupParentClass =
  "h-9 rounded-lg px-2.5 text-[13px] text-neutral-900 hover:bg-neutral-100 hover:text-neutral-900 data-active:bg-transparent data-active:font-medium data-active:text-neutral-900 data-active:hover:bg-neutral-100 [&>svg]:text-neutral-900";

const subItemClass =
  "h-8 rounded-md text-[12.5px] text-neutral-900 hover:bg-neutral-100 hover:text-neutral-900 data-active:bg-neutral-200 data-active:font-medium data-active:text-neutral-900 data-active:hover:bg-neutral-200 [&>svg]:text-neutral-900 hover:[&>svg]:text-neutral-900 data-active:[&>svg]:text-neutral-900";

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
  appName: string;
  opsRole: OpsRole;
  allowedCardIds?: string[] | "ALL";
}) {
  const pathname = usePathname();
  const { setOpenMobile, isMobile } = useSidebar();
  const items = branchSidebarNav(
    props.organizationId,
    props.branchId,
    props.branchType,
    { hasStays: props.hasStays, hasRestaurant: props.hasRestaurant },
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
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/15">
            <Plane className="size-5 text-white" aria-hidden />
          </span>
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-base font-bold tracking-[0.14em] text-white">
              {props.appName}
            </span>
            <span className="block truncate text-[10px] tracking-wide text-white/70 uppercase">
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
                    <div
                      className={cn(
                        expanded && "rounded-lg bg-white p-0.5 text-neutral-900",
                      )}
                    >
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
                            "ml-auto size-3.5 opacity-80 transition-transform",
                            expanded
                              ? "rotate-0 text-neutral-900"
                              : "-rotate-90",
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

      <SidebarFooter className="px-3 py-3">
        <p className="truncate px-1 text-[10px] text-white/55">
          {props.appName}
        </p>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
