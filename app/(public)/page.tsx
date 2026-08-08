import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { Building2, LogIn, Plane } from "lucide-react";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/auth";
import { resolvePostLoginPath } from "@/lib/auth/post-login-redirect";

export const metadata: Metadata = {
  title: "Coccinelle — Accueil",
  description:
    "Coccinelle : réservation voyage et hôtel pour les établissements en RDC. Espace client public et espace staff Admin.",
};

/**
 * Landing Public `/` — produit Coccinelle.
 * Les établissements clients restent sous `/{orgSlug}/…` ; le staff sous `/admin`.
 */
export default async function PublicLandingPage() {
  const h = await headers();
  const session = await auth.api.getSession({ headers: h });
  const staffHref = session?.user
    ? await resolvePostLoginPath(h)
    : "/auth/sign-in";

  return (
    <div className="relative flex min-h-svh flex-col overflow-hidden bg-linear-to-b from-primary/10 via-background to-background">
      <header className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-4 py-5 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2.5 font-bold tracking-tight"
          aria-label="Coccinelle — accueil"
        >
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Plane className="size-4" aria-hidden />
          </span>
          <span className="text-lg sm:text-xl">Coccinelle</span>
        </Link>
        <Button
          size="sm"
          variant={session?.user ? "default" : "outline"}
          render={<Link href={staffHref} />}
        >
          <LogIn data-icon="inline-start" />
          {session?.user ? "Espace staff" : "Connexion staff"}
        </Button>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-10 px-4 pb-16 pt-6 sm:px-6">
        <section className="flex flex-col gap-4" aria-labelledby="landing-title">
          <p className="text-sm font-medium text-primary">SaaS multi-établissements</p>
          <h1
            id="landing-title"
            className="max-w-xl text-4xl font-bold tracking-tight text-foreground sm:text-5xl"
          >
            Coccinelle
          </h1>
          <p className="max-w-lg text-base text-muted-foreground sm:text-lg">
            Outils pour agences de voyage et hôtels en RDC. Les voyageurs et
            clients utilisent l’espace public de leur établissement ; le
            personnel travaille dans Admin.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Button size="lg" render={<Link href={staffHref} />}>
              <LogIn data-icon="inline-start" />
              {session?.user ? "Ouvrir Admin" : "Connexion staff"}
            </Button>
          </div>
        </section>

        <section
          className="rounded-2xl border bg-card/60 p-5 sm:p-6"
          aria-labelledby="org-url-title"
        >
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Building2 className="size-5" aria-hidden />
            </span>
            <div className="min-w-0 space-y-1">
              <h2 id="org-url-title" className="text-lg font-semibold">
                Espace client d’un établissement
              </h2>
              <p className="text-sm text-muted-foreground">
                Chaque organisation a son adresse publique{" "}
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium text-foreground">
                  /{"{orgSlug}"}
                </code>{" "}
                (billets, room service, etc.). Demandez le lien à votre hôtel ou
                agence.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
