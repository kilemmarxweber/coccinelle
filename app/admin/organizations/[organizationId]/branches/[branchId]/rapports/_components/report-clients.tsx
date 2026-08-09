"use client";

import {
  ChartCard,
  KpiGrid,
  ReportShell,
  ReportsNav,
  formatMoney,
  formatQty,
} from "@/components/reports/report-shell";
import {
  DonutChart,
  DualBarChart,
  FinanceComboChart,
  SimpleBarChart,
  TrendAreaChart,
} from "@/components/reports/report-charts";
import { openBlankPrintWindow } from "@/lib/hotel/stock-movements-print";

function printSimpleReport(title: string, htmlBody: string) {
  const win = openBlankPrintWindow();
  if (!win) return;
  win.document.open();
  win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${title}</title>
  <style>body{font-family:sans-serif;padding:24px;color:#111}h1{font-size:18px}table{width:100%;border-collapse:collapse;margin-top:16px}th,td{border-bottom:1px solid #e5e5e5;padding:8px;text-align:left}th{font-size:11px;text-transform:uppercase;color:#737373}.num{text-align:right}</style>
  </head><body>${htmlBody}</body></html>`);
  win.document.close();
  setTimeout(() => {
    try {
      win.focus();
      win.print();
    } catch {
      /* ignore */
    }
  }, 250);
}

type SalesData = Awaited<
  ReturnType<typeof import("@/lib/hotel/reports/actions").getSalesReportAction>
>;

export function SalesReportClient(props: {
  organizationId: string;
  branchId: string;
  branchName: string;
  from: string;
  to: string;
  data: SalesData;
}) {
  const base = `/admin/organizations/${props.organizationId}/branches/${props.branchId}/rapports/ventes`;
  const { kpis, caByDay, caByMethod, lines, linesTotal } = props.data;

  function formatDayFr(iso: string) {
    const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
    const date = new Date(y!, (m ?? 1) - 1, d ?? 1);
    return date.toLocaleDateString("fr-FR", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  function participantsLabel(
    people: { role: string; name: string }[],
  ) {
    if (people.length === 0) return "—";
    return people.map((p) => `${p.role} : ${p.name}`).join(" · ");
  }

  return (
    <ReportShell
      title="Rapport Ventes"
      subtitle={`${props.branchName} · CA encaissé et détail des commandes`}
      organizationId={props.organizationId}
      branchId={props.branchId}
      from={props.from}
      to={props.to}
      basePath={base}
      onExportPdf={() =>
        printSimpleReport(
          "Rapport Ventes",
          `<h1>Rapport Ventes — ${props.branchName}</h1>
          <p>${props.from} → ${props.to}</p>
          <p>CA : ${formatMoney(kpis.ca)} · Tickets : ${kpis.tickets} · Qté : ${kpis.qtySold}</p>
          <table><thead><tr>
            <th>Jour</th><th>Commande</th><th>Articles</th><th>Participants</th><th class="num">Payé</th>
          </tr></thead><tbody>
          ${lines
            .map(
              (l) =>
                `<tr><td>${formatDayFr(l.day)}</td><td>${l.label}${l.receiptNumber ? ` · #${l.receiptNumber}` : ""}</td><td>${l.itemsLabel ?? "—"}</td><td>${participantsLabel(l.participants)}</td><td class="num">${l.usd.toFixed(2)}</td></tr>`,
            )
            .join("")}
          <tr><td colspan="4"><strong>Total</strong></td><td class="num"><strong>${linesTotal.toFixed(2)}</strong></td></tr>
          </tbody></table>`,
        )
      }
    >
      <ReportsNav
        organizationId={props.organizationId}
        branchId={props.branchId}
        active="ventes"
      />
      <KpiGrid
        items={[
          {
            label: "CA encaissé",
            value: formatMoney(kpis.ca),
            delta: kpis.caDelta,
          },
          {
            label: "Tickets / commandes",
            value: formatQty(kpis.tickets),
            delta: kpis.ticketsDelta,
          },
          {
            label: "Articles vendus",
            value: formatQty(kpis.qtySold),
            delta: kpis.qtyDelta,
          },
          {
            label: "Ticket moyen",
            value: formatMoney(kpis.avgTicket),
            hint: `${kpis.paymentsCount} paiement(s)`,
          },
        ]}
      />

      <div className="grid gap-4 lg:grid-cols-5">
        <ChartCard
          title="CA par jour"
          description="Évolution des encaissements"
          className="lg:col-span-3"
        >
          <TrendAreaChart data={caByDay} valueLabel="CA $" />
        </ChartCard>
        <ChartCard
          title="Par méthode"
          description="Répartition des paiements"
          className="lg:col-span-2"
        >
          <DonutChart data={caByMethod} />
        </ChartCard>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold">Détail des ventes</h2>
          <p className="text-xs text-muted-foreground">
            Jour, montant payé et participants par commande
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs tracking-wide text-muted-foreground uppercase">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Jour</th>
                <th className="px-4 py-3 text-left font-medium">Commande</th>
                <th className="px-4 py-3 text-left font-medium">Articles</th>
                <th className="px-4 py-3 text-left font-medium">
                  Participants
                </th>
                <th className="px-4 py-3 text-right font-medium">Payé</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {lines.map((l) => (
                <tr key={l.id}>
                  <td className="px-4 py-2.5 whitespace-nowrap text-muted-foreground">
                    {formatDayFr(l.day)}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="font-medium">{l.label}</div>
                    <div className="text-xs text-muted-foreground">
                      #{l.receiptNumber}
                      {l.method ? ` · ${l.method}` : ""}
                    </div>
                  </td>
                  <td className="max-w-[16rem] px-4 py-2.5 text-muted-foreground">
                    {l.itemsLabel ?? "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    {l.participants.length === 0 ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <ul className="space-y-0.5">
                        {l.participants.map((p) => (
                          <li key={`${l.id}-${p.role}`} className="text-xs">
                            <span className="text-muted-foreground">
                              {p.role} :
                            </span>{" "}
                            <span className="font-medium">{p.name}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-medium">
                    {formatMoney(l.usd)}
                  </td>
                </tr>
              ))}
              {lines.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
                    Aucune vente encaissée sur la période.
                  </td>
                </tr>
              ) : (
                <tr className="bg-muted/30">
                  <td
                    colSpan={4}
                    className="px-4 py-3 text-right text-sm font-semibold"
                  >
                    Total
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-sm font-semibold">
                    {formatMoney(linesTotal)}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </ReportShell>
  );
}

type PurchasesData = Awaited<
  ReturnType<
    typeof import("@/lib/hotel/reports/actions").getPurchasesReportAction
  >
>;

export function PurchasesReportClient(props: {
  organizationId: string;
  branchId: string;
  branchName: string;
  from: string;
  to: string;
  data: PurchasesData;
}) {
  const base = `/admin/organizations/${props.organizationId}/branches/${props.branchId}/rapports/achats`;
  const { kpis, flowByDay, byProduct } = props.data;

  return (
    <ReportShell
      title="Rapport Achats"
      subtitle={`${props.branchName} · Approvisionnements (entrées) vs consommations (sorties)`}
      organizationId={props.organizationId}
      branchId={props.branchId}
      from={props.from}
      to={props.to}
      basePath={base}
      onExportPdf={() =>
        printSimpleReport(
          "Rapport Achats",
          `<h1>Rapport Achats — ${props.branchName}</h1>
          <p>${props.from} → ${props.to}</p>
          <p>Entrées : ${kpis.qtyIn} · Sorties : ${kpis.qtyOut} · Net : ${kpis.net}</p>
          <table><thead><tr><th>Produit</th><th class="num">Entrées</th><th class="num">Sorties</th></tr></thead><tbody>
          ${byProduct.map((p) => `<tr><td>${p.name}</td><td class="num">${p.inQty}</td><td class="num">${p.outQty}</td></tr>`).join("")}
          </tbody></table>`,
        )
      }
    >
      <ReportsNav
        organizationId={props.organizationId}
        branchId={props.branchId}
        active="achats"
      />
      <KpiGrid
        items={[
          {
            label: "Entrées stock",
            value: formatQty(kpis.qtyIn),
            delta: kpis.qtyInDelta,
            hint: `${kpis.linesIn} livraison(s)`,
          },
          {
            label: "Sorties / décomptes",
            value: formatQty(kpis.qtyOut),
            delta: kpis.qtyOutDelta,
            hint: `${kpis.linesOut} mouvement(s)`,
          },
          {
            label: "Solde flux",
            value: formatQty(kpis.net),
            delta: kpis.netDelta,
            hint: "Entrées − sorties",
          },
          {
            label: "Couverture",
            value:
              kpis.qtyOut > 0
                ? `${Math.round((kpis.qtyIn / kpis.qtyOut) * 100)} %`
                : "—",
            hint: "Entrées / sorties",
          },
        ]}
      />
      <div className="grid gap-4 lg:grid-cols-5">
        <ChartCard
          title="Entrées vs sorties"
          description="Comparaison quotidienne des flux stock"
          className="lg:col-span-3"
        >
          <DualBarChart data={flowByDay} />
        </ChartCard>
        <ChartCard
          title="Top produits"
          description="Volume d’entrées"
          className="lg:col-span-2"
        >
          <SimpleBarChart
            data={byProduct.slice(0, 8).map((p) => ({
              name: p.name.slice(0, 14),
              value: p.inQty,
            }))}
            color="#10b981"
          />
        </ChartCard>
      </div>
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs tracking-wide text-muted-foreground uppercase">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Produit</th>
              <th className="px-4 py-3 text-right font-medium">Entrées</th>
              <th className="px-4 py-3 text-right font-medium">Sorties</th>
              <th className="px-4 py-3 text-left font-medium">Type</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {byProduct.map((p) => (
              <tr key={p.name}>
                <td className="px-4 py-2.5 font-medium">{p.name}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-emerald-600">
                  +{p.inQty}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-rose-600">
                  −{p.outQty}
                </td>
                <td className="px-4 py-2.5 text-muted-foreground">
                  {p.consumable ? "Consommable" : "Vente"}
                </td>
              </tr>
            ))}
            {byProduct.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  Aucun mouvement sur la période.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </ReportShell>
  );
}

type ArticlesData = Awaited<
  ReturnType<
    typeof import("@/lib/hotel/reports/actions").getArticlesReportAction
  >
>;

export function ArticlesReportClient(props: {
  organizationId: string;
  branchId: string;
  branchName: string;
  from: string;
  to: string;
  data: ArticlesData;
}) {
  const base = `/admin/organizations/${props.organizationId}/branches/${props.branchId}/rapports/articles`;
  const { kpis, topArticles, byCategory, soldByDay } = props.data;

  return (
    <ReportShell
      title="Rapport Articles"
      subtitle={`${props.branchName} · Quantités vendues, CA article et sorties stock`}
      organizationId={props.organizationId}
      branchId={props.branchId}
      from={props.from}
      to={props.to}
      basePath={base}
      onExportPdf={() =>
        printSimpleReport(
          "Rapport Articles",
          `<h1>Rapport Articles — ${props.branchName}</h1>
          <p>${props.from} → ${props.to}</p>
          <table><thead><tr><th>Article</th><th class="num">Qté</th><th class="num">CA</th><th class="num">Sorties</th></tr></thead><tbody>
          ${topArticles.map((a) => `<tr><td>${a.name}</td><td class="num">${a.qty}</td><td class="num">${a.revenue.toFixed(2)}</td><td class="num">${a.stockOut}</td></tr>`).join("")}
          </tbody></table>`,
        )
      }
    >
      <ReportsNav
        organizationId={props.organizationId}
        branchId={props.branchId}
        active="articles"
      />
      <KpiGrid
        items={[
          {
            label: "Articles actifs",
            value: formatQty(kpis.articles),
          },
          {
            label: "Qté vendue",
            value: formatQty(kpis.qty),
            delta: kpis.qtyDelta,
          },
          {
            label: "CA articles",
            value: formatMoney(kpis.revenue),
          },
          {
            label: "Sorties stock",
            value: formatQty(kpis.stockOut),
            hint: "Dont consommables décomptés",
          },
        ]}
      />
      <div className="grid gap-4 lg:grid-cols-5">
        <ChartCard
          title="Ventes / jour"
          description="Volumes d’articles vendus"
          className="lg:col-span-3"
        >
          <TrendAreaChart
            data={soldByDay}
            color="#8b5cf6"
            valueLabel="Qté"
          />
        </ChartCard>
        <ChartCard
          title="Par catégorie"
          description="Mix des quantités"
          className="lg:col-span-2"
        >
          <DonutChart data={byCategory} />
        </ChartCard>
      </div>
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs tracking-wide text-muted-foreground uppercase">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Article</th>
              <th className="px-4 py-3 text-left font-medium">Catégorie</th>
              <th className="px-4 py-3 text-right font-medium">Vendus</th>
              <th className="px-4 py-3 text-right font-medium">Δ</th>
              <th className="px-4 py-3 text-right font-medium">CA</th>
              <th className="px-4 py-3 text-right font-medium">Sorties</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {topArticles.map((a) => (
              <tr key={a.id}>
                <td className="px-4 py-2.5 font-medium">{a.name}</td>
                <td className="px-4 py-2.5 text-muted-foreground">
                  {a.category}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">{a.qty}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                  {a.qtyDelta > 0 ? "+" : ""}
                  {a.qtyDelta}%
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {formatMoney(a.revenue)}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {a.stockOut}
                </td>
              </tr>
            ))}
            {topArticles.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  Aucune vente d’articles sur la période.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </ReportShell>
  );
}

type FinanceData = Awaited<
  ReturnType<
    typeof import("@/lib/hotel/reports/actions").getFinanceReportAction
  >
>;

export function FinanceReportClient(props: {
  organizationId: string;
  branchId: string;
  branchName: string;
  from: string;
  to: string;
  data: FinanceData;
}) {
  const base = `/admin/organizations/${props.organizationId}/branches/${props.branchId}/rapports/financier`;
  const { kpis, flowByDay, revenueByMethod, folioByKind, revenueByDay } =
    props.data;

  return (
    <ReportShell
      title="Rapport Financier"
      subtitle={`${props.branchName} · Revenus vs flux stock (entrées / sorties)`}
      organizationId={props.organizationId}
      branchId={props.branchId}
      from={props.from}
      to={props.to}
      basePath={base}
      onExportPdf={() =>
        printSimpleReport(
          "Rapport Financier",
          `<h1>Rapport Financier — ${props.branchName}</h1>
          <p>${props.from} → ${props.to}</p>
          <p>Revenus : ${formatMoney(kpis.revenue)} · Entrées : ${kpis.qtyIn} · Sorties : ${kpis.qtyOut}</p>`,
        )
      }
    >
      <ReportsNav
        organizationId={props.organizationId}
        branchId={props.branchId}
        active="financier"
      />
      <KpiGrid
        items={[
          {
            label: "Revenus",
            value: formatMoney(kpis.revenue),
            delta: kpis.revenueDelta,
          },
          {
            label: "Entrées stock",
            value: formatQty(kpis.qtyIn),
            delta: kpis.qtyInDelta,
          },
          {
            label: "Sorties stock",
            value: formatQty(kpis.qtyOut),
            delta: kpis.qtyOutDelta,
          },
          {
            label: "Rev. / sortie",
            value: formatMoney(kpis.coverage),
            hint: "Intensité revenu vs décompte",
          },
        ]}
      />
      <div className="grid gap-4 lg:grid-cols-5">
        <ChartCard
          title="Revenus & flux stock"
          description="Comparaison journalière revenus / entrées / sorties"
          className="lg:col-span-3"
        >
          <FinanceComboChart data={flowByDay} />
        </ChartCard>
        <ChartCard
          title="Paiements"
          description="Méthodes d’encaissement"
          className="lg:col-span-2"
        >
          <DonutChart data={revenueByMethod} />
        </ChartCard>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="CA quotidien" description="Courbe des encaissements">
          <TrendAreaChart data={revenueByDay} valueLabel="CA $" />
        </ChartCard>
        <ChartCard
          title="Mix folio"
          description="Répartition des lignes (nuit, F&B…)"
        >
          {folioByKind.length > 0 ? (
            <SimpleBarChart data={folioByKind} color="#f59e0b" />
          ) : (
            <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Aucune ligne de folio sur la période.
            </p>
          )}
        </ChartCard>
      </div>
    </ReportShell>
  );
}
