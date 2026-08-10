import type { ReactNode } from "react";
import { HotelAdminHeader } from "@/components/hotel/hotel-admin-header";
import { HotelAdminSidebar } from "@/components/hotel/hotel-admin-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { requireBranchContext } from "@/lib/branch/require-branch-context";
import { resolveHotelAdminNavItems } from "@/lib/hotel/hotel-admin-nav";

type HotelAdminLayoutProps = {
  children: ReactNode;
  params: Promise<{ organizationId: string; branchId: string }>;
};

export default async function HotelAdminLayout({
  children,
  params,
}: HotelAdminLayoutProps) {
  const { organizationId, branchId } = await params;
  const branch = await requireBranchContext({
    organizationId,
    branchId,
    requireModule: "hotel",
  });
  const navItems = await resolveHotelAdminNavItems(organizationId, branch.id);

  return (
    <SidebarProvider>
      <HotelAdminSidebar branchName={branch.name} items={navItems} />
      <SidebarInset>
        <HotelAdminHeader
          organizationId={organizationId}
          branchName={branch.name}
        />
        <div className="flex flex-1 flex-col">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
