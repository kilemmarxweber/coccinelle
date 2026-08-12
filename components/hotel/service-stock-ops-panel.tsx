"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DoorClosed, ExternalLink, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DualBarChart,
  SimpleBarChart,
  TrendAreaChart,
} from "@/components/reports/report-charts";
import { formatPrimaryAmount } from "@/lib/cash/exchange";
import { hotelRoutes } from "@/lib/branch/paths";
import { closeServiceStockSessionAction } from "@/lib/hotel/service-stock";
import {
  buildServiceStockClosingHtml,
  summarizeRecover,
} from "@/lib/hotel/service-stock-print";

type MoneyRate = {
  rate: number;
  configuredFrom?: string;
} | null;

export type ServiceStockOpsLine = {
  id: string;
  menuItemId: string;
  qtyAttributed: number;
  qtyOpeningCounted: number | null;
  qtySold: number;
  qtyLoss: number;
  unitPriceUsd: number;
  sourceZone: string;
  menuItem: { id: string; name: string };
};

export type ServiceStockOpsSession = {
  id: string;
  number: string;
  vendorDisplayName: string;
  openedAt: string | Date;
  openingConfirmedAt: string | Date | null;
  lines: ServiceStockOpsLine[];
};

export type ServiceStockOpsHistoryRow = {
  id: string;
  number: string;
  status: string;
  vendorDisplayName: string;
  openedAt: string | Date;
  closedAt: string | Date | null;
  lines: {
    qtyAttributed: number;
    qtyOpeningCounted: number | null;
    qtySold: number;
    qtyLoss: number;
    unitPriceUsd: number;
  }[];
};

function remaining(line: {
  qtyAttributed: number;
  qtySold: number;
  qtyLoss: number;
}) {
  return Math.max(0, line.qtyAttributed - line.qtySold - line.qtyLoss);
}

function printHtml(html: string) {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText =
    "position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none";
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument ?? iframe.contentWindow?.document;
  if (!doc) {
    iframe.remove();
    toast.error("Impression impossible.");
    return;
  }
  doc.open();
  doc.write(html);
  doc.close();
  window.setTimeout(() => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } finally {
      window.setTimeout(() => iframe.remove(), 1000);
    }
  }, 200);
}

export function ServiceStockOpsPanel(props: {
  organizationId: string;
  branchId: string;
  branchName: string;
  currentUserName: string;
  rate: MoneyRate;
  ready: boolean;
  session: ServiceStockOpsSession | null;
  history?: ServiceStockOpsHistoryRow[];
  title?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [closeOpen, setCloseOpen] = useState(false);
  const [closingCounts, setClosingCounts] = useState<Record<string, string>>(
    {},
  );
  const [closingLoss, setClosingLoss] = useState<Record<string, string>>({});

  const money = (n: number) =>
    formatPrimaryAmount(
      n,
      props.rate
        ? {
            rate: props.rate.rate,
            configuredFrom: props.rate.configuredFrom ?? "USD",
          }
        : null,
    );
  const session = props.session;
  const history = props.history ?? [];
  const stockHref = hotelRoutes.serviceStock(
    props.organizationId,
    props.branchId,
  );

  const summary = useMemo(() => {
    if (!session) return summarizeRecover([]);
    return summarizeRecover(
      session.lines.map((l) => ({
        name: l.menuItem.name,
        sourceZone: l.sourceZone,
        qtyAttributed: l.qtyAttributed,
        qtyOpeningCounted: l.qtyOpeningCounted,
        qtySold: l.qtySold,
        qtyLoss: l.qtyLoss,
        unitPriceUsd: l.unitPriceUsd,
      })),
    );
  }, [session]);

  const sessionQtyChart = useMemo(() => {
    if (!session) return [];
    return session.lines.map((l) => ({
      day: l.menuItem.name.slice(0, 10),
      entrees: l.qtyAttributed,
      sorties: l.qtySold,
    }));
  }, [session]);

  const productSalesChart = useMemo(() => {
    if (!session) return [];
    return session.lines
      .filter((l) => l.qtySold > 0)
      .map((l) => ({
        name:
          l.menuItem.name.length > 14
            ? `${l.menuItem.name.slice(0, 12)}…`
            : l.menuItem.name,
        value: Math.round(l.qtySold * l.unitPriceUsd * 100) / 100,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [session]);

  const salesTrend = useMemo(() => {
    return [...history]
      .filter((h) => h.status === "CLOSED")
      .reverse()
      .slice(-14)
      .map((h) => {
        const ca = summarizeRecover(
          h.lines.map((l) => ({
            name: "",
            sourceZone: "",
            qtyAttributed: l.qtyAttributed,
            qtyOpeningCounted: l.qtyOpeningCounted,
            qtySold: l.qtySold,
            qtyLoss: l.qtyLoss,
            unitPriceUsd: l.unitPriceUsd,
          })),
        ).sold;
        const d =
          h.closedAt instanceof Date
            ? h.closedAt
            : new Date(h.closedAt ?? h.openedAt);
        return {
          day: d.toISOString().slice(0, 10),
          value: Math.round(ca * 100) / 100,
        };
      });
  }, [history]);

  const vendorRateChart = useMemo(() => {
    const map = new Map<string, { toRecover: number; sold: number }>();
    for (const h of history) {
      const key = h.vendorDisplayName || "Entrant";
      const cur = map.get(key) ?? { toRecover: 0, sold: 0 };
      const s = summarizeRecover(
        h.lines.map((l) => ({
          name: "",
          sourceZone: "",
          qtyAttributed: l.qtyAttributed,
          qtyOpeningCounted: l.qtyOpeningCounted,
          qtySold: l.qtySold,
          qtyLoss: l.qtyLoss,
          unitPriceUsd: l.unitPriceUsd,
        })),
      );
      cur.toRecover += s.toRecover;
      cur.sold += s.sold;
      map.set(key, cur);
    }
    return [...map.entries()]
      .map(([name, v]) => ({
        name: name.length > 14 ? `${name.slice(0, 12)}…` : name,
        value:
          v.toRecover > 0.0001
            ? Math.round((v.sold / v.toRecover) * 1000) / 10
            : 0,
      }))
      .sort((a, b) => b.value - a.value);
  }, [history]);

  function doClose() {
    if (!session) return;
    const counts = session.lines.map((l) => ({
      lineId: l.id,
      qtyClosingCounted: Math.round(
        Number(closingCounts[l.id] ?? remaining(l)) || 0,
      ),
      qtyLoss: Math.round(Number(closingLoss[l.id]) || 0),
    }));
    const countById = new Map(counts.map((c) => [c.lineId, c]));
    const linesForDoc = session.lines.map((l) => {
      const c = countById.get(l.id)!;
      const theo = remaining({
        qtyAttributed: l.qtyAttributed,
        qtySold: l.qtySold,
        qtyLoss: c.qtyLoss,
      });
      return {
        name: l.menuItem.name,
        sourceZone: l.sourceZone,
        qtyAttributed: l.qtyAttributed,
        qtyOpeningCounted: l.qtyOpeningCounted,
        qtySold: l.qtySold,
        qtyClosingCounted: c.qtyClosingCounted,
        qtyReturnedToDepot: Math.min(c.qtyClosingCounted, theo),
        qtyLoss: c.qtyLoss,
        unitPriceUsd: l.unitPriceUsd,
      };
    });
    start(async () => {
      try {
        await closeServiceStockSessionAction({
          organizationId: props.organizationId,
          branchId: props.branchId,
          sessionId: session.id,
          counts,
        });
        toast.success("Service restaurant clôturé");
        setCloseOpen(false);
        printHtml(
          buildServiceStockClosingHtml({
            branchName: props.branchName,
            number: session.number,
            vendorDisplayName: session.vendorDisplayName,
            managerName: props.currentUserName,
            openedAt: session.openedAt,
            closedAt: new Date(),
            lines: linesForDoc,
            formatMoney: money,
          }),
        );
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erreur");
      }
    });
  }

  if (!props.ready || !session) {
    return (
      <section className="mt-8 rounded-xl border border-dashed border-border px-4 py-5">
        <h2 className="text-sm font-semibold">
          {props.title ?? "Service stock & fermeture"}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Aucune session ouverte. Ouvrez le service stock pour vendre hors
          cuisine, suivre le montant à recouvrir et clôturer avec rapport.
        </p>
        <Button
          className="mt-3"
          variant="outline"
          size="sm"
          render={<Link href={stockHref} />}
        >
          Ouvrir le service stock
          <ExternalLink className="ml-1.5 size-3.5" />
        </Button>
      </section>
    );
  }

  return (
    <section className="mt-8 space-y-4 border-t border-border pt-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">
            {props.title ?? "Situation service stock"}
          </h2>
          <p className="text-xs text-muted-foreground">
            {session.number} · entrant {session.vendorDisplayName} · à
            recouvrir / ventes / clôture
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            render={<Link href={stockHref} />}
          >
            Détail service stock
            <ExternalLink className="ml-1.5 size-3.5" />
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => setCloseOpen(true)}
          >
            <DoorClosed className="mr-1.5 size-3.5" />
            Fermer le service
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-card px-4 py-3">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
            À recouvrir
          </p>
          <p className="mt-1 text-lg font-semibold tabular-nums">
            {money(summary.toRecover)}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card px-4 py-3">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Recouvré (vendu)
          </p>
          <p className="mt-1 text-lg font-semibold tabular-nums">
            {money(summary.sold)}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card px-4 py-3">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Restant (valeur)
          </p>
          <p className="mt-1 text-lg font-semibold tabular-nums">
            {money(summary.remainingValue)}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card px-4 py-3">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Taux de recouvrement
          </p>
          <p className="mt-1 text-lg font-semibold tabular-nums">
            {summary.recoverRate.toLocaleString("fr-FR")} %
          </p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th className="px-3 py-2">Produit</th>
              <th className="px-3 py-2 text-right">À recouvrir</th>
              <th className="px-3 py-2 text-right">Vendu</th>
              <th className="px-3 py-2 text-right">Recouvré</th>
              <th className="px-3 py-2 text-right">Restant</th>
            </tr>
          </thead>
          <tbody>
            {session.lines.map((l) => {
              const qty =
                l.qtyOpeningCounted != null
                  ? l.qtyOpeningCounted
                  : l.qtyAttributed;
              return (
                <tr key={l.id} className="border-t border-border/70">
                  <td className="px-3 py-2">{l.menuItem.name}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {money(qty * l.unitPriceUsd)}
                  </td>
                  <td className="px-3 py-2 text-right">{l.qtySold}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {money(l.qtySold * l.unitPriceUsd)}
                  </td>
                  <td className="px-3 py-2 text-right font-medium">
                    {remaining(l)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {sessionQtyChart.length > 0 ? (
          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="text-sm font-medium">Attribué vs vendu</h3>
            <div className="mt-2 h-[200px]">
              <DualBarChart
                data={sessionQtyChart}
                entreesLabel="Attribué"
                sortiesLabel="Vendu"
              />
            </div>
          </div>
        ) : null}
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="text-sm font-medium">CA par produit</h3>
          <div className="mt-2 h-[200px]">
            {productSalesChart.length > 0 ? (
              <SimpleBarChart data={productSalesChart} color="#0d9488" />
            ) : (
              <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Pas encore de vente
              </p>
            )}
          </div>
        </div>
        {salesTrend.length > 0 ? (
          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="text-sm font-medium">CA sessions clôturées</h3>
            <div className="mt-2 h-[200px]">
              <TrendAreaChart
                data={salesTrend}
                color="#0d9488"
                valueLabel="CA"
              />
            </div>
          </div>
        ) : null}
        {vendorRateChart.length > 0 ? (
          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="text-sm font-medium">
              Efficacité vendeurs (taux %)
            </h3>
            <div className="mt-2 h-[200px]">
              <SimpleBarChart data={vendorRateChart} color="#b45309" />
            </div>
          </div>
        ) : null}
      </div>

      <Dialog open={closeOpen} onOpenChange={setCloseOpen}>
        <DialogContent className="max-h-[94svh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Fermer le service restaurant</DialogTitle>
            <DialogDescription>
              Comptez le restant float. Le rapport de fermeture (à recouvrir /
              recouvré / taux) s’imprime pour signature entrant + manager.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm sm:grid-cols-3">
              <div>
                <p className="text-[11px] text-muted-foreground">À recouvrir</p>
                <p className="font-semibold tabular-nums">
                  {money(summary.toRecover)}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">Recouvré</p>
                <p className="font-semibold tabular-nums">
                  {money(summary.sold)}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">Taux</p>
                <p className="font-semibold tabular-nums">
                  {summary.recoverRate.toLocaleString("fr-FR")} %
                </p>
              </div>
            </div>
            {session.lines.map((l) => (
              <div
                key={l.id}
                className="grid gap-2 rounded-lg border border-border/70 p-2 sm:grid-cols-[1.2fr_0.6fr_0.5fr]"
              >
                <div>
                  <p className="text-sm font-medium">{l.menuItem.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    Théorique restant : {remaining(l)} · vendu {l.qtySold}
                  </p>
                </div>
                <div className="grid gap-1">
                  <Label className="text-xs">Compté</Label>
                  <Input
                    type="number"
                    min={0}
                    value={closingCounts[l.id] ?? String(remaining(l))}
                    onChange={(e) =>
                      setClosingCounts((m) => ({
                        ...m,
                        [l.id]: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="grid gap-1">
                  <Label className="text-xs">Pertes</Label>
                  <Input
                    type="number"
                    min={0}
                    value={closingLoss[l.id] ?? "0"}
                    onChange={(e) =>
                      setClosingLoss((m) => ({
                        ...m,
                        [l.id]: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>
            ))}
            <Button disabled={pending} onClick={doClose} className="w-full">
              <Printer className="mr-1.5 size-4" />
              Clôturer · imprimer rapport de fermeture
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
