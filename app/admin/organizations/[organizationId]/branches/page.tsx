import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Building2, GitBranch, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { DashboardSection } from "@/components/ui/dashboard-menu-card";
import prisma from "@/lib/prisma";
import { listBranchesAction } from "./actions";
import { BranchesListClient } from "./branches-list-client";

type PageProps = { params: Promise<{ organizationId: string }> };

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
      <div>
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 mb-3 gap-1.5 text-muted-foreground hover:text-foreground"
          render={<Link href={`/admin/organizations/${organizationId}`} />}
        >
          <ArrowLeft className="size-4" />
          Accueil organisation
        </Button>
        <section className="relative overflow-hidden rounded-2xl bg-primary px-6 py-7 shadow-sm shadow-primary/20 sm:px-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-primary-foreground sm:text-3xl">
                Branches
              </h2>
              <p className="mt-2 max-w-2xl text-sm text-primary-foreground/85 sm:text-base">
                {org.name} — choisissez une branche pour ouvrir son dashboard, ou
                gérez-la via le menu ⋯.
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
      </div>

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
          <BranchesListClient
            organizationId={organizationId}
            branches={branches}
          />
        </DashboardSection>
      )}
    </div>
  );
}
