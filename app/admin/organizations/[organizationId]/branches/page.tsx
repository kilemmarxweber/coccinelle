import Link from "next/link";
import { notFound } from "next/navigation";
import { Building2, Hotel, LayoutDashboard, Plus, Store } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import prisma from "@/lib/prisma";
import { listBranchesAction } from "./actions";

type PageProps = { params: Promise<{ organizationId: string }> };

const TYPE_META = {
  AGENCE: { label: "Agence", icon: Building2 },
  HOTEL: { label: "Hôtel", icon: Hotel },
  BOUTIQUE: { label: "Boutique", icon: Store },
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
    <div className="min-h-screen pb-10">
      <PageHeader
        title="Branches"
        subtitle={`${org.name} — choisissez une branche pour ouvrir son dashboard`}
        showBack
      />

      <div className="mx-auto max-w-3xl space-y-3 px-4 py-6">
        <div className="flex justify-end">
          <Button
            render={
              <Link href={`/admin/organizations/${organizationId}/branches/new`} />
            }
          >
            <Plus className="size-4" />
            Nouvelle branche
          </Button>
        </div>
        {branches.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="Aucune branche"
            description="Créez une Agence, un Hôtel ou une Boutique pour commencer. Les éléments du type seront chargés automatiquement."
            action={
              <Button
                render={
                  <Link href={`/admin/organizations/${organizationId}/branches/new`} />
                }
              >
                Créer une branche
              </Button>
            }
          />
        ) : (
          branches.map((b) => {
            const meta = TYPE_META[b.type];
            const Icon = meta.icon;
            const canOpen = b.status === "ACTIVE";
            return (
              <Card key={b.id}>
                <CardContent className="flex flex-col gap-3 pt-4 sm:flex-row sm:items-start">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{b.name}</p>
                      <Badge variant="secondary">{meta.label}</Badge>
                      <Badge variant="outline">{b.code}</Badge>
                      <Badge variant="outline">{b.status}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {b.city ? `${b.city} · ` : ""}
                      {b.type === "AGENCE" && `${b._count.trajets} trajets`}
                      {b.type === "HOTEL" &&
                        `${b._count.hotelRoomTypes} types de chambres`}
                      {b.type === "BOUTIQUE" &&
                        `${b._count.shopCategories} catégories`}
                      {` · ${b._count.members} membres`}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    className="shrink-0 gap-1.5 self-stretch sm:self-center"
                    disabled={!canOpen}
                    render={
                      canOpen ? (
                        <Link
                          href={`/admin/organizations/${organizationId}/branches/${b.id}`}
                        />
                      ) : undefined
                    }
                  >
                    <LayoutDashboard className="size-3.5" />
                    Dashboard
                  </Button>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
