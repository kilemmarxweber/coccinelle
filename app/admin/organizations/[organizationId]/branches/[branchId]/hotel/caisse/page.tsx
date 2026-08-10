import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, ShoppingCart, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { hotelRoutes } from "@/lib/branch/paths";
import { requireBranchContext } from "@/lib/branch/require-branch-context";
import { hasOrganizationPermission } from "@/lib/hotel/hotel-permission";

type PageProps = {
  params: Promise<{ organizationId: string; branchId: string }>;
};

/** Caisse hôtel — reste dans le shell Admin hôtel (sidebar + header). */
export default async function HotelCaissePage({ params }: PageProps) {
  const { organizationId, branchId } = await params;
  const branch = await requireBranchContext({
    organizationId,
    branchId,
    requireModule: "hotel",
  });

  const canOpenCaisse = await hasOrganizationPermission(organizationId, {
    hotel_stay: ["update"],
  });
  if (!canOpenCaisse) {
    redirect(hotelRoutes.root(organizationId, branch.id));
  }

  const sejoursHref = hotelRoutes.sejours(organizationId, branch.id);
  const hub = hotelRoutes.root(organizationId, branch.id);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-6 sm:px-6">
      <div className="flex items-start gap-3">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Wallet className="size-6" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Hôtel · {branch.name}
          </p>
          <h1 className="text-2xl font-bold tracking-tight">Caisse & Ventes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Encaissement séjours et restauration — sans guichet voyage.
          </p>
        </div>
      </div>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          Session de caisse
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Ouverture / clôture de caisse arrivera plus tard. En attendant,
          encaisser depuis le folio séjour ou le ticket F&amp;B.
        </p>
        <div className="mt-4 rounded-xl bg-muted/60 px-4 py-3 text-sm">
          <span className="font-medium text-foreground">État : </span>
          <span className="text-muted-foreground">
            session non branchée (placeholder)
          </span>
        </div>
      </section>

      <section className="rounded-2xl border border-primary/30 bg-primary/5 p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <ShoppingCart className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold">Encaisser un séjour</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Ouvrir les séjours pour check-in et encaissement.
            </p>
            <Button className="mt-4 gap-2" render={<Link href={sejoursHref} />}>
              Séjours
              <ArrowRight className="size-4" />
            </Button>
          </div>
        </div>
      </section>

      <Button variant="ghost" className="self-start" render={<Link href={hub} />}>
        ← Accueil hôtel
      </Button>
    </div>
  );
}
