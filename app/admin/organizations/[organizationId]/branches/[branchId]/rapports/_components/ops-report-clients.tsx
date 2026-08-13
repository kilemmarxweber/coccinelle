"use client";

import {
  ChartCard,
  KpiGrid,
  ReportShell,
} from "@/components/reports/report-shell";
import {
  DualBarChart,
  SimpleBarChart,
  TrendAreaChart,
} from "@/components/reports/report-charts";
import {
  formatAlreadyPrimaryAmount,
  formatConfiguredRateLabel,
} from "@/lib/cash/exchange";

type MyOrdersData = Awaited<
  ReturnType<typeof import("@/lib/hotel/reports/actions").getMyOrdersReportAction>
>;

type StaysData = Awaited<
  ReturnType<typeof import("@/lib/hotel/reports/actions").getStaysReportAction>
>;

export function MyOrdersReportClient(props: {
  organizationId: string;
  branchId: string;
  branchName: string;
  from: string;
  to: string;
  data: MyOrdersData;
}) {
  const base = `/admin/organizations/${props.organizationId}/branches/${props.branchId}/rapports/mes-commandes`;
  const money = (n: number) =>
    formatAlreadyPrimaryAmount(n, props.data.rate);
  const rates = props.data.rate
    ? formatConfiguredRateLabel(props.data.rate)
    : null;

  return (
    <ReportShell
      title="Mes commandes"
      subtitle={`${props.branchName} · activité serveur F&B`}
      organizationId={props.organizationId}
      branchId={props.branchId}
      from={props.from}
      to={props.to}
      basePath={base}
      rateBanner={rates}
    >
      <KpiGrid
        items={[
          {
            label: "Ventes du jour",
            value: money(props.data.kpis.caToday),
          },
          {
            label: "Tickets jour",
            value: String(props.data.kpis.ordersToday),
          },
          {
            label: "Ventes du mois",
            value: money(props.data.kpis.caMonth),
          },
          {
            label: "Tickets mois",
            value: String(props.data.kpis.ordersMonth),
          },
          {
            label: "Commandes (période)",
            value: String(props.data.kpis.orders),
            delta: props.data.kpis.ordersDelta,
          },
          {
            label: "CA période",
            value: money(props.data.kpis.ca),
          },
          {
            label: "Ticket moyen",
            value: money(props.data.kpis.ticketAvg),
          },
          {
            label: "Annulées",
            value: String(props.data.kpis.cancelled),
          },
        ]}
      />
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <ChartCard title="CA par jour">
          <TrendAreaChart
            data={props.data.caByDay}
            color="#7c3aed"
            valueLabel="CA"
          />
        </ChartCard>
        <ChartCard title="Top produits">
          <SimpleBarChart data={props.data.topProducts} color="#0d9488" />
        </ChartCard>
        <ChartCard title="Répartition statuts">
          <SimpleBarChart data={props.data.byStatus} color="#b45309" />
        </ChartCard>
      </div>
    </ReportShell>
  );
}

export function StaysReportClient(props: {
  organizationId: string;
  branchId: string;
  branchName: string;
  from: string;
  to: string;
  data: StaysData;
}) {
  const base = `/admin/organizations/${props.organizationId}/branches/${props.branchId}/rapports/sejours`;

  return (
    <ReportShell
      title="Rapport séjours"
      subtitle={`${props.branchName} · check-in / out & disponibilités`}
      organizationId={props.organizationId}
      branchId={props.branchId}
      from={props.from}
      to={props.to}
      basePath={base}
    >
      <KpiGrid
        items={[
          {
            label: "Arrivées prévues",
            value: String(props.data.kpis.arrivals),
          },
          {
            label: "Check-in réalisés",
            value: String(props.data.kpis.checkIns),
          },
          {
            label: "Départs prévus",
            value: String(props.data.kpis.departures),
          },
          {
            label: "Check-out réalisés",
            value: String(props.data.kpis.checkOuts),
          },
          {
            label: "En maison",
            value: String(props.data.kpis.inHouse),
          },
          {
            label: "Chambres libres",
            value: `${props.data.kpis.available} / ${props.data.kpis.rooms}`,
          },
          {
            label: "Occupation",
            value: `${props.data.kpis.occupancyPct} %`,
          },
        ]}
      />
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <ChartCard title="Arrivées vs départs">
          <DualBarChart
            data={props.data.flowByDay}
            entreesLabel="Arrivées"
            sortiesLabel="Départs"
          />
        </ChartCard>
        <ChartCard title="Statuts (période)">
          <SimpleBarChart data={props.data.byStatus} color="#059669" />
        </ChartCard>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border p-4">
          <h3 className="mb-2 text-sm font-semibold">Arrivées</h3>
          <ul className="space-y-1 text-sm">
            {props.data.arrivals.map((s) => (
              <li
                key={s.id}
                className="flex justify-between gap-2 border-b border-border/50 py-1.5"
              >
                <span>
                  {s.guestName} · ch. {s.room}
                </span>
                <span className="text-muted-foreground">{s.status}</span>
              </li>
            ))}
            {props.data.arrivals.length === 0 ? (
              <li className="text-muted-foreground">Aucune arrivée</li>
            ) : null}
          </ul>
        </div>
        <div className="rounded-xl border border-border p-4">
          <h3 className="mb-2 text-sm font-semibold">Départs</h3>
          <ul className="space-y-1 text-sm">
            {props.data.departures.map((s) => (
              <li
                key={s.id}
                className="flex justify-between gap-2 border-b border-border/50 py-1.5"
              >
                <span>
                  {s.guestName} · ch. {s.room}
                </span>
                <span className="text-muted-foreground">{s.status}</span>
              </li>
            ))}
            {props.data.departures.length === 0 ? (
              <li className="text-muted-foreground">Aucun départ</li>
            ) : null}
          </ul>
        </div>
      </div>
    </ReportShell>
  );
}
