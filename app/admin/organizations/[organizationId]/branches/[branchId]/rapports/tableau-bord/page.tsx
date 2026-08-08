import Link from "next/link";
import { LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { requireBranchContext } from "@/lib/branch/require-branch-context";
import { getHotelDashboardKpisAction } from "@/lib/hotel/actions";
import { branchDashboardPath, hotelRoutes } from "@/lib/branch/paths";

type PageProps = {
  params: Promise<{ organizationId: string; branchId: string }>;
};

export default async function TableauBordPage({ params }: PageProps) {
  const { organizationId, branchId } = await params;
  const branch = await requireBranchContext({ organizationId, branchId });
  const kpis =
    branch.type === "HOTEL"
      ? await getHotelDashboardKpisAction(organizationId, branchId)
      : null;

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-6">
      <div className="flex items-start gap-3">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-violet-500/15 text-violet-500">
          <LayoutDashboard className="size-6" />
        </span>
        <div>
          <h1 className="text-2xl font-bold">Tableau de Bord</h1>
          <p className="text-sm text-muted-foreground">{branch.name}</p>
        </div>
      </div>

      {kpis ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Occupation", value: `${kpis.occupancyPct}%` },
            { label: "Chambres occupées", value: `${kpis.occupied}/${kpis.rooms}` },
            { label: "CA caisse (jour)", value: `${kpis.caJour.toFixed(2)} $` },
            { label: "Tickets F&B (jour)", value: String(kpis.ticketsFnbJour) },
          ].map((k) => (
            <div
              key={k.label}
              className="rounded-2xl border border-border bg-card p-5 shadow-sm"
            >
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {k.label}
              </p>
              <p className="mt-2 text-3xl font-bold text-primary">{k.value}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          KPI hôtel disponibles sur une branche HOTEL.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          render={
            <Link href={hotelRoutes.sejours(organizationId, branchId)} />
          }
        >
          Séjours
        </Button>
        <Button
          variant="outline"
          render={
            <Link href={branchDashboardPath(organizationId, branchId)} />
          }
        >
          Dashboard
        </Button>
      </div>
    </div>
  );
}
