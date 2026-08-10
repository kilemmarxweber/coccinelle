"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BedDouble,
  ClipboardList,
  LayoutDashboard,
  UtensilsCrossed,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import type {
  HotelAdminNavItem,
  HotelAdminNavKey,
} from "@/lib/hotel/hotel-admin-nav";

const NAV_ICONS: Record<HotelAdminNavKey, LucideIcon> = {
  accueil: LayoutDashboard,
  chambres: BedDouble,
  sejours: ClipboardList,
  restauration: UtensilsCrossed,
  caisse: Wallet,
};

type HotelAdminSidebarProps = {
  branchName: string;
  items: HotelAdminNavItem[];
};

export function HotelAdminSidebar({
  branchName,
  items,
}: HotelAdminSidebarProps) {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" tooltip="Hôtel">
              <div className="flex size-8 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
                <BedDouble className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">{branchName}</span>
                <span className="truncate text-xs text-sidebar-foreground/70">
                  Module Hôtel
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const Icon = NAV_ICONS[item.key];
                const isAccueil = item.key === "accueil";
                const isActive = isAccueil
                  ? pathname === item.href
                  : pathname === item.href ||
                    pathname.startsWith(`${item.href}/`);

                return (
                  <SidebarMenuItem key={item.key}>
                    <SidebarMenuButton
                      isActive={isActive}
                      tooltip={item.label}
                      render={<Link href={item.href} />}
                    >
                      <Icon />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}
