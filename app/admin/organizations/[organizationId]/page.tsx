import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  BarChart3,
  GitBranch,
  LayoutGrid,
  Shield,
  Users,
} from "lucide-react";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { APP_ROLE } from "@/lib/permissions";
import {
  DashboardMenuCard,
  DashboardSection,
} from "@/components/ui/dashboard-menu-card";
import { YayoPilotage } from "./yayo-pilotage";

type PageProps = { params: Promise<{ organizationId: string }> };

export default async function AdminOrganizationHomePage({ params }: PageProps) {
  const { organizationId } = await params;
  const [org, session] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, name: true, slug: true },
    }),
    auth.api.getSession({ headers: await headers() }),
  ]);
  if (!org) notFound();

  const base = `/admin/organizations/${org.id}`;
  const userName =
    session?.user?.name?.trim() || session?.user?.email || "Visiteur";
  const role =
    session?.user?.role === APP_ROLE.ADMIN
      ? "Administrateur"
      : session?.user?.role ?? "Membre";

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-6 sm:px-6 lg:px-8">
      <div>
        <Link
          href="/admin/organizations"
          className="mb-3 inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Toutes les organisations
        </Link>
        <section className="dash-fade-up relative overflow-hidden rounded-3xl bg-primary px-6 py-7 text-primary-foreground shadow-lg sm:px-8">
          <div className="dash-orb pointer-events-none absolute -top-16 -right-10 size-56 rounded-full bg-white/15 blur-2xl" />
          <div
            className="dash-orb pointer-events-none absolute -bottom-20 left-8 size-44 rounded-full bg-black/20 blur-2xl"
            style={{ animationDelay: "1.4s" }}
          />
          <div className="relative z-10 pr-16">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-[11px] font-medium tracking-wide uppercase">
              <span className="dash-pulse size-1.5 rounded-full bg-emerald-300" />
              Organisation
            </div>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Bonjour, {userName}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/85 sm:text-base">
              Espace « {org.name} ». Branches, membres et rapports au même
              endroit.
            </p>
            <p className="mt-3 text-xs text-white/70">Slug · {org.slug}</p>
          </div>
          <div className="absolute top-5 right-5 z-10 rounded-full bg-background/95 px-3.5 py-1.5 text-xs font-semibold text-primary shadow-sm sm:top-6 sm:right-6">
            Droit : {role}
          </div>
        </section>
      </div>

      <DashboardSection
        title="PILOTAGE"
        titleColor="text-emerald-400"
        icon={LayoutGrid}
        iconColor="text-emerald-400"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <DashboardMenuCard
            href={`${base}/branches`}
            title="Branches / départements"
            description="Sites d’exploitation — pour CAFE YAYO : Mini Market, Buffet, etc."
            icon={GitBranch}
            iconBg="bg-emerald-500/15"
            iconColor="text-emerald-400"
            primary
          />
          <DashboardMenuCard
            href={`${base}/rapports`}
            title="ANALYSES & RAPPORTS"
            description="Indicateurs, ventes et bilans par branche."
            icon={BarChart3}
            iconBg="bg-teal-500/15"
            iconColor="text-teal-400"
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
        </div>
      </DashboardSection>

      <YayoPilotage organizationId={org.id} />
    </div>
  );
}
