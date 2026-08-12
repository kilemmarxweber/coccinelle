import Link from "next/link";
import { LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReportsNav } from "@/components/reports/report-shell";
import { requireBranchContext } from "@/lib/branch/require-branch-context";
import {
  canAccessRestaurant,
  canAccessStays,
  isHospitality,
} from "@/lib/branch/hospitality";
import { getActiveExchangeRate } from "@/lib/cash/actions";
import {
  formatBothAmounts,
  formatBothRateLabels,
} from "@/lib/cash/exchange";
import { getBoutiqueDashboardKpisAction } from "@/lib/boutique/actions";
import { getHotelDashboardKpisAction } from "@/lib/hotel/actions";
import {
  branchDashboardPath,
  boutiqueRoutes,
  hotelRoutes,
} from "@/lib/branch/paths";

type PageProps = {
  params: Promise<{ organizationId: string; branchId: string }>;
};

export default async function TableauBordPage({ params }: PageProps) {
  const { organizationId, branchId } = await params;
  const branch = await requireBranchContext({ organizationId, branchId });
  const hospitality = isHospitality(branch.type);
  const isBoutique = branch.type === "BOUTIQUE";
  const showStays = canAccessStays(branch);
  const showRestaurant = canAccessRestaurant(branch);

  const [hotelKpis, boutiqueKpis, rate] = await Promise.all([
    hospitality
      ? getHotelDashboardKpisAction(organizationId, branchId)
      : Promise.resolve(null),
    isBoutique
      ? getBoutiqueDashboardKpisAction(organizationId, branchId)
      : Promise.resolve(null),
    hospitality || isBoutique
      ? getActiveExchangeRate(branchId)
      : Promise.resolve(null),
  ]);

  const kpis = hotelKpis;
  const caBoth = kpis
    ? formatBothAmounts(kpis.caJour, rate)
    : boutiqueKpis
      ? formatBothAmounts(boutiqueKpis.caJour, rate)
      : null;
  const rateLabels = formatBothRateLabels(rate);

  const kpiCards = kpis
    ? [
        showStays
          ? {
              label: "Occupation",
              value: `${kpis.occupancyPct}%`,
              sub: null as string | null,
            }
          : null,
        showStays
          ? {
              label: "Chambres occupées",
              value: `${kpis.occupied}/${kpis.rooms}`,
              sub: null as string | null,
            }
          : null,
        {
          label: "CA caisse (jour)",
          value: caBoth ?? `${kpis.caJour.toFixed(2)} $`,
          sub: rateLabels?.both ?? null,
        },
        showRestaurant
          ? {
              label: "Tickets F&B (jour)",
              value: String(kpis.ticketsFnbJour),
              sub: null as string | null,
            }
          : null,
      ].filter((x): x is NonNullable<typeof x> => x != null)
    : boutiqueKpis
      ? [
          {
            label: "CA boutique (jour)",
            value: caBoth ?? `${boutiqueKpis.caJour.toFixed(2)} $`,
            sub: rateLabels?.both ?? null,
          },
          {
            label: "Tickets (jour)",
            value: String(boutiqueKpis.ticketsJour),
            sub: null as string | null,
          },
          {
            label: "En attente",
            value: String(boutiqueKpis.heldCount),
            sub: null as string | null,
          },
          {
            label: "Stock bas",
            value: String(boutiqueKpis.lowStock),
            sub: "≤ 5 unités",
          },
        ]
      : [];

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-6">
      <div className="flex items-start gap-3">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-violet-500/15 text-violet-500">
          <LayoutDashboard className="size-6" />
        </span>
        <div>
          <h1 className="text-2xl font-bold">Tableau de Bord</h1>
          <p className="text-sm text-muted-foreground">{branch.name}</p>
          {rateLabels ? (
            <p className="mt-1 text-xs font-medium text-sky-700 dark:text-sky-300">
              {rateLabels.both}
            </p>
          ) : null}
        </div>
      </div>

      <ReportsNav
        organizationId={organizationId}
        branchId={branchId}
        active="tableauBord"
      />

      {kpiCards.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {kpiCards.map((k) => (
            <div
              key={k.label}
              className="rounded-2xl border border-border bg-card p-5 shadow-sm"
            >
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {k.label}
              </p>
              <p className="mt-2 text-3xl font-bold text-primary">{k.value}</p>
              {k.sub ? (
                <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                  {k.sub}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          KPI disponibles sur une branche Hôtel, Restaurant ou Commerce.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {showStays ? (
          <Button
            variant="outline"
            render={
              <Link href={hotelRoutes.sejours(organizationId, branchId)} />
            }
          >
            Séjours
          </Button>
        ) : null}
        {showRestaurant ? (
          <Button
            variant="outline"
            render={
              <Link href={hotelRoutes.restauration(organizationId, branchId)} />
            }
          >
            Restauration
          </Button>
        ) : null}
        {isBoutique ? (
          <Button
            variant="outline"
            render={
              <Link href={boutiqueRoutes.pos(organizationId, branchId)} />
            }
          >
            Point de vente
          </Button>
        ) : null}
        <Button
          variant="outline"
          render={
            <Link href={branchDashboardPath(organizationId, branchId)} />
          }
        >
          Retour
        </Button>
      </div>
    </div>
  );
}
