import Link from "next/link";
import type { Metadata } from "next";
import { getPublicOrganizationBySlug } from "@/lib/pwa/org";
import { getAffiliateDashboardAction, getAffiliatePortalContextAction } from "@/lib/factory/portal-actions";
import { AffilieSignInPrompt } from "./sign-in-prompt";

type PageProps = {
  params: Promise<{ orgSlug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { orgSlug } = await params;
  const org = await getPublicOrganizationBySlug(orgSlug);
  return {
    title: org ? `${org.name} — Portail affilié` : "Portail affilié",
  };
}

export default async function UsineAffilieHomePage({ params }: PageProps) {
  const { orgSlug } = await params;
  const ctx = await getAffiliatePortalContextAction(orgSlug);
  if (!ctx.ok) {
    return <AffilieSignInPrompt orgSlug={orgSlug} message={ctx.error} />;
  }

  const data = await getAffiliateDashboardAction(orgSlug);
  const openCredits = data.credits.filter(
    (c) => c.status === "OPEN" || c.status === "PARTIAL",
  );

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {ctx.customer.branchName}
        </p>
        <h1 className="text-2xl font-bold tracking-tight">
          {ctx.customer.companyName || ctx.customer.name}
        </h1>
        <p className="text-sm text-muted-foreground">
          Bienvenue {ctx.user.name || ctx.customer.contactName || ""}. Consultez
          vos crédits et demandez une livraison.
        </p>
      </header>

      <section className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Crédits ouverts</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {openCredits.length}
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Restant dû</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {openCredits
              .reduce((s, c) => s + c.remainingUsd, 0)
              .toFixed(2)}{" "}
            <span className="text-sm font-normal">USD</span>
          </p>
        </div>
      </section>

      <Link
        href={`/${orgSlug}/usine-affilie/demande`}
        className="inline-flex h-11 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"
      >
        Nouvelle demande
      </Link>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Crédits récents</h2>
        {data.credits.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun crédit pour l’instant.</p>
        ) : (
          <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
            {data.credits.map((c) => (
              <li key={c.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{c.number}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.lines.map((l) => `${l.qty}× ${l.name}`).join(", ")}
                    </p>
                  </div>
                  <div className="text-right text-sm">
                    <p className="tabular-nums font-medium">
                      {c.remainingUsd.toFixed(2)} USD
                    </p>
                    <p className="text-xs text-muted-foreground">{c.status}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Demandes</h2>
        {data.requests.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune demande envoyée.</p>
        ) : (
          <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
            {data.requests.map((r) => (
              <li key={r.id} className="px-4 py-3 text-sm">
                <div className="flex justify-between gap-2">
                  <span>
                    {r.lines.map((l) => `${l.qty}× ${l.name}`).join(", ")}
                  </span>
                  <span className="text-muted-foreground">{r.status}</span>
                </div>
                {r.rejectReason ? (
                  <p className="mt-1 text-xs text-destructive">{r.rejectReason}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {data.reservations.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">Réservations actives</h2>
          <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
            {data.reservations.map((r) => (
              <li key={r.id} className="px-4 py-3 text-sm">
                {r.lines.map((l) => `${l.qty}× ${l.name}`).join(", ")}
                <span className="mt-1 block text-xs text-muted-foreground">
                  jusqu’au {new Date(r.holdUntil).toLocaleDateString("fr-CD")}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
