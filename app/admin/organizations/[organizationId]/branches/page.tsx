import Link from "next/link";
import { notFound } from "next/navigation";
import { Building2, GitBranch, Hotel, Plus, Store, UtensilsCrossed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  DashboardMenuCard,
  DashboardSection,
} from "@/components/ui/dashboard-menu-card";
import { isHospitality } from "@/lib/branch/hospitality";
import {
  agencyModesLabel,
  shopVerticalsLabel,
} from "@/lib/branch/agency-shop";
import prisma from "@/lib/prisma";
import { listBranchesAction } from "./actions";

type PageProps = { params: Promise<{ organizationId: string }> };

const TYPE_META = {
  AGENCE: {
    label: "Agence",
    icon: Building2,
    iconBg: "bg-emerald-500/15",
    iconColor: "text-emerald-400",
  },
  HOTEL: {
    label: "Hôtel",
    icon: Hotel,
    iconBg: "bg-sky-500/15",
    iconColor: "text-sky-400",
  },
  RESTAURANT: {
    label: "Restaurant",
    icon: UtensilsCrossed,
    iconBg: "bg-violet-500/15",
    iconColor: "text-violet-400",
  },
  BOUTIQUE: {
    label: "Boutique",
    icon: Store,
    iconBg: "bg-violet-500/15",
    iconColor: "text-violet-400",
  },
} as const;

export default async function BranchesPage({ params }: PageProps) {
  const { organizationId } = await params;
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, name: true },
  });
  if (!org) notFound();

  const list = await listBranchesAction(organizationId);
  const branches = list.ok ? list.data : [];

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-6 sm:px-6 lg:px-8">
      <section className="relative overflow-hidden rounded-2xl bg-primary px-6 py-7 shadow-sm shadow-primary/20 sm:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-primary-foreground sm:text-3xl">
              Branches
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-primary-foreground/85 sm:text-base">
              {org.name} — choisissez une branche pour ouvrir son dashboard.
            </p>
          </div>
          <Button
            variant="secondary"
            className="gap-1.5 bg-background text-primary hover:bg-background/90"
            render={
              <Link
                href={`/admin/organizations/${organizationId}/branches/new`}
              />
            }
          >
            <Plus className="size-4" />
            Nouvelle branche
          </Button>
        </div>
      </section>

      {branches.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="Aucune branche"
          description="Créez une Agence, une hôtellerie-restaurant ou un commerce pour commencer. Les éléments du type seront chargés automatiquement."
          action={
            <Button
              render={
                <Link
                  href={`/admin/organizations/${organizationId}/branches/new`}
                />
              }
            >
              Créer une branche
            </Button>
          }
        />
      ) : (
        <DashboardSection
          title="POINTS D’EXPLOITATION"
          titleColor="text-emerald-400"
          icon={GitBranch}
          iconColor="text-emerald-400"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {branches.map((b) => {
              const meta = TYPE_META[b.type] ?? {
                label: branchTypeLabel(b.type),
                icon: Building2,
                iconBg: "bg-muted",
                iconColor: "text-muted-foreground",
              };
              const canOpen = b.status === "ACTIVE";
              const stats =
                b.type === "AGENCE"
                  ? `${b._count.trajets} trajets · ${agencyModesLabel(b)}`
                  : isHospitality(b.type)
                    ? [
                        b.hasStays
                          ? `${b._count.hotelRoomTypes} types chambres`
                          : null,
                        b.hasRestaurant
                          ? `${b._count.menuItems} produits F&B`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ") || "Hôtellerie-restaurant"
                    : `${b._count.shopCategories} cat. · ${shopVerticalsLabel(b)}`;
              const href = canOpen
                ? `/admin/organizations/${organizationId}/branches/${b.id}`
                : `/admin/organizations/${organizationId}/branches`;

              const detailBadge =
                b.type === "AGENCE"
                  ? agencyModesLabel(b)
                  : b.type === "BOUTIQUE"
                    ? shopVerticalsLabel(b)
                    : meta.label;

              return (
                <DashboardMenuCard
                  key={b.id}
                  href={href}
                  title={b.name}
                  description={`${b.city ? `${b.city} · ` : ""}${stats} · ${b._count.members} membres`}
                  icon={meta.icon}
                  iconBg={meta.iconBg}
                  iconColor={meta.iconColor}
                  primary={canOpen}
                  footer={
                    <div className="flex flex-wrap gap-1.5">
                      <Badge variant="secondary">{detailBadge}</Badge>
                      <Badge variant="outline">{b.code}</Badge>
                      <Badge variant="outline">{b.status}</Badge>
                    </div>
                  }
                />
              );
            })}
          </div>
        </DashboardSection>
      )}
    </div>
  );
}
