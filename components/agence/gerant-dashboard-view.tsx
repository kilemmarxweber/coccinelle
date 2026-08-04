import {
  AlertTriangle,
  Banknote,
  Bus,
  Package,
  Ticket,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Progress, ProgressLabel } from "@/components/ui/progress";
import { StatCard, StatGrid } from "@/components/ui/stat-card";
import type { GerantDashboardData } from "@/lib/reports/gerant-dashboard";
import {
  formatDateFr,
  formatMontantFc,
  MODE_TRANSPORT_LABELS,
} from "@/lib/reservation/labels";

type GerantDashboardViewProps = {
  data: GerantDashboardData;
};

/** `YYYY-MM-DD` → Date locale (évite le parse UTC de `new Date(isoDay)`). */
function dateFromIsoDay(isoDay: string): Date {
  const [y, m, d] = isoDay.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function GerantDashboardView({ data }: GerantDashboardViewProps) {
  const { kpis, prochainsDeparts, alertes, dateJour } = data;
  const dateLabel = formatDateFr(dateFromIsoDay(dateJour));

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader
        title="Vue d’ensemble"
        subtitle={`Activité du ${dateLabel} — Coccinelle`}
      />

      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-6 md:px-6">
        <StatGrid>
          <StatCard
            title="Réservations"
            value={kpis.reservationsJour}
            subtitle="Créées aujourd’hui"
            icon={Ticket}
          />
          <StatCard
            title="CA encaissé"
            value={formatMontantFc(kpis.caPayeJour)}
            subtitle="Paiements PAYÉ du jour"
            icon={Banknote}
            variant="success"
          />
          <StatCard
            title="Remplissage"
            value={`${kpis.remplissagePct} %`}
            subtitle={
              kpis.capaciteJour > 0
                ? `${kpis.placesVenduesJour} / ${kpis.capaciteJour} places`
                : "Aucun départ aujourd’hui"
            }
            icon={Bus}
            variant="primary"
          />
          <StatCard
            title="Colis en attente"
            value={kpis.colisEnAttente}
            subtitle="Statut EN_ATTENTE"
            icon={Package}
            variant={kpis.colisEnAttente > 0 ? "warning" : "default"}
          />
        </StatGrid>

        {alertes.length > 0 ? (
          <section className="flex flex-col gap-3">
            <h2 className="text-base font-semibold">Alertes</h2>
            <div className="flex flex-col gap-2">
              {alertes.map((alerte) => {
                if (alerte.kind === "bientot_complet") {
                  return (
                    <Alert key={`complet-${alerte.departId}`}>
                      <AlertTriangle />
                      <AlertTitle>Départ bientôt complet</AlertTitle>
                      <AlertDescription>
                        {alerte.label} — {alerte.placesRestantes} place
                        {alerte.placesRestantes !== 1 ? "s" : ""} restante
                        {alerte.placesRestantes !== 1 ? "s" : ""} sur{" "}
                        {alerte.capacitePlaces} (
                        {Math.round(
                          (alerte.placesRestantes / alerte.capacitePlaces) * 100,
                        )}{" "}
                        %).
                      </AlertDescription>
                    </Alert>
                  );
                }

                return (
                  <Alert key="paiement-en-attente">
                    <Banknote />
                    <AlertTitle>Paiements en attente</AlertTitle>
                    <AlertDescription>
                      {alerte.count} paiement
                      {alerte.count !== 1 ? "s" : ""} EN_ATTENTE (
                      {formatMontantFc(alerte.montantTotal)}).
                    </AlertDescription>
                  </Alert>
                );
              })}
            </div>
          </section>
        ) : null}

        <section className="flex flex-col gap-3">
          <h2 className="text-base font-semibold">Prochains départs</h2>
          {prochainsDeparts.length === 0 ? (
            <EmptyState
              icon={Bus}
              title="Aucun départ à venir"
              description="Les départs planifiés de l’agence apparaîtront ici avec leur jauge de remplissage."
            />
          ) : (
            <div className="flex flex-col gap-3">
              {prochainsDeparts.map((depart) => (
                <Card key={depart.id} size="sm">
                  <CardHeader className="border-b">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex flex-col gap-1">
                        <CardTitle>
                          {depart.villeDepart} → {depart.villeArrivee}
                        </CardTitle>
                        <CardDescription>
                          {formatDateFr(depart.dateDepart)} · {depart.heureDepart}
                        </CardDescription>
                      </div>
                      <Badge variant="secondary">
                        {MODE_TRANSPORT_LABELS[depart.modeTransport]}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <Progress value={depart.remplissagePct} className="w-full">
                      <ProgressLabel>Remplissage</ProgressLabel>
                      <span className="ml-auto text-sm text-muted-foreground tabular-nums">
                        {depart.placesOccupees}/{depart.capacitePlaces} (
                        {depart.remplissagePct} %) · {depart.placesRestantes}{" "}
                        restante{depart.placesRestantes !== 1 ? "s" : ""}
                      </span>
                    </Progress>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
