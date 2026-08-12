"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Printer } from "lucide-react";
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
  formatPrimaryAmount,
  type NormalizedUsdCdfRate,
} from "@/lib/cash/exchange";
import { branchDashboardPath, hotelRoutes } from "@/lib/branch/paths";
import {
  closeServiceStockSessionAction,
  confirmServiceStockOpeningAction,
  markOpeningDocumentPrintedAction,
  openServiceStockSessionAction,
  topUpServiceStockAction,
} from "@/lib/hotel/service-stock";
import {
  buildServiceStockClosingHtml,
  buildServiceStockOpeningHtml,
  summarizeRecover,
} from "@/lib/hotel/service-stock-print";
import {
  DualBarChart,
  SimpleBarChart,
  TrendAreaChart,
} from "@/components/reports/report-charts";
import { cn } from "@/lib/utils";

type Staff = { userId: string; name: string; role: string };
type DepotItem = {
  id: string;
  name: string;
  category: string;
  price: number;
  stockQty: number;
  storageZone: string;
};
type SessionLine = {
  id: string;
  menuItemId: string;
  qtyAttributed: number;
  qtyOpeningCounted: number | null;
  qtySold: number;
  qtyClosingCounted: number | null;
  qtyReturnedToDepot: number;
  qtyLoss: number;
  unitPriceUsd: number;
  sourceZone: string;
  menuItem: {
    id: string;
    name: string;
    category: string;
    price: number;
    stockQty: number;
    storageZone: string;
  };
};
type Session = {
  id: string;
  number: string;
  status: string;
  vendorUserId: string;
  vendorDisplayName: string;
  openedByUserId: string;
  openedAt: string | Date;
  closedAt: string | Date | null;
  openingConfirmedAt: string | Date | null;
  notes: string | null;
  lines: SessionLine[];
} | null;

type HistoryRow = {
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

type PendingHandover = {
  sessionId: string;
  number: string;
  vendorDisplayName: string;
  closedAt: string | Date | null;
  lines: {
    menuItemId: string;
    name: string;
    quantity: number;
    unitPriceUsd: number;
    sourceZone: string;
  }[];
} | null;

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

function remaining(l: {
  qtyAttributed: number;
  qtySold: number;
  qtyLoss: number;
}) {
  return Math.max(0, l.qtyAttributed - l.qtySold - l.qtyLoss);
}

export function ServiceStockClient(props: {
  organizationId: string;
  branchId: string;
  branchName: string;
  session: Session;
  staff: Staff[];
  depotItems: DepotItem[];
  history: HistoryRow[];
  pendingHandover: PendingHandover;
  rate: NormalizedUsdCdfRate | null;
  currentUserName: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [openWizard, setOpenWizard] = useState(false);
  const [topUpOpen, setTopUpOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [vendorUserId, setVendorUserId] = useState(
    props.staff[0]?.userId ?? "",
  );
  const [inheritHandover, setInheritHandover] = useState(
    Boolean(props.pendingHandover),
  );
  const [closeDisposition, setCloseDisposition] = useState<
    "HANDOVER" | "RETURN_DEPOT"
  >("HANDOVER");
  const [alloc, setAlloc] = useState<Record<string, string>>({});
  const [openingCounts, setOpeningCounts] = useState<Record<string, string>>(
    {},
  );
  const [closingCounts, setClosingCounts] = useState<Record<string, string>>(
    {},
  );
  const [closingLoss, setClosingLoss] = useState<Record<string, string>>({});
  const [topUpItemId, setTopUpItemId] = useState("");
  const [topUpQty, setTopUpQty] = useState("1");

  const session = props.session;
  const money = (n: number) => formatPrimaryAmount(n, props.rate);

  const needsConfirm =
    session &&
    (session.status === "DRAFT" ||
      (session.status === "OPEN" && !session.openingConfirmedAt));

  const isLive =
    session?.status === "OPEN" && Boolean(session.openingConfirmedAt);

  const docLines = useMemo(() => {
    if (!session) return [];
    return session.lines.map((l) => ({
      name: l.menuItem.name,
      sourceZone: l.sourceZone,
      qtyAttributed: l.qtyAttributed,
      qtyOpeningCounted: l.qtyOpeningCounted,
      qtySold: l.qtySold,
      qtyClosingCounted: l.qtyClosingCounted,
      qtyReturnedToDepot: l.qtyReturnedToDepot,
      qtyLoss: l.qtyLoss,
      unitPriceUsd: l.unitPriceUsd,
    }));
  }, [session]);

  const liveSummary = useMemo(() => {
    if (!session) return summarizeRecover([]);
    if (needsConfirm) {
      const preview = session.lines.map((l) => ({
        name: l.menuItem.name,
        sourceZone: l.sourceZone,
        qtyAttributed: l.qtyAttributed,
        qtyOpeningCounted: Math.round(
          Number(openingCounts[l.id] ?? l.qtyAttributed) || 0,
        ),
        qtySold: l.qtySold,
        qtyLoss: l.qtyLoss,
        unitPriceUsd: l.unitPriceUsd,
      }));
      return summarizeRecover(preview);
    }
    return summarizeRecover(docLines);
  }, [session, needsConfirm, openingCounts, docLines]);

  /** CA par session (historique) pour courbe. */
  const salesTrend = useMemo(() => {
    return [...props.history]
      .filter((h) => h.status === "CLOSED")
      .reverse()
      .slice(-14)
      .map((h) => {
        const ca = summarizeRecover(h.lines.map((l) => ({
          name: "",
          sourceZone: "",
          qtyAttributed: l.qtyAttributed,
          qtyOpeningCounted: l.qtyOpeningCounted,
          qtySold: l.qtySold,
          qtyLoss: l.qtyLoss,
          unitPriceUsd: l.unitPriceUsd,
        }))).sold;
        const d =
          h.closedAt instanceof Date
            ? h.closedAt
            : new Date(h.closedAt ?? h.openedAt);
        const day = d.toISOString().slice(0, 10);
        return { day, value: Math.round(ca * 100) / 100 };
      });
  }, [props.history]);

  /** Efficacité vendeur : CA + taux de recouvrement. */
  const vendorStats = useMemo(() => {
    const map = new Map<
      string,
      { toRecover: number; sold: number; sessions: number }
    >();
    for (const h of props.history) {
      const key = h.vendorDisplayName || "Entrant";
      const cur = map.get(key) ?? {
        toRecover: 0,
        sold: 0,
        sessions: 0,
      };
      cur.sessions += 1;
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
        fullName: name,
        ca: Math.round(v.sold * 100) / 100,
        rate:
          v.toRecover > 0.0001
            ? Math.round((v.sold / v.toRecover) * 1000) / 10
            : 0,
        sessions: v.sessions,
      }))
      .sort((a, b) => b.ca - a.ca);
  }, [props.history]);

  const vendorRateChart = useMemo(
    () =>
      vendorStats.map((v) => ({
        name: v.name,
        value: v.rate,
      })),
    [vendorStats],
  );

  const vendorCaChart = useMemo(
    () =>
      vendorStats.map((v) => ({
        name: v.name,
        value: v.ca,
      })),
    [vendorStats],
  );

  const productSalesChart = useMemo(() => {
    if (!session) return [] as { name: string; value: number }[];
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

  const sessionQtyChart = useMemo(() => {
    if (!session) return [] as { day: string; entrees: number; sorties: number }[];
    return session.lines.map((l) => ({
      day: l.menuItem.name.slice(0, 10),
      entrees: l.qtyAttributed,
      sorties: l.qtySold,
    }));
  }, [session]);

  function printOpening(updatedNote?: string) {
    if (!session) return;
    printHtml(
      buildServiceStockOpeningHtml({
        branchName: props.branchName,
        number: session.number,
        vendorDisplayName: session.vendorDisplayName,
        managerName: props.currentUserName,
        openedAt: session.openedAt,
        lines: docLines,
        formatMoney: money,
        updatedNote,
      }),
    );
    start(async () => {
      try {
        await markOpeningDocumentPrintedAction({
          organizationId: props.organizationId,
          branchId: props.branchId,
          sessionId: session.id,
        });
      } catch {
        /* ignore */
      }
    });
  }

  function createSession() {
    start(async () => {
      try {
        const lines = props.depotItems
          .map((item) => ({
            menuItemId: item.id,
            quantity: Math.round(Number(alloc[item.id]) || 0),
            sourceZone: item.storageZone,
          }))
          .filter((l) => l.quantity > 0);
        await openServiceStockSessionAction({
          organizationId: props.organizationId,
          branchId: props.branchId,
          vendorUserId,
          lines,
          inheritHandover: Boolean(
            inheritHandover && props.pendingHandover,
          ),
        });
        toast.success(
          inheritHandover && props.pendingHandover
            ? "Session créée — float hérité (+ ajouts dépôt)"
            : "Session créée — confirmez l’état des lieux",
        );
        setOpenWizard(false);
        setAlloc({});
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erreur");
      }
    });
  }

  function confirmOpening() {
    if (!session) return;
    start(async () => {
      try {
        const counts = session.lines.map((l) => ({
          lineId: l.id,
          qtyOpeningCounted: Math.round(
            Number(openingCounts[l.id] ?? l.qtyAttributed) || 0,
          ),
        }));
        const countById = new Map(counts.map((c) => [c.lineId, c]));
        await confirmServiceStockOpeningAction({
          organizationId: props.organizationId,
          branchId: props.branchId,
          sessionId: session.id,
          counts,
        });
        toast.success("État des lieux confirmé");
        printHtml(
          buildServiceStockOpeningHtml({
            branchName: props.branchName,
            number: session.number,
            vendorDisplayName: session.vendorDisplayName,
            managerName: props.currentUserName,
            openedAt: session.openedAt,
            formatMoney: money,
            lines: session.lines.map((l) => ({
              name: l.menuItem.name,
              sourceZone: l.sourceZone,
              qtyAttributed: l.qtyAttributed,
              qtyOpeningCounted: countById.get(l.id)!.qtyOpeningCounted,
              qtySold: l.qtySold,
              unitPriceUsd: l.unitPriceUsd,
            })),
          }),
        );
        start(async () => {
          try {
            await markOpeningDocumentPrintedAction({
              organizationId: props.organizationId,
              branchId: props.branchId,
              sessionId: session.id,
            });
          } catch {
            /* ignore */
          }
        });
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erreur");
      }
    });
  }

  function doTopUp() {
    if (!session) return;
    start(async () => {
      try {
        await topUpServiceStockAction({
          organizationId: props.organizationId,
          branchId: props.branchId,
          sessionId: session.id,
          menuItemId: topUpItemId,
          quantity: Math.round(Number(topUpQty) || 0),
        });
        toast.success("Réassort enregistré");
        setTopUpOpen(false);
        setTopUpQty("1");
        router.refresh();
        window.setTimeout(
          () => printOpening("État mis à jour (réassort)"),
          400,
        );
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erreur");
      }
    });
  }

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
          sessionId: session.id,
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
            number: session.number,
            vendorDisplayName: session.vendorDisplayName,
            managerName: props.currentUserName,
            openedAt: session.openedAt,
            closedAt: new Date(),
            lines: linesForDoc,
            formatMoney: money,
            disposition: closeDisposition,
          }),
        );
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erreur");
      }
    });
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href={branchDashboardPath(props.organizationId, props.branchId)}
            className="mb-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" /> Dashboard
          </Link>
          <h1 className="text-xl font-semibold tracking-tight">
            Service stock
          </h1>
          <p className="text-sm text-muted-foreground">
            {props.branchName} · float hors cuisine · ouverture / clôture
            signées
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!session ? (
            <Button onClick={() => setOpenWizard(true)}>
              <Plus className="mr-1.5 size-4" /> Ouvrir le service
            </Button>
          ) : null}
          {isLive ? (
            <>
              <Button variant="outline" onClick={() => setTopUpOpen(true)}>
                Réassort
              </Button>
              <Button
                variant="outline"
                onClick={() => printOpening("État à jour")}
              >
                <Printer className="mr-1 size-3.5" /> Doc. ouverture
              </Button>
              <Button onClick={() => setCloseOpen(true)}>Clôturer</Button>
            </>
          ) : null}
        </div>
      </div>

      {!session ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Aucune session active. Ouvrez le service, choisissez l’entrant et
          attribuez le float depuis le dépôt.
          {props.pendingHandover ? (
            <p className="mt-3 text-emerald-700 dark:text-emerald-300">
              Float en transmission disponible ({props.pendingHandover.number} ·{" "}
              {props.pendingHandover.vendorDisplayName}) — l’ouverture peut
              l’hériter.
            </p>
          ) : null}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold">{session.number}</p>
              <Badge variant="secondary">{session.status}</Badge>
              {session.openingConfirmedAt ? (
                <Badge>État des lieux OK</Badge>
              ) : (
                <Badge variant="outline">À confirmer</Badge>
              )}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Entrant : <strong>{session.vendorDisplayName}</strong>
              {" · "}
              {new Date(session.openedAt).toLocaleString("fr-FR")}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-border bg-card px-4 py-3">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                À recouvrir
              </p>
              <p className="mt-1 text-lg font-semibold tabular-nums">
                {money(liveSummary.toRecover)}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card px-4 py-3">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Recouvré (vendu)
              </p>
              <p className="mt-1 text-lg font-semibold tabular-nums">
                {money(liveSummary.sold)}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card px-4 py-3">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Restant (valeur)
              </p>
              <p className="mt-1 text-lg font-semibold tabular-nums">
                {money(liveSummary.remainingValue)}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card px-4 py-3">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Taux de recouvrement
              </p>
              <p className="mt-1 text-lg font-semibold tabular-nums">
                {liveSummary.recoverRate.toLocaleString("fr-FR")} %
              </p>
            </div>
          </div>

          {needsConfirm ? (
            <div className="rounded-xl border border-sky-500/30 bg-sky-500/5 p-4 space-y-3">
              <h2 className="font-medium">État des lieux — ouverture</h2>
              <p className="text-xs text-muted-foreground">
                L’entrant confirme les quantités reçues, puis le document
                d’ouverture s’imprime.
              </p>
              {session.lines.map((l) => (
                <div
                  key={l.id}
                  className="grid grid-cols-[1fr_100px] items-center gap-2"
                >
                  <div>
                    <p className="text-sm font-medium">{l.menuItem.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      Attribué : {l.qtyAttributed} · {l.sourceZone}
                    </p>
                  </div>
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    value={
                      openingCounts[l.id] ?? String(l.qtyAttributed)
                    }
                    onChange={(e) =>
                      setOpeningCounts((m) => ({
                        ...m,
                        [l.id]: e.target.value,
                      }))
                    }
                  />
                </div>
              ))}
              <Button disabled={pending} onClick={confirmOpening}>
                Confirmer · imprimer document ouverture
              </Button>
            </div>
          ) : null}

          {isLive ? (
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="px-3 py-2">Produit</th>
                    <th className="px-3 py-2 text-right">P.U.</th>
                    <th className="px-3 py-2 text-right">Attribué</th>
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
                          {money(l.unitPriceUsd)}
                        </td>
                        <td className="px-3 py-2 text-right">{l.qtyAttributed}</td>
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
          ) : null}

          {isLive && sessionQtyChart.length > 0 ? (
            <div className="grid gap-3 lg:grid-cols-2">
              <div className="rounded-xl border border-border bg-card p-4">
                <h3 className="text-sm font-semibold">
                  Situation de vente (session)
                </h3>
                <p className="mb-3 text-xs text-muted-foreground">
                  Attribué vs vendu par produit
                </p>
                <div className="h-[220px]">
                  <DualBarChart
                    data={sessionQtyChart}
                    entreesLabel="Attribué"
                    sortiesLabel="Vendu"
                  />
                </div>
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <h3 className="text-sm font-semibold">CA par produit</h3>
                <p className="mb-3 text-xs text-muted-foreground">
                  Montant recouvré sur cette session
                </p>
                <div className="h-[220px]">
                  {productSalesChart.length > 0 ? (
                    <SimpleBarChart data={productSalesChart} color="#0d9488" />
                  ) : (
                    <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
                      Pas encore de vente
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}

      <div className="space-y-3">
        <h2 className="text-sm font-semibold">Statistiques de vente</h2>
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="text-sm font-medium">CA des sessions clôturées</h3>
            <p className="mb-3 text-xs text-muted-foreground">
              Évolution récente (14 dernières)
            </p>
            <div className="h-[220px]">
              {salesTrend.length > 0 ? (
                <TrendAreaChart
                  data={salesTrend}
                  color="#0d9488"
                  valueLabel="CA"
                />
              ) : (
                <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  Aucune session clôturée
                </p>
              )}
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="text-sm font-medium">Efficacité vendeurs (CA)</h3>
            <p className="mb-3 text-xs text-muted-foreground">
              Montant recouvré cumulé par entrant
            </p>
            <div className="h-[220px]">
              {vendorCaChart.length > 0 ? (
                <SimpleBarChart data={vendorCaChart} color="#0369a1" />
              ) : (
                <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  Pas encore d’historique
                </p>
              )}
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-4 lg:col-span-2">
            <h3 className="text-sm font-medium">
              Taux de recouvrement par vendeur
            </h3>
            <p className="mb-3 text-xs text-muted-foreground">
              Vendu ÷ valeur à recouvrir (efficacité)
            </p>
            <div className="h-[240px]">
              {vendorRateChart.length > 0 ? (
                <SimpleBarChart data={vendorRateChart} color="#b45309" />
              ) : (
                <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  Pas encore d’historique
                </p>
              )}
            </div>
            {vendorStats.length > 0 ? (
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {vendorStats.map((v) => (
                  <li
                    key={v.fullName}
                    className="flex items-center justify-between rounded-lg border border-border/70 px-3 py-2 text-xs"
                  >
                    <span className="font-medium">{v.fullName}</span>
                    <span className="text-muted-foreground tabular-nums">
                      {money(v.ca)} · {v.rate.toLocaleString("fr-FR")} % ·{" "}
                      {v.sessions} sess.
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold">Historique</h2>
        <ul className="space-y-2">
          {props.history.map((h) => {
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
            return (
              <li
                key={h.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm"
              >
                <span>
                  {h.number} · {h.vendorDisplayName} · {h.status}
                </span>
                <span className="text-muted-foreground tabular-nums">
                  À recouvrir {money(s.toRecover)} · Recouvré {money(s.sold)} ·{" "}
                  {s.recoverRate.toLocaleString("fr-FR")} %
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      <Dialog open={openWizard} onOpenChange={setOpenWizard}>
        <DialogContent className="max-h-[94svh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Ouvrir le service stock</DialogTitle>
            <DialogDescription>
              Choisissez l’entrant. Héritez du float transmis à la clôture
              précédente, et/ou ajoutez depuis le dépôt.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-1.5">
              <Label>Entrant</Label>
              <select
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                value={vendorUserId}
                onChange={(e) => setVendorUserId(e.target.value)}
              >
                {props.staff.map((s) => (
                  <option key={s.userId} value={s.userId}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            {props.pendingHandover ? (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 space-y-2">
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={inheritHandover}
                    onChange={(e) => setInheritHandover(e.target.checked)}
                  />
                  <span>
                    <strong>Hériter du restant</strong> —{" "}
                    {props.pendingHandover.number} (
                    {props.pendingHandover.vendorDisplayName})
                    <span className="block text-xs text-muted-foreground">
                      Le nouvel entrant reprend le float compté à la clôture et
                      peut continuer à vendre. Réassort dépôt possible ci-dessous
                      ou pendant le service.
                    </span>
                  </span>
                </label>
                {inheritHandover ? (
                  <ul className="space-y-1 text-xs text-muted-foreground">
                    {props.pendingHandover.lines.map((l) => (
                      <li key={l.menuItemId} className="flex justify-between gap-2">
                        <span>{l.name}</span>
                        <span className="tabular-nums font-medium text-foreground">
                          {l.quantity}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Aucun float en transmission. Attribuez depuis le dépôt.
              </p>
            )}
            <div className="space-y-2">
              <Label>
                {props.pendingHandover && inheritHandover
                  ? "Ajout dépôt (optionnel / réassort)"
                  : "Attribution dépôt → float"}
              </Label>
              {props.depotItems.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Aucun produit hors cuisine actif.
                </p>
              ) : (
                props.depotItems.map((item) => (
                  <div
                    key={item.id}
                    className="grid grid-cols-[1fr_90px] items-center gap-2 rounded-lg border border-border/70 px-2 py-1.5"
                  >
                    <div>
                      <p className="text-sm font-medium">{item.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        Dépôt {item.stockQty} · {item.storageZone} ·{" "}
                        {money(item.price)}
                      </p>
                    </div>
                    <Input
                      type="number"
                      min={0}
                      max={item.stockQty}
                      step={1}
                      placeholder="0"
                      value={alloc[item.id] ?? ""}
                      onChange={(e) =>
                        setAlloc((m) => ({
                          ...m,
                          [item.id]: e.target.value,
                        }))
                      }
                    />
                  </div>
                ))
              )}
            </div>
            <Button
              disabled={pending || !vendorUserId}
              onClick={createSession}
            >
              Créer la session
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={topUpOpen} onOpenChange={setTopUpOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Réassort manager</DialogTitle>
            <DialogDescription>
              Ajoutez du stock depuis le dépôt s’il en reste.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label>Produit</Label>
              <select
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                value={topUpItemId}
                onChange={(e) => setTopUpItemId(e.target.value)}
              >
                <option value="">Choisir…</option>
                {props.depotItems
                  .filter((i) => i.stockQty > 0)
                  .map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} (dépôt {i.stockQty})
                    </option>
                  ))}
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label>Quantité</Label>
              <Input
                type="number"
                min={1}
                step={1}
                value={topUpQty}
                onChange={(e) => setTopUpQty(e.target.value)}
              />
            </div>
            <Button
              disabled={pending || !topUpItemId}
              onClick={doTopUp}
            >
              Ajouter · réimprimer état
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={closeOpen} onOpenChange={setCloseOpen}>
        <DialogContent className="max-h-[94svh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Clôturer le service</DialogTitle>
            <DialogDescription>
              Comptez le restant. Le document de fermeture sera imprimé
              (entrant + manager).
            </DialogDescription>
          </DialogHeader>
          {session ? (
            <div className="space-y-3">
              <div className="space-y-2 rounded-xl border border-border p-3">
                <Label>Disposition du restant</Label>
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="radio"
                    className="mt-1"
                    name="close-disposition"
                    checked={closeDisposition === "HANDOVER"}
                    onChange={() => setCloseDisposition("HANDOVER")}
                  />
                  <span>
                    <strong>Transmettre au prochain entrant</strong>
                    <span className="block text-xs text-muted-foreground">
                      Le float compté reste en service — la prochaine ouverture
                      peut l’hériter et continuer (ou demander un réassort).
                    </span>
                  </span>
                </label>
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="radio"
                    className="mt-1"
                    name="close-disposition"
                    checked={closeDisposition === "RETURN_DEPOT"}
                    onChange={() => setCloseDisposition("RETURN_DEPOT")}
                  />
                  <span>
                    <strong>Retourner au dépôt</strong>
                    <span className="block text-xs text-muted-foreground">
                      Remise en magasin / congélateur (fin de journée).
                    </span>
                  </span>
                </label>
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
                      value={
                        closingCounts[l.id] ?? String(remaining(l))
                      }
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
                Clôturer · imprimer document fermeture
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <p className={cn("text-xs text-muted-foreground")}>
        Restauration / vente rapide hors cuisine exigent une session{" "}
        <Link
          className="underline"
          href={hotelRoutes.restauration(
            props.organizationId,
            props.branchId,
          )}
        >
          confirmée
        </Link>
        .
      </p>
    </div>
  );
}
