"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import {
  CirclePile,
  GitBranch,
  LayoutGrid,
  School,
  Shield,
  Users,
} from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import {
  DashboardMenuCard,
  DashboardSection,
} from "@/components/ui/dashboard-menu-card";
import { APP_ROLE } from "@/lib/permissions";

export default function AdminOrganizationHomePage() {
  const params = useParams();
  const id = params.organizationId as string;
  const { data: session } = authClient.useSession();
  const { data: orgs, isPending } = authClient.useListOrganizations();
  const list = Array.isArray(orgs) ? orgs : [];
  const org = list.find((o) => o.id === id);
  const base = `/admin/organizations/${id}`;
  const userName =
    session?.user?.name?.trim() || session?.user?.email || "Visiteur";
  const role =
    session?.user?.role === APP_ROLE.ADMIN
      ? "Administrateur"
      : session?.user?.role ?? "Membre";

  if (!isPending && !org) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <p className="text-muted-foreground">Organisation introuvable.</p>
        <Button
          className="mt-4"
          variant="outline"
          render={<Link href="/admin/organizations" />}
        >
          Retour à la liste
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-6 sm:px-6 lg:px-8">
      {isPending ? (
        <p className="text-sm text-muted-foreground">Chargement…</p>
      ) : (
        <>
          <section className="relative overflow-hidden rounded-2xl bg-primary px-6 py-7 shadow-sm shadow-primary/20 sm:px-8">
            <div className="pr-16">
              <h2 className="text-2xl font-bold text-primary-foreground sm:text-3xl">
                Bonjour, {userName} 👋
              </h2>
              <p className="mt-2 max-w-2xl text-sm text-primary-foreground/85 sm:text-base">
                Espace organisation « {org?.name} ». Choisissez une option pour
                continuer.
              </p>
              <p className="mt-3 text-xs text-primary-foreground/70">
                Slug · {org?.slug}
              </p>
            </div>
            <div className="absolute top-5 right-5 rounded-full bg-background/95 px-3.5 py-1.5 text-xs font-semibold text-primary shadow-sm sm:top-6 sm:right-6">
              Droit : {role}
            </div>
          </section>

          <DashboardSection
            title="PILOTAGE"
            titleColor="text-emerald-400"
            icon={LayoutGrid}
            iconColor="text-emerald-400"
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <DashboardMenuCard
                href={`${base}/branches`}
                title="Branches"
                description="Agence, Hôtel ou Boutique — créer et ouvrir un dashboard."
                icon={GitBranch}
                iconBg="bg-emerald-500/15"
                iconColor="text-emerald-400"
                primary
              />
              <DashboardMenuCard
                href={`${base}/agences`}
                title="Espace voyage"
                description="Guichet, trajets et réservations (legacy AGENCE)."
                icon={School}
                iconBg="bg-sky-500/15"
                iconColor="text-sky-400"
              />
              <DashboardMenuCard
                href={`${base}/members`}
                title="Membres"
                description="Créer un compte et gérer les membres de l’organisation."
                icon={Users}
                iconBg="bg-violet-500/15"
                iconColor="text-violet-400"
              />
              <DashboardMenuCard
                href={`${base}/roles`}
                title="Rôles & permissions"
                description="Vue des rôles métier et des droits associés."
                icon={Shield}
                iconBg="bg-rose-500/15"
                iconColor="text-rose-400"
              />
              <DashboardMenuCard
                href={`${base}/Families`}
                title="Partenaires"
                description="Gérer les partenaires."
                icon={CirclePile}
                iconBg="bg-primary/15"
                iconColor="text-primary"
              />
            </div>
          </DashboardSection>

          <Button
            variant="ghost"
            className="h-11 px-0 sm:w-fit"
            render={<Link href="/admin/organizations" />}
          >
            ← Toutes les organisations
          </Button>
        </>
      )}
    </div>
  );
}
