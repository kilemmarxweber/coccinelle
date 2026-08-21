"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DoorClosed, ExternalLink, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
} from "@/components/reports/report-charts";
import { formatPrimaryAmount, formatUsdLineTotal, formatUsdLinesTotal, usdLinePrimaryNumber } from "@/lib/cash/exchange";
import { hotelRoutes } from "@/lib/branch/paths";
import {
  closeServiceStockSessionAction,
  type LiveShiftSituation,
} from "@/lib/hotel/service-stock";
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

export function LiveShiftSituationCharts(props: {
  situation: LiveShiftSituation;
  rate: MoneyRate;
}) {
  const sit = props.situation;
  const rate = props.rate
    ? {
        rate: props.rate.rate,
        configuredFrom: props.rate.configuredFrom ?? "USD",
      }
    : null;
  const money = (n: number) => formatPrimaryAmount(n, rate);

  const productQty = sit.products.map((p) => ({
    day: p.name.slice(0, 10),
    entrees: p.attributed,
    sorties: p.sold,
  }));
  const productCa = sit.products
    .filter((p) => p.sold > 0)
    .map((p) => ({
      name: p.name.length > 14 ? `${p.name.slice(0, 12)}…` : p.name,
      value: usdLinePrimaryNumber(1, p.amountUsd, rate),
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);
  const waiterCa = sit.waiters.map((w) => ({
    name: w.name.length > 14 ? `${w.name.slice(0, 12)}…` : w.name,
    value: usdLinePrimaryNumber(1, w.amountUsd, rate),
  }));

  if (!sit.cashOpen) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
        Caisse clôturée — situation réinitialisée. Le prochain caissier et les
        serveurs qui se connecteront verront leur propre situation.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Caissier {sit.cashierName ?? "—"} · serveurs connectés sur cette
        ouverture
      </p>
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="text-sm font-semibold">Situation de vente (session)</h3>
          <p className="mb-3 text-xs text-muted-foreground">
            Attribué vs vendu par les serveurs de cette caisse
          </p>
          <div className="h-[220px]">
            {productQty.length > 0 ? (
              <DualBarChart
                data={productQty}
                entreesLabel="Attribué"
                sortiesLabel="Vendu"
                categoryLabels
              />
            ) : (
              <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Aucun produit sur le float
              </p>
            )}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="text-sm font-semibold">CA par produit</h3>
          <p className="mb-3 text-xs text-muted-foreground">
            Recouvré par les serveurs connectés (cette caisse)
          </p>
          <div className="h-[220px]">
            {productCa.length > 0 ? (
              <SimpleBarChart data={productCa} color="#0d9488" />
            ) : (
              <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Pas encore de vente
              </p>
            )}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 lg:col-span-2">
          <h3 className="text-sm font-semibold">Serveurs connectés</h3>
          <p className="mb-3 text-xs text-muted-foreground">
            CA de cette caisse · disparaît à la clôture
          </p>
          <div className="h-[220px]">
            {waiterCa.length > 0 ? (
              <SimpleBarChart data={waiterCa} color="#0369a1" />
            ) : (
              <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Aucun serveur connecté sur cette caisse
              </p>
            )}
          </div>
          {sit.waiters.length > 0 ? (
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {sit.waiters.map((w) => (
                <li
                  key={w.userId}
                  className="flex items-center justify-between rounded-lg border border-border/70 px-3 py-2 text-xs"
                >
                  <span className="font-medium">
                    {w.name}
                    <span
                      className={
                        w.connected
                          ? "ml-1.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300"
                          : "ml-1.5 text-[10px] font-semibold text-muted-foreground"
                      }
                    >
                      {w.connected ? "OPEN" : "CLOSE"}
                    </span>
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    {money(w.amountUsd)} · {w.qtySold} pcs
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </div>
  );
}

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
  foreignSession?: ServiceStockOpsSession | null;
  liveSituation?: LiveShiftSituation | null;
  title?: string;
  serviceStockHref?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [closeOpen, setCloseOpen] = useState(false);
  const [closeDisposition, setCloseDisposition] = useState<
    "HANDOVER" | "RETURN_DEPOT"
  >("HANDOVER");
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
  const moneyLine = (qty: number, unitUsd: number) =>
    formatUsdLineTotal(
      qty,
      unitUsd,
      props.rate
        ? {
            rate: props.rate.rate,
            configuredFrom: props.rate.configuredFrom ?? "USD",
          }
        : null,
    );
  const moneyLines = (
    lines: { quantity: number; unitPriceUsd: number }[],
  ) =>
    formatUsdLinesTotal(
      lines,
      props.rate
        ? {
            rate: props.rate.rate,
            configuredFrom: props.rate.configuredFrom ?? "USD",
          }
        : null,
    );
  const session = props.session;
  const foreignSession = props.foreignSession ?? null;
  const closeTarget = session ?? foreignSession;
  const stockHref =
    props.serviceStockHref ??
    hotelRoutes.serviceStock(props.organizationId, props.branchId);
  const openMineHref = `${stockHref}?ouvrir=1`;

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

  const recoverLabel = session
    ? moneyLines(
        session.lines.map((l) => ({
          quantity:
            l.qtyOpeningCounted != null ? l.qtyOpeningCounted : l.qtyAttributed,
          unitPriceUsd: l.unitPriceUsd,
        })),
      )
    : money(0);
  const soldLabel = session
    ? moneyLines(
        session.lines.map((l) => ({
          quantity: l.qtySold,
          unitPriceUsd: l.unitPriceUsd,
        })),
      )
    : money(0);
  const remainingLabel = session
    ? moneyLines(
        session.lines.map((l) => ({
          quantity: remaining(l),
          unitPriceUsd: l.unitPriceUsd,
        })),
      )
    : money(0);

  function doClose() {
    if (!closeTarget) return;
    const counts = closeTarget.lines.map((l) => ({
      lineId: l.id,
      qtyClosingCounted: Math.round(
        Number(closingCounts[l.id] ?? remaining(l)) || 0,
      ),
      qtyLoss: Math.round(Number(closingLoss[l.id]) || 0),
    }));
    const countById = new Map(counts.map((c) => [c.lineId, c]));
    const linesForDoc = closeTarget.lines.map((l) => {
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
        qtyReturnedToDepot:
          closeDisposition === "RETURN_DEPOT"
            ? Math.min(c.qtyClosingCounted, theo)
            : 0,
        qtyLoss: c.qtyLoss,
        unitPriceUsd: l.unitPriceUsd,
      };
    });
    start(async () => {
      try {
        await closeServiceStockSessionAction({
          organizationId: props.organizationId,
          branchId: props.branchId,
          sessionId: closeTarget.id,
          disposition: closeDisposition,
          counts,
        });
        toast.success(
          closeDisposition === "HANDOVER"
            ? "Service clôturé — restant transmis au prochain entrant"
            : "Service clôturé — restant retourné au dépôt",
        );
        setCloseOpen(false);
        printHtml(
          buildServiceStockClosingHtml({
            branchName: props.branchName,
            number: closeTarget.number,
            vendorDisplayName: closeTarget.vendorDisplayName,
            managerName: props.currentUserName,
            openedAt: closeTarget.openedAt,
            closedAt: new Date(),
            lines: linesForDoc,
            formatMoney: money,
            formatLineTotal: moneyLine,
            disposition: closeDisposition,
          }),
        );
        if (foreignSession && !session) {
          router.push(openMineHref);
        } else {
          router.refresh();
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erreur");
      }
    });
  }

  if (!session && foreignSession) {
    return (
      <section className="mt-8 space-y-3 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-5">
        <h2 className="text-sm font-semibold">
          {props.title ?? "Service stock"}
        </h2>
        <p className="text-sm">
          Session <strong>{foreignSession.number}</strong> encore ouverte par{" "}
          <strong>{foreignSession.vendorDisplayName}</strong>. Vous pouvez la
          clôturer (rapport de fermeture), puis ouvrir la vôtre — CA / float à
          zéro.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="destructive"
            onClick={() => setCloseOpen(true)}
          >
            <DoorClosed className="mr-1.5 size-3.5" />
            Fermer le service de {foreignSession.vendorDisplayName}
          </Button>
          <Button
            size="sm"
            variant="outline"
            render={<Link href={stockHref} />}
          >
            Détail service stock
            <ExternalLink className="ml-1.5 size-3.5" />
          </Button>
        </div>
        <Dialog open={closeOpen} onOpenChange={setCloseOpen}>
          <DialogContent className="max-h-[94svh] overflow-y-auto sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                Clôturer · {foreignSession.vendorDisplayName}
              </DialogTitle>
              <DialogDescription>
                Comptez le restant. Le rapport de fermeture s’imprime, puis vous
                pourrez ouvrir votre service.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-2 rounded-xl border border-border p-3">
                <Label>Disposition du restant</Label>
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="radio"
                    className="mt-1"
                    name="ops-close-disposition-foreign"
                    checked={closeDisposition === "HANDOVER"}
                    onChange={() => setCloseDisposition("HANDOVER")}
                  />
                  <span>
                    <strong>Transmettre au prochain entrant</strong>
                    <span className="block text-xs text-muted-foreground">
                      Vous pourrez hériter du restant à l’ouverture.
                    </span>
                  </span>
                </label>
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="radio"
                    className="mt-1"
                    name="ops-close-disposition-foreign"
                    checked={closeDisposition === "RETURN_DEPOT"}
                    onChange={() => setCloseDisposition("RETURN_DEPOT")}
                  />
                  <span>
                    <strong>Retourner au dépôt</strong>
                  </span>
                </label>
              </div>
              {foreignSession.lines.map((l) => (
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
                Clôturer · imprimer · ouvrir le mien
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </section>
    );
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
            {session.number}{" "}
            <Badge
              variant={
                props.liveSituation?.waitersConnected ? "default" : "secondary"
              }
              className="ml-1 align-middle"
            >
              {props.liveSituation?.waitersConnected ? "OPEN" : "CLOSE"}
            </Badge>{" "}
            · entrant {session.vendorDisplayName} · à recouvrir / ventes /
            clôture
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
            {recoverLabel}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card px-4 py-3">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Recouvré (vendu)
          </p>
          <p className="mt-1 text-lg font-semibold tabular-nums">
            {soldLabel}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card px-4 py-3">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Restant (valeur)
          </p>
          <p className="mt-1 text-lg font-semibold tabular-nums">
            {remainingLabel}
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
                    {moneyLine(qty, l.unitPriceUsd)}
                  </td>
                  <td className="px-3 py-2 text-right">{l.qtySold}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {moneyLine(l.qtySold, l.unitPriceUsd)}
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

      {props.liveSituation ? (
        <LiveShiftSituationCharts
          situation={props.liveSituation}
          rate={props.rate}
        />
      ) : null}

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
            <div className="space-y-2 rounded-xl border border-border p-3">
              <Label>Disposition du restant</Label>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="radio"
                  className="mt-1"
                  name="ops-close-disposition"
                  checked={closeDisposition === "HANDOVER"}
                  onChange={() => setCloseDisposition("HANDOVER")}
                />
                <span>
                  <strong>Transmettre au prochain entrant</strong>
                  <span className="block text-xs text-muted-foreground">
                    À la prochaine ouverture, l’entrant hérite du restant et
                    peut continuer ou demander un réassort.
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="radio"
                  className="mt-1"
                  name="ops-close-disposition"
                  checked={closeDisposition === "RETURN_DEPOT"}
                  onChange={() => setCloseDisposition("RETURN_DEPOT")}
                />
                <span>
                  <strong>Retourner au dépôt</strong>
                  <span className="block text-xs text-muted-foreground">
                    Remise magasin / congélateur.
                  </span>
                </span>
              </label>
            </div>
            <div className="grid gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm sm:grid-cols-3">
              <div>
                <p className="text-[11px] text-muted-foreground">À recouvrir</p>
                <p className="font-semibold tabular-nums">
                  {recoverLabel}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">Recouvré</p>
                <p className="font-semibold tabular-nums">
                  {soldLabel}
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
