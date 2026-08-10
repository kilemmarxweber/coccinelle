"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  FileDown,
  Package,
  Search,
  Truck,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  listStockMovementsAction,
  recordConsumableStockMoveAction,
} from "@/lib/hotel/actions";
import { STOCK_LOW_THRESHOLD } from "@/lib/hotel/menu-categories";
import {
  downloadStockMovementsHtml,
  openBlankPrintWindow,
  writeStockMovementsPrintDocument,
} from "@/lib/hotel/stock-movements-print";
import { cn } from "@/lib/utils";

type Consumable = {
  id: string;
  name: string;
  imageUrl: string | null;
  stockQty: number;
  provenance: string | null;
  supplierName: string | null;
};

type Movement = {
  id: string;
  kind: string;
  quantity: number;
  stockBefore?: number | null;
  stockAfter?: number | null;
  note: string | null;
  createdAt: string | Date;
  createdByUserId?: string;
  createdByName?: string | null;
  menuItem: {
    id: string;
    name: string;
    imageUrl: string | null;
    stockQty?: number | null;
    supplierName?: string | null;
    provenance?: string | null;
  };
};

type MoveKindFilter = "ALL" | "ENTREE" | "SORTIE";

function stockTone(qty: number) {
  if (qty <= 0) return "bg-rose-500/15 text-rose-700 dark:text-rose-300";
  if (qty <= STOCK_LOW_THRESHOLD) {
    return "bg-amber-500/15 text-amber-800 dark:text-amber-200";
  }
  return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
}

function stockLabel(qty: number) {
  if (qty <= 0) return "Rupture";
  if (qty <= STOCK_LOW_THRESHOLD) return `Stock bas · ${qty}`;
  return `Stock ${qty}`;
}

function formatWhen(value: string | Date) {
  const d = value instanceof Date ? value : new Date(value);
  return d.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toIsoDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfLocalDay(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1, 0, 0, 0, 0).getTime();
}

function endOfLocalDay(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1, 23, 59, 59, 999).getTime();
}

function kindLabel(kind: MoveKindFilter) {
  if (kind === "ENTREE") return "Entrées uniquement";
  if (kind === "SORTIE") return "Sorties uniquement";
  return "Entrées et sorties";
}

export function LivraisonClient(props: {
  organizationId: string;
  branchId: string;
  branch: {
    name: string;
    imageUrl?: string | null;
    address?: string | null;
    city?: string | null;
    phone?: string | null;
    email?: string | null;
  };
  items: Consumable[];
  movements: Movement[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Consumable | null>(null);
  const [kind, setKind] = useState<"ENTREE" | "SORTIE">("ENTREE");
  const [quantity, setQuantity] = useState("1");
  const [note, setNote] = useState("");

  const today = useMemo(() => toIsoDate(new Date()), []);
  const monthAgo = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return toIsoDate(d);
  }, []);

  const [moveKind, setMoveKind] = useState<MoveKindFilter>("ALL");
  const [dateFrom, setDateFrom] = useState(monthAgo);
  const [dateTo, setDateTo] = useState(today);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [pdfFrom, setPdfFrom] = useState(monthAgo);
  const [pdfTo, setPdfTo] = useState(today);
  const [pdfKind, setPdfKind] = useState<MoveKindFilter>("ALL");

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return props.items;
    return props.items.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        (item.supplierName?.toLowerCase().includes(q) ?? false) ||
        (item.provenance?.toLowerCase().includes(q) ?? false),
    );
  }, [props.items, query]);

  const filteredMoves = useMemo(() => {
    const fromTs = dateFrom ? startOfLocalDay(dateFrom) : null;
    const toTs = dateTo ? endOfLocalDay(dateTo) : null;
    return props.movements.filter((m) => {
      if (moveKind !== "ALL" && m.kind !== moveKind) return false;
      const t = new Date(m.createdAt).getTime();
      if (fromTs != null && t < fromTs) return false;
      if (toTs != null && t > toTs) return false;
      return true;
    });
  }, [props.movements, moveKind, dateFrom, dateTo]);

  const moveCounts = useMemo(() => {
    const fromTs = dateFrom ? startOfLocalDay(dateFrom) : null;
    const toTs = dateTo ? endOfLocalDay(dateTo) : null;
    let all = 0;
    let entree = 0;
    let sortie = 0;
    for (const m of props.movements) {
      const t = new Date(m.createdAt).getTime();
      if (fromTs != null && t < fromTs) continue;
      if (toTs != null && t > toTs) continue;
      all += 1;
      if (m.kind === "ENTREE") entree += 1;
      else if (m.kind === "SORTIE") sortie += 1;
    }
    return { all, entree, sortie };
  }, [props.movements, dateFrom, dateTo]);

  function openMove(item: Consumable, nextKind: "ENTREE" | "SORTIE") {
    setSelected(item);
    setKind(nextKind);
    setQuantity("1");
    setNote("");
  }

  function submit() {
    if (!selected) return;
    const qty = Math.round(Number(quantity));
    if (!Number.isFinite(qty) || qty < 1) {
      toast.error("Quantité invalide");
      return;
    }
    start(async () => {
      try {
        await recordConsumableStockMoveAction({
          organizationId: props.organizationId,
          branchId: props.branchId,
          itemId: selected.id,
          kind,
          quantity: qty,
          note: note.trim() || null,
        });
        toast.success(
          kind === "ENTREE"
            ? `+${qty} ajouté au stock`
            : `−${qty} décompté du stock`,
        );
        setSelected(null);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erreur");
      }
    });
  }

  function openPdfDialog() {
    setPdfFrom(dateFrom || monthAgo);
    setPdfTo(dateTo || today);
    setPdfKind(moveKind);
    setPdfOpen(true);
  }

  function exportPdf() {
    if (!pdfFrom || !pdfTo) {
      toast.error("Indiquez la période");
      return;
    }
    if (pdfFrom > pdfTo) {
      toast.error("La date de début doit précéder la fin");
      return;
    }

    // Ouvrir synchrone dans le geste clic (sinon bloqué après await).
    const win = openBlankPrintWindow();

    start(async () => {
      try {
        const rows = await listStockMovementsAction(
          props.organizationId,
          props.branchId,
          {
            kind: pdfKind,
            from: pdfFrom,
            to: pdfTo,
            limit: 500,
          },
        );
        const payload = {
          branch: props.branch,
          from: pdfFrom,
          to: pdfTo,
          kindLabel: kindLabel(pdfKind),
          rows: rows.map((r) => ({
            kind: r.kind,
            quantity: r.quantity,
            stockBefore: r.stockBefore,
            stockAfter: r.stockAfter,
            note: r.note,
            createdAt: r.createdAt,
            menuItem: {
              name: r.menuItem.name,
              stockQty: r.menuItem.stockQty ?? null,
              supplierName: r.menuItem.supplierName ?? null,
              provenance: r.menuItem.provenance ?? null,
            },
          })),
        };

        if (win && !win.closed) {
          writeStockMovementsPrintDocument(win, payload);
          setPdfOpen(false);
          toast.success("Aperçu ouvert — Imprimer / Enregistrer en PDF");
          return;
        }

        downloadStockMovementsHtml(
          payload,
          `mouvements-stock-${pdfFrom}_${pdfTo}.html`,
        );
        setPdfOpen(false);
        toast.success(
          "Fichier HTML téléchargé — ouvrez-le puis Imprimer → PDF",
        );
      } catch (e) {
        if (win && !win.closed) win.close();
        toast.error(e instanceof Error ? e.message : "Erreur");
      }
    });
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-5 px-3 py-5 sm:px-5 lg:px-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-700 dark:text-amber-300">
            <Truck className="size-6" />
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Livraison</h1>
            <p className="text-sm text-muted-foreground">
              Stock et mouvements de cette branche — enregistrés par ses
              membres.
            </p>
          </div>
        </div>
      </header>

      <Tabs defaultValue="stock" className="gap-4">
        <TabsList variant="line" className="w-full max-w-md">
          <TabsTrigger value="stock" className="flex-1">
            Stock
          </TabsTrigger>
          <TabsTrigger value="mouvements" className="flex-1">
            Derniers mouvements
          </TabsTrigger>
        </TabsList>

        <TabsContent value="stock" className="space-y-4">
          <div className="relative max-w-md">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher un consommable…"
              className="pl-9"
            />
          </div>

          {filteredItems.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border px-6 py-16 text-center">
              <Package className="mx-auto size-10 text-muted-foreground/50" />
              <p className="mt-3 text-sm text-muted-foreground">
                Aucun consommable actif. Créez-en dans Produits (type
                Consommables).
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredItems.map((item) => (
                <article
                  key={item.id}
                  className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
                >
                  <div className="relative aspect-[16/10] bg-muted">
                    {item.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        className="size-full object-cover"
                      />
                    ) : (
                      <div className="flex size-full items-center justify-center bg-gradient-to-br from-amber-500/20 via-muted to-sky-500/15">
                        <Package className="size-10 text-muted-foreground/70" />
                      </div>
                    )}
                    <div className="absolute top-2 right-2">
                      <Badge
                        variant="secondary"
                        className={cn("border-0", stockTone(item.stockQty))}
                      >
                        {stockLabel(item.stockQty)}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex flex-1 flex-col gap-3 p-3.5">
                    <div>
                      <h2 className="text-sm font-semibold leading-snug">
                        {item.name}
                      </h2>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {[item.supplierName, item.provenance]
                          .filter(Boolean)
                          .join(" · ") || "Sans fournisseur"}
                      </p>
                      <p className="mt-1 text-lg font-bold tabular-nums">
                        {item.stockQty}
                        <span className="ml-1 text-xs font-medium text-muted-foreground">
                          en stock
                        </span>
                      </p>
                    </div>
                    <div className="mt-auto grid grid-cols-2 gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="gap-1"
                        disabled={pending}
                        onClick={() => openMove(item, "ENTREE")}
                      >
                        <ArrowDownToLine className="size-3.5" />
                        Entrée
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        className="gap-1"
                        disabled={pending || item.stockQty <= 0}
                        onClick={() => openMove(item, "SORTIE")}
                      >
                        <ArrowUpFromLine className="size-3.5" />
                        Décompte
                      </Button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="mouvements" className="space-y-4">
          <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  ["ALL", "Tous", moveCounts.all],
                  ["ENTREE", "Entrées", moveCounts.entree],
                  ["SORTIE", "Sorties", moveCounts.sortie],
                ] as const
              ).map(([id, label, count]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setMoveKind(id)}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-medium transition",
                    moveKind === id
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80",
                  )}
                >
                  {label}
                  <span className="ml-1 opacity-80">({count})</span>
                </button>
              ))}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
              <div className="grid gap-1.5">
                <Label htmlFor="move-from">Du</Label>
                <Input
                  id="move-from"
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full sm:w-auto"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="move-to">Au</Label>
                <Input
                  id="move-to"
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full sm:w-auto"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                className="gap-1.5 sm:ml-auto"
                onClick={openPdfDialog}
              >
                <FileDown className="size-4" />
                PDF période
              </Button>
            </div>
          </div>

          {filteredMoves.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border px-6 py-12 text-center text-sm text-muted-foreground">
              Aucun mouvement pour ce filtre / cette période.
            </div>
          ) : (
            <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
              {filteredMoves.map((m) => {
                const entree = m.kind === "ENTREE";
                return (
                  <li
                    key={m.id}
                    className="flex items-center gap-3 px-4 py-3"
                  >
                    <span
                      className={cn(
                        "flex size-9 shrink-0 items-center justify-center rounded-xl",
                        entree
                          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                          : "bg-rose-500/15 text-rose-700 dark:text-rose-300",
                      )}
                    >
                      {entree ? (
                        <ArrowDownToLine className="size-4" />
                      ) : (
                        <ArrowUpFromLine className="size-4" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {m.menuItem.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {entree ? "Entrée" : "Sortie"} ·{" "}
                        {formatWhen(m.createdAt)}
                        {m.createdByName ? ` · ${m.createdByName}` : ""}
                        {typeof m.stockBefore === "number" &&
                        typeof m.stockAfter === "number"
                          ? ` · ${m.stockBefore} → ${m.stockAfter}`
                          : ""}
                        {m.note ? ` · ${m.note}` : ""}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "text-sm font-semibold tabular-nums",
                        entree ? "text-emerald-600" : "text-rose-600",
                      )}
                    >
                      {entree ? "+" : "−"}
                      {m.quantity}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </TabsContent>
      </Tabs>

      <Dialog
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <DialogContent className="sm:max-w-md" showCloseButton>
          <DialogHeader>
            <DialogTitle>
              {kind === "ENTREE" ? "Entrée stock" : "Décompte stock"}
            </DialogTitle>
          </DialogHeader>
          {selected ? (
            <div className="grid gap-4 py-1">
              <div className="rounded-xl border border-border bg-muted/30 px-3 py-2.5">
                <p className="font-medium">{selected.name}</p>
                <p className="text-xs text-muted-foreground">
                  Stock actuel : {selected.stockQty}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setKind("ENTREE")}
                  className={cn(
                    "rounded-xl border px-3 py-2.5 text-left text-sm transition",
                    kind === "ENTREE"
                      ? "border-emerald-500/40 bg-emerald-500/10"
                      : "border-border hover:bg-muted/50",
                  )}
                >
                  <p className="font-semibold">Entrée</p>
                  <p className="text-xs text-muted-foreground">
                    Livraison fournisseur
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => setKind("SORTIE")}
                  className={cn(
                    "rounded-xl border px-3 py-2.5 text-left text-sm transition",
                    kind === "SORTIE"
                      ? "border-rose-500/40 bg-rose-500/10"
                      : "border-border hover:bg-muted/50",
                  )}
                >
                  <p className="font-semibold">Décompte</p>
                  <p className="text-xs text-muted-foreground">
                    Consommation / usage
                  </p>
                </button>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="move-qty">Quantité</Label>
                <Input
                  id="move-qty"
                  type="number"
                  min={1}
                  step={1}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="move-note">Note · optionnel</Label>
                <Input
                  id="move-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Ex. BL-042, ménage étage 2…"
                />
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setSelected(null)}
            >
              Annuler
            </Button>
            <Button type="button" disabled={pending} onClick={submit}>
              Valider
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={pdfOpen} onOpenChange={setPdfOpen}>
        <DialogContent className="sm:max-w-md" showCloseButton>
          <DialogHeader>
            <DialogTitle>PDF entrées / sorties</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="pdf-from">Du</Label>
                <Input
                  id="pdf-from"
                  type="date"
                  value={pdfFrom}
                  onChange={(e) => setPdfFrom(e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="pdf-to">Au</Label>
                <Input
                  id="pdf-to"
                  type="date"
                  value={pdfTo}
                  onChange={(e) => setPdfTo(e.target.value)}
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>Type</Label>
              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    ["ALL", "Tous"],
                    ["ENTREE", "Entrées"],
                    ["SORTIE", "Sorties"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setPdfKind(id)}
                    className={cn(
                      "rounded-full px-3 py-1.5 text-xs font-medium transition",
                      pdfKind === id
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/80",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Ouvre l’aperçu navigateur — utilisez « Enregistrer au format PDF »
              dans la boîte d’impression.
            </p>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setPdfOpen(false)}
            >
              Annuler
            </Button>
            <Button
              type="button"
              disabled={pending}
              className="gap-1.5"
              onClick={exportPdf}
            >
              <FileDown className="size-4" />
              Générer PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
