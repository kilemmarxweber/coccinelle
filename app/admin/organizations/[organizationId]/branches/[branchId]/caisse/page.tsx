import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  ShoppingCart,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ventePathForBranchType } from "@/lib/branch/branch-menus";
import { branchDashboardPath, hotelRoutes } from "@/lib/branch/paths";
import { requireBranchContext } from "@/lib/branch/require-branch-context";

type PageProps = {
  params: Promise<{ organizationId: string; branchId: string }>;
};

function typeLabel(type: string) {
  if (type === "HOTEL") return "Hôtel";
  if (type === "BOUTIQUE") return "Boutique";
  return "Agence";
}

/** Hub caisse partagé — CTA vente dynamique selon BranchType. */
export default async function BranchCaissePage({ params }: PageProps) {
  const { organizationId, branchId } = await params;
  const branch = await requireBranchContext({ organizationId, branchId });

  // Hôtel : caisse dans le shell Admin hôtel (pas le hub partagé / guichet).
  if (branch.type === "HOTEL") {
    redirect(hotelRoutes.caisse(organizationId, branch.id));
  }

  const vente = ventePathForBranchType(organizationId, branchId, branch.type);
  const hub = branchDashboardPath(organizationId, branchId);

  return (
    <div className="mx-auto flex min-h-svh max-w-2xl flex-col gap-6 px-4 py-8">
      <div className="flex items-start gap-3">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Wallet className="size-6" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {typeLabel(branch.type)} · {branch.name}
          </p>
          <h1 className="text-2xl font-bold tracking-tight">Caisse & Ventes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gérez la session de caisse de la branche, puis enchaînez sur une
            vente adaptée à ce type d&apos;établissement.
          </p>
        </div>
      </div>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          Session de caisse
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Ouverture / clôture de caisse arrivera avec le module cashpaye (B08).
          En attendant, vous pouvez déjà accéder à la surface de vente.
        </p>
        <div className="mt-4 rounded-xl bg-muted/60 px-4 py-3 text-sm">
          <span className="font-medium text-foreground">État : </span>
          <span className="text-muted-foreground">session non branchée (placeholder)</span>
        </div>
      </section>

      <section className="rounded-2xl border border-primary/30 bg-primary/5 p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <ShoppingCart className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold">Effectuer une vente</h2>
            <p className="mt-1 text-sm text-muted-foreground">{vente.description}</p>
            <Button className="mt-4 gap-2" render={<Link href={vente.href} />}>
              {vente.label}
              <ArrowRight className="size-4" />
            </Button>
          </div>
        </div>
      </section>

      <Button variant="ghost" className="self-start" render={<Link href={hub} />}>
        ← Retour au dashboard
      </Button>
    </div>
  );
}
