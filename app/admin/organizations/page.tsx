"use client";

import Link from "next/link";
import { Building2, Plus } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { APP_ROLE } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  DashboardMenuCard,
  DashboardSection,
} from "@/components/ui/dashboard-menu-card";
import { OrganizationSwitcher } from "@/components/org/organization-switcher";

export default function AdminOrganizationsPage() {
  const { data: session } = authClient.useSession();
  const { data: orgsData, isPending } = authClient.useListOrganizations();
  const orgs = Array.isArray(orgsData) ? orgsData : [];
  const canCreateOrganization = session?.user?.role === APP_ROLE.ADMIN;

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-6 sm:px-6 lg:px-8">
      <section className="dash-fade-up relative overflow-hidden rounded-3xl bg-primary px-6 py-7 text-primary-foreground shadow-lg sm:px-8">
        <div className="dash-orb pointer-events-none absolute -top-16 -right-10 size-56 rounded-full bg-white/15 blur-2xl" />
        <div
          className="dash-orb pointer-events-none absolute -bottom-20 left-8 size-44 rounded-full bg-black/20 blur-2xl"
          style={{ animationDelay: "1.4s" }}
        />
        <div className="relative z-10 flex flex-wrap items-end justify-between gap-4">
          <div className="pr-4">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-[11px] font-medium tracking-wide uppercase">
              <span className="dash-pulse size-1.5 rounded-full bg-emerald-300" />
              Console
            </div>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Organisations
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/85 sm:text-base">
              Sélectionnez une organisation pour gérer branches, membres et
              modules.
            </p>
            <p className="mt-3 text-xs text-white/70">
              {isPending
                ? "Chargement…"
                : `${orgs.length} organisation${orgs.length > 1 ? "s" : ""}`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <OrganizationSwitcher className="bg-background/95 text-foreground" />
            {canCreateOrganization ? (
              <Button
                variant="secondary"
                className="gap-1.5 bg-background text-primary hover:bg-background/90"
                render={<Link href="/admin/organizations/new" />}
              >
                <Plus className="size-4" />
                Créer
              </Button>
            ) : null}
          </div>
        </div>
      </section>

      {orgs.length === 0 && !isPending ? (
        <EmptyState
          icon={Building2}
          title="Aucune organisation"
          description="Créez votre premier espace pour inviter des membres et centraliser la gestion."
          action={
            canCreateOrganization ? (
              <Button render={<Link href="/admin/organizations/new" />}>
                Créer une organisation
              </Button>
            ) : undefined
          }
        />
      ) : (
        <DashboardSection
          title="VOS ORGANISATIONS"
          titleColor="text-emerald-400"
          icon={Building2}
          iconColor="text-emerald-400"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {orgs.map((org) => (
              <DashboardMenuCard
                key={org.id}
                href={`/admin/organizations/${org.id}`}
                title={org.name}
                description={`Slug · ${org.slug}`}
                icon={Building2}
                iconBg="bg-primary/15"
                iconColor="text-primary"
                primary
              />
            ))}
          </div>
        </DashboardSection>
      )}
    </div>
  );
}
