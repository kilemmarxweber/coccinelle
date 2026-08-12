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
} from "@/lib/hotel/service-stock-print";
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
  lines: { qtyAttributed: number; qtySold: number; unitPriceUsd: number }[];
};

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
        });
        toast.success("Session créée — confirmez l’état des lieux");
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
        await confirmServiceStockOpeningAction({
          organizationId: props.organizationId,
          branchId: props.branchId,
          sessionId: session.id,
          counts,
        });
        toast.success("État des lieux confirmé");
        router.refresh();
        window.setTimeout(() => printOpening(), 300);
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
        toast.success("Service clôturé");
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

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4 px-4 py-6">
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
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="px-3 py-2">Produit</th>
                    <th className="px-3 py-2 text-right">Attribué</th>
                    <th className="px-3 py-2 text-right">Vendu</th>
                    <th className="px-3 py-2 text-right">Restant</th>
                  </tr>
                </thead>
                <tbody>
                  {session.lines.map((l) => (
                    <tr key={l.id} className="border-t border-border/70">
                      <td className="px-3 py-2">{l.menuItem.name}</td>
                      <td className="px-3 py-2 text-right">
                        {l.qtyAttributed}
                      </td>
                      <td className="px-3 py-2 text-right">{l.qtySold}</td>
                      <td className="px-3 py-2 text-right font-medium">
                        {remaining(l)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      )}

      <div>
        <h2 className="mb-2 text-sm font-semibold">Historique</h2>
        <ul className="space-y-2">
          {props.history.map((h) => {
            const ca = h.lines.reduce(
              (s, l) => s + l.qtySold * l.unitPriceUsd,
              0,
            );
            return (
              <li
                key={h.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm"
              >
                <span>
                  {h.number} · {h.vendorDisplayName} · {h.status}
                </span>
                <span className="text-muted-foreground">
                  CA {money(ca)}
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
              Choisissez l’entrant et attribuez des quantités depuis le dépôt
              (hors cuisine uniquement).
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
            <div className="space-y-2">
              <Label>Attribution dépôt → float</Label>
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
