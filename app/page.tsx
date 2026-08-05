"use client";

import { useEffect, useState, type ComponentType } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeftRight,
  Box,
  ClipboardList,
  FileBarChart,
  FileText,
  Folder,
  History,
  LayoutDashboard,
  LogIn,
  LogOut,
  Package,
  PencilRuler,
  Plane,
  ShoppingCart,
  TrendingUp,
  Users,
  Wallet,
  Shield,
  Layers,
  Globe2,
  UserCircle,
} from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { APP_ROLE } from "@/lib/permissions";

type MenuItem = {
  title: string;
  description: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  iconBg: string;
  iconColor: string;
};

type MenuSection = {
  title: string;
  titleColor: string;
  icon: ComponentType<{ className?: string }>;
  iconColor: string;
  items: MenuItem[];
};

const sections: MenuSection[] = [
  {
    title: "OPÉRATIONS AU QUOTIDIEN",
    titleColor: "text-emerald-400",
    icon: ClipboardList,
    iconColor: "text-emerald-400",
    items: [
      {
        title: "Caisse & Ventes",
        description: "Effectuer une vente et facturer.",
        href: "#",
        icon: ShoppingCart,
        iconBg: "bg-emerald-500/15",
        iconColor: "text-emerald-400",
      },
      {
        title: "Clients",
        description: "Gestion du portefeuille clients.",
        href: "#",
        icon: Users,
        iconBg: "bg-violet-500/15",
        iconColor: "text-violet-400",
      },
      {
        title: "Dépenses",
        description: "Suivi des charges d'exploitation.",
        href: "#",
        icon: Wallet,
        iconBg: "bg-rose-500/15",
        iconColor: "text-rose-400",
      },
      {
        title: "Taux de Change",
        description: "Mise à jour des devises.",
        href: "#",
        icon: ArrowLeftRight,
        iconBg: "bg-primary/15",
        iconColor: "text-primary",
      },
    ],
  },
  {
    title: "CATALOGUE & STOCKS",
    titleColor: "text-sky-400",
    icon: Layers,
    iconColor: "text-sky-400",
    items: [
      {
        title: "Articles",
        description: "Catalogue, prix et références.",
        href: "#",
        icon: Box,
        iconBg: "bg-violet-500/15",
        iconColor: "text-violet-400",
      },
      {
        title: "Fiche de Stock",
        description: "Mouvements et niveaux de stock.",
        href: "#",
        icon: FileText,
        iconBg: "bg-sky-500/15",
        iconColor: "text-sky-400",
      },
      {
        title: "Approvisionnement",
        description: "Suivi des approvisionnements.",
        href: "#",
        icon: TrendingUp,
        iconBg: "bg-emerald-500/15",
        iconColor: "text-emerald-400",
      },
      {
        title: "Cote d'Alerte",
        description: "Niveau de rupture de stock.",
        href: "#",
        icon: AlertTriangle,
        iconBg: "bg-rose-500/15",
        iconColor: "text-rose-400",
      },
      {
        title: "Catégories",
        description: "Classifications des articles.",
        href: "#",
        icon: Folder,
        iconBg: "bg-sky-500/15",
        iconColor: "text-sky-400",
      },
      {
        title: "Unités de Mesure",
        description: "Gestion des conditionnements.",
        href: "#",
        icon: PencilRuler,
        iconBg: "bg-primary/15",
        iconColor: "text-primary",
      },
    ],
  },
  {
    title: "ANALYSES & RAPPORTS",
    titleColor: "text-teal-400",
    icon: Globe2,
    iconColor: "text-teal-400",
    items: [
      {
        title: "Tableau de Bord",
        description: "Statistiques et indicateurs clés.",
        href: "#",
        icon: LayoutDashboard,
        iconBg: "bg-violet-500/15",
        iconColor: "text-violet-400",
      },
      {
        title: "Rapport Ventes",
        description: "Analyse fine des ventes globales.",
        href: "#",
        icon: FileBarChart,
        iconBg: "bg-sky-500/15",
        iconColor: "text-sky-400",
      },
      {
        title: "Rapport Achats",
        description: "Statistiques des approvisionnements.",
        href: "#",
        icon: Package,
        iconBg: "bg-primary/15",
        iconColor: "text-primary",
      },
      {
        title: "Rapport Financier",
        description: "Analyse des revenus et dépenses.",
        href: "#",
        icon: FileText,
        iconBg: "bg-sky-500/15",
        iconColor: "text-sky-400",
      },
      {
        title: "Rapport Article",
        description: "Quantités vendues des articles.",
        href: "#",
        icon: FileBarChart,
        iconBg: "bg-primary/15",
        iconColor: "text-primary",
      },
    ],
  },
  {
    title: "SYSTÈME & SÉCURITÉ",
    titleColor: "text-rose-400",
    icon: Shield,
    iconColor: "text-rose-400",
    items: [
      {
        title: "Utilisateurs",
        description: "Gestion des comptes et des droits.",
        href: "#",
        icon: Users,
        iconBg: "bg-violet-500/15",
        iconColor: "text-violet-400",
      },
      {
        title: "Journal d'Audit",
        description: "Historique des actions système.",
        href: "#",
        icon: History,
        iconBg: "bg-sky-500/15",
        iconColor: "text-sky-400",
      },
    ],
  },
];

function formatDateTime(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} - ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function roleLabel(role: string | null | undefined) {
  if (role === APP_ROLE.ADMIN) return "Administrateur";
  if (role === APP_ROLE.USER) return "Utilisateur";
  return role ? role.charAt(0).toUpperCase() + role.slice(1) : "Visiteur";
}

export default function HomePage() {
  const { data: session, isPending } = authClient.useSession();
  const [now, setNow] = useState<Date | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  const user = session?.user;
  const isAuthenticated = Boolean(user);
  const userName = user?.name?.trim() || user?.email || "Visiteur";

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await authClient.signOut();
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <div className="min-h-svh bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur supports-backdrop-filter:bg-card/80">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4 sm:h-16 sm:px-6 lg:px-8">
          <Link href="/" className="flex min-w-0 items-center gap-2.5">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground sm:size-9">
              <Plane className="size-4" aria-hidden />
            </span>
            <span className="truncate text-base font-bold tracking-tight text-primary sm:text-lg">
              Coccinelle
            </span>
          </Link>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <div className="hidden rounded-full bg-muted px-3 py-1.5 text-xs text-muted-foreground tabular-nums md:block md:text-sm">
              {now ? formatDateTime(now) : "\u00A0"}
            </div>

            <ThemeToggle />

            {isAuthenticated ? (
              <div className="flex max-w-[9rem] items-center gap-2 sm:max-w-none">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <UserCircle className="size-5" />
                </div>
                <span className="truncate text-sm font-medium text-foreground">
                  {isPending ? "…" : userName}
                </span>
              </div>
            ) : null}

            {isAuthenticated ? (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={signingOut}
                onClick={handleSignOut}
                className="gap-1.5"
              >
                <LogOut className="size-3.5" />
                <span>{signingOut ? "…" : "Déconnexion"}</span>
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                className="gap-1.5"
                render={<Link href="/auth/sign-in" />}
              >
                <LogIn className="size-3.5" />
                <span>Connexion</span>
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-8 px-4 py-6 sm:px-6 lg:px-8">
        <section className="relative overflow-hidden rounded-2xl bg-primary px-6 py-7 shadow-sm shadow-primary/20 sm:px-8">
          <div className="pr-16">
            <h2 className="text-2xl font-bold text-primary-foreground sm:text-3xl">
              {isAuthenticated
                ? `Bonjour, ${userName} 👋`
                : "Bienvenue sur Coccinelle 👋"}
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-primary-foreground/85 sm:text-base">
              {isAuthenticated
                ? "Bienvenue sur votre espace de gestion d'activité. Sélectionnez une option pour commencer."
                : "Connectez-vous pour accéder à votre espace de gestion d'activité."}
            </p>
          </div>
          <div className="absolute top-5 right-5 rounded-full bg-background/95 px-3.5 py-1.5 text-xs font-semibold text-primary shadow-sm sm:top-6 sm:right-6">
            Droit : {roleLabel(user?.role)}
          </div>
        </section>

        {sections.map((section) => {
          const SectionIcon = section.icon;
          return (
            <section key={section.title} className="space-y-4">
              <div className="flex items-center gap-2">
                <SectionIcon className={`size-5 ${section.iconColor}`} />
                <h3
                  className={`text-sm font-bold tracking-wide uppercase ${section.titleColor}`}
                >
                  {section.title}
                </h3>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {section.items.map((item) => {
                  const ItemIcon = item.icon;
                  return (
                    <Link
                      key={item.title}
                      href={item.href}
                      className="group flex items-start gap-3.5 rounded-xl border border-border bg-card p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md hover:shadow-primary/10"
                    >
                      <div
                        className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${item.iconBg}`}
                      >
                        <ItemIcon className={`size-5 ${item.iconColor}`} />
                      </div>
                      <div className="min-w-0 pt-0.5">
                        <p className="font-semibold text-foreground group-hover:text-primary">
                          {item.title}
                        </p>
                        <p className="mt-0.5 text-sm leading-snug text-muted-foreground">
                          {item.description}
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          );
        })}
      </main>
    </div>
  );
}
