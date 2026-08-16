"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Ban,
  CheckCircle2,
  Clock3,
  Flame,
  Pencil,
  RefreshCw,
  Timer,
  UserRound,
  UtensilsCrossed,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  PosChargeButton,
  PosTerminal,
  usePosCart,
} from "@/components/pos/pos-terminal";
import {
  advanceHotelOrderAction,
  createHotelOrderAction,
  updateHotelOrderAction,
} from "@/lib/hotel/actions";
import { isHotelOrderOpenForServerEdit } from "@/lib/hotel/order-edit";
import { ORDER_SETTLEMENT } from "@/lib/hotel/folio-note";
import {
  extractRoomNumber,
  lookupRoomStay,
} from "@/lib/hotel/stay-room-match";
import {
  formatPrimaryAmount,
  formatUsdLineTotal,
  formatUsdLinesTotal,
  type NormalizedUsdCdfRate,
} from "@/lib/cash/exchange";
import {
  elapsedLabel,
  formatCountdownBanner,
  prepCountdown,
} from "@/lib/hotel/order-time";
import { SearchCombobox } from "@/components/ui/search-combobox";
import { cn } from "@/lib/utils";
import {
  ServiceStockOpsPanel,
  type ServiceStockOpsSession,
} from "@/components/hotel/service-stock-ops-panel";
import {
  touchServiceStockPresenceAction,
  type LiveShiftSituation,
} from "@/lib/hotel/service-stock";

type MenuItem = {
  id: string;
  name: string;
  category: string;
  price: number;
  needsKitchen: boolean;
  imageUrl?: string | null;
  stockQty?: number;
  barcode?: string | null;
};

type OrderItem = {
  menuItemId?: string | null;
  name: string;
  quantity: number;
  amount: number;
  needsKitchen?: boolean;
  unitPrice?: number;
};

type Order = {
  id: string;
  tableLabel: string | null;
  stayId?: string | null;
  status: string;
  settlementMode?: string | null;
  postedToFolioAt?: string | Date | null;
  paidAt?: string | Date | null;
  serverNote?: string | null;
  createdByName?: string | null;
  sentAt?: string | Date | null;
  prepStartedAt?: string | Date | null;
  estimatedMinutes?: number | null;
  readyAt?: string | Date | null;
  deliveredAt?: string | Date | null;
  createdAt?: string | Date;
  updatedAt?: string | Date;
  items: OrderItem[];
  stay?: { guestName: string; room?: { number: string } | null } | null;
};

type ActiveStay = {
  id: string;
  guestName: string;
  room: { number: string };
  folio: { id: string } | null;
};

const STATUS_RANK: Record<string, number> = {
  ENVOYEE: 0,
  EN_PREPARATION: 1,
  PRETE: 2,
  EN_CAISSE: 3,
  PAYEE: 4,
  LIVREE: 5,
};

const DELIVERABLE = new Set([
  "ENVOYEE",
  "EN_PREPARATION",
  "PRETE",
  "EN_CAISSE",
  "PAYEE",
]);

function canDeliver(status: string) {
  return DELIVERABLE.has(status);
}

/** Côté serveur : En cours = lancée ; Prêt = livrée à table (pas la cuisine). */
function isWaiterPret(order: {
  status: string;
  deliveredAt?: Date | string | null;
}) {
  return order.status === "LIVREE" || Boolean(order.deliveredAt);
}

function waiterPhaseMeta(order: {
  status: string;
  deliveredAt?: Date | string | null;
}) {
  if (isWaiterPret(order)) {
    return {
      label: "Prêt",
      tone: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200",
    };
  }
  return {
    label: "En cours",
    tone: "bg-sky-500/15 text-sky-800 dark:text-sky-200",
  };
}

function kitchenHint(status: string): string | null {
  if (status === "ENVOYEE") return "Lancée";
  if (status === "EN_PREPARATION") return "Cuisine";
  if (status === "PRETE") return "Cuisine prête";
  if (status === "EN_CAISSE" || status === "PAYEE") return "Caisse";
  return null;
}

function isOnNote(order: Order) {
  return order.settlementMode === ORDER_SETTLEMENT.NOTE_CHAMBRE;
}

function canEditOrCancel(order: Order) {
  return isHotelOrderOpenForServerEdit(order);
}

export function RestaurationClient(props: {
  organizationId: string;
  branchId: string;
  branchName: string;
  menuItems: MenuItem[];
  orders: Order[];
  activeStays?: ActiveStay[];
  hasStays?: boolean;
  rate?: NormalizedUsdCdfRate | null;
  initialView?: "commande" | "suivi";
  currentUserName: string;
  stockReady: boolean;
  stockSession: ServiceStockOpsSession | null;
  stockForeignSession?: ServiceStockOpsSession | null;
  liveSituation?: LiveShiftSituation | null;
  stockCanOperate?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, start] = useTransition();
  const [tableLabel, setTableLabel] = useState("");
  const [stayId, setStayId] = useState("");
  const [settlementMode, setSettlementMode] = useState<
    "COMPTANT" | "NOTE_CHAMBRE"
  >("COMPTANT");
  const [now, setNow] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const hasStays = Boolean(props.hasStays);
  const activeStays = props.activeStays ?? [];

  const roomLookup = useMemo(() => {
    if (!hasStays || stayId) return { status: "idle" as const };
    return lookupRoomStay(activeStays, tableLabel);
  }, [hasStays, stayId, activeStays, tableLabel]);

  const roomMatchedStay =
    roomLookup.status === "matched" ? roomLookup.stay : null;

  const selectedStay = useMemo(
    () => activeStays.find((s) => s.id === stayId) ?? null,
    [activeStays, stayId],
  );

  function fmt(amountUsd: number) {
    return formatPrimaryAmount(amountUsd, props.rate);
  }
  function fmtLine(quantity: number, unitUsd: number) {
    return formatUsdLineTotal(quantity, unitUsd, props.rate);
  }
  function fmtCart(lines: { quantity: number; price: number }[]) {
    return formatUsdLinesTotal(
      lines.map((l) => ({ quantity: l.quantity, unitPriceUsd: l.price })),
      props.rate,
    );
  }
  const initialEnCoursCount = props.orders.filter(
    (o) => o.status !== "ANNULEE" && !isWaiterPret(o),
  ).length;
  const [view, setView] = useState<"commande" | "suivi">(
    props.initialView === "suivi" || initialEnCoursCount > 0
      ? "suivi"
      : "commande",
  );
  const [suiviFilter, setSuiviFilter] = useState<"en_cours" | "pret">(
    "en_cours",
  );
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const { cart, addItem, setQty, clear, load, toPayload } = usePosCart();

  const enCoursOrders = useMemo(
    () =>
      props.orders.filter(
        (o) => o.status !== "ANNULEE" && !isWaiterPret(o),
      ),
    [props.orders],
  );
  const pretOrders = useMemo(
    () => props.orders.filter((o) => isWaiterPret(o)),
    [props.orders],
  );

  useEffect(() => {
    if (searchParams.get("view") === "suivi") {
      setView("suivi");
      setSuiviFilter("en_cours");
    }
    const orderId = searchParams.get("orderId");
    if (orderId) {
      setView("suivi");
      setSuiviFilter("en_cours");
      setSelectedId(orderId);
    }
  }, [searchParams]);

  useEffect(() => {
    setNow(Date.now());
  }, []);

  useEffect(() => {
    const tick =
      view === "suivi"
        ? window.setInterval(() => setNow(Date.now()), 1000)
        : undefined;
    const ms = props.stockReady ? 10000 : 4000;
    const ping = () => {
      void touchServiceStockPresenceAction(
        props.organizationId,
        props.branchId,
      ).finally(() => router.refresh());
    };
    ping();
    const refresh = window.setInterval(ping, ms);
    const onVisible = () => {
      if (document.visibilityState === "visible") ping();
    };
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      if (tick) window.clearInterval(tick);
      window.clearInterval(refresh);
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [
    view,
    props.stockReady,
    props.organizationId,
    props.branchId,
    router,
  ]);

  const prevStockReady = useRef(props.stockReady);
  useEffect(() => {
    if (!prevStockReady.current && props.stockReady) {
      toast.success(
        props.stockCanOperate
          ? "Service stock ouvert."
          : "Le caissier a ouvert le service stock — vous pouvez vendre.",
      );
    }
    prevStockReady.current = props.stockReady;
  }, [props.stockReady, props.stockCanOperate]);

  function applyMatchedStay(stay: ActiveStay) {
    setStayId(stay.id);
    setTableLabel(`Ch. ${stay.room.number}`);
    setSettlementMode("NOTE_CHAMBRE");
  }

  function clearStayLink() {
    setStayId("");
    setSettlementMode("COMPTANT");
  }

  const suiviRows = useMemo(() => {
    const rows = suiviFilter === "pret" ? pretOrders : enCoursOrders;
    return [...rows].sort((a, b) => {
      if (suiviFilter === "pret") {
        const da = new Date(a.deliveredAt ?? a.updatedAt ?? a.createdAt ?? 0).getTime();
        const db = new Date(b.deliveredAt ?? b.updatedAt ?? b.createdAt ?? 0).getTime();
        return db - da;
      }
      const sa = new Date(a.sentAt ?? a.createdAt ?? 0).getTime();
      const sb = new Date(b.sentAt ?? b.createdAt ?? 0).getTime();
      if (sb !== sa) return sb - sa;
      return (STATUS_RANK[a.status] ?? 99) - (STATUS_RANK[b.status] ?? 99);
    });
  }, [suiviFilter, pretOrders, enCoursOrders]);

  const selected = useMemo(
    () => props.orders.find((o) => o.id === selectedId) ?? null,
    [props.orders, selectedId],
  );

  function send(mode: "COMPTANT" | "NOTE_CHAMBRE" = settlementMode) {
    const items = toPayload();
    if (!items.length) {
      toast.message("Ajoutez des articles");
      return;
    }
    if (mode === "NOTE_CHAMBRE" && !stayId) {
      toast.message("Sélectionnez un séjour pour la note de chambre");
      return;
    }
    const editingId = editingOrderId;
    start(async () => {
      try {
        if (editingId) {
          await updateHotelOrderAction({
            organizationId: props.organizationId,
            branchId: props.branchId,
            orderId: editingId,
            tableLabel: tableLabel.trim() || undefined,
            stayId: stayId || undefined,
            settlementMode: mode,
            items,
          });
          toast.success("Commande mise à jour");
        } else {
          await createHotelOrderAction({
            organizationId: props.organizationId,
            branchId: props.branchId,
            tableLabel: tableLabel.trim() || undefined,
            stayId: stayId || undefined,
            settlementMode: mode,
            items,
          });
          toast.success(
            mode === "NOTE_CHAMBRE"
              ? "Commande Sur note de chambre"
              : "Commande envoyée",
          );
        }
        clear();
        setEditingOrderId(null);
        router.refresh();
        setView("suivi");
        setSuiviFilter("en_cours");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erreur");
      }
    });
  }

  function startEdit(order: Order) {
    if (!canEditOrCancel(order)) {
      toast.message("Cette commande n’est plus modifiable");
      return;
    }
    const lines = [];
    let skipped = 0;
    for (const item of order.items) {
      if (!item.menuItemId) {
        skipped += 1;
        continue;
      }
      const menu = props.menuItems.find((m) => m.id === item.menuItemId);
      lines.push({
        menuItemId: item.menuItemId,
        name: item.name,
        price:
          item.unitPrice ??
          menu?.price ??
          item.amount / Math.max(1, item.quantity),
        quantity: item.quantity,
      });
    }
    if (!lines.length) {
      toast.error("Impossible de modifier — articles hors catalogue");
      return;
    }
    load(lines);
    setEditingOrderId(order.id);
    setTableLabel(order.tableLabel ?? "");
    setStayId(order.stayId ?? "");
    setSettlementMode(isOnNote(order) ? "NOTE_CHAMBRE" : "COMPTANT");
    setSelectedId(null);
    setView("commande");
    if (skipped > 0) {
      toast.message(`${skipped} article(s) hors catalogue ignoré(s)`);
    }
  }

  function stopEdit() {
    setEditingOrderId(null);
    clear();
  }

  function cancelOrder(orderId: string) {
    const order = props.orders.find((o) => o.id === orderId);
    if (!order || !canEditOrCancel(order)) {
      toast.message("Annulation impossible");
      return;
    }
    if (
      !window.confirm(
        `Annuler la commande ${order.tableLabel ?? `#${order.id.slice(0, 8)}`} ? Le stock sera rétabli.`,
      )
    ) {
      return;
    }
    start(async () => {
      try {
        await advanceHotelOrderAction({
          organizationId: props.organizationId,
          branchId: props.branchId,
          orderId,
          to: "ANNULEE",
        });
        toast.success("Commande annulée");
        setSelectedId(null);
        if (editingOrderId === orderId) stopEdit();
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erreur");
      }
    });
  }

  function markDelivered(orderId: string) {
    start(async () => {
      try {
        const order = props.orders.find((o) => o.id === orderId);
        const fromKitchen =
          order?.status === "ENVOYEE" || order?.status === "EN_PREPARATION";
        const onNote = order ? isOnNote(order) : false;
        await advanceHotelOrderAction({
          organizationId: props.organizationId,
          branchId: props.branchId,
          orderId,
          to: "LIVREE",
        });
        toast.success(
          onNote
            ? "Prêt · imputée à la note de chambre"
            : fromKitchen
              ? "Prêt — hors cuisine · encaissement en caisse"
              : order?.status === "PAYEE"
                ? "Prêt"
                : "Prêt — reste à encaisser en caisse",
        );
        setSelectedId(null);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erreur");
      }
    });
  }

  const enCoursCount = enCoursOrders.length;

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-5 px-3 py-5 sm:px-5 lg:px-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        {/* <div className="flex items-start gap-3">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-violet-500/15 text-violet-500">
            <UtensilsCrossed className="size-6" />
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Restauration</h1>
            <p className="text-sm text-muted-foreground">
              Serveur — commande tactile + suivi avec temps cuisine.
            </p>
          </div>
        </div> */}
        <div className="flex items-center gap-2">
          {view === "suivi" ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => router.refresh()}
            >
              <RefreshCw className="size-3.5" />
              Actualiser
            </Button>
          ) : null}
        </div>
      </header>

      <div className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-card p-1">
        {(
          [
            ["commande", "Nouvelle commande"],
            ["suivi", `Suivi (${enCoursCount})`],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setView(id)}
            className={cn(
              "shrink-0 rounded-lg px-3.5 py-2 text-sm font-medium transition",
              view === id
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
              id === "suivi" &&
                enCoursCount > 0 &&
                view !== "suivi" &&
                "ring-1 ring-primary/40",
            )}
          >
            {label}
            {id === "suivi" && enCoursCount > 0 && view !== "suivi" ? (
              <span className="ml-1.5 inline-flex min-w-5 justify-center rounded-full bg-primary/15 px-1.5 text-xs font-bold text-primary">
                {enCoursCount}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {props.stockCanOperate && props.stockForeignSession ? (
        <ServiceStockOpsPanel
          organizationId={props.organizationId}
          branchId={props.branchId}
          branchName={props.branchName}
          currentUserName={props.currentUserName}
          rate={props.rate ?? null}
          ready={false}
          session={null}
          foreignSession={props.stockForeignSession}
          title="Service stock à clôturer"
        />
      ) : null}

      {view === "commande" ? (
        <PosTerminal
          items={props.menuItems}
          cart={cart}
          onAdd={addItem}
          onSetQty={setQty}
          onClear={clear}
          formatPrice={fmt}
          formatLineTotal={fmtLine}
          formatCartTotal={fmtCart}
          ticketTitle={
            editingOrderId
              ? `Modifier #${editingOrderId.slice(0, 8)}`
              : "Ticket serveur"
          }
          emptyHint="Touchez un plat ou une boisson pour composer le ticket"
          ticketMeta={
            <div className="grid gap-3">
              <p className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <UserRound className="size-3.5" />
                Signé {props.currentUserName}
              </p>
              {editingOrderId ? (
                <div className="flex items-center justify-between gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs">
                  <span className="font-medium text-amber-800 dark:text-amber-200">
                    Modification en cours — cuisine et caisse seront notifiées
                  </span>
                  <Button
                    type="button"
                    size="xs"
                    variant="ghost"
                    onClick={stopEdit}
                  >
                    Abandonner
                  </Button>
                </div>
              ) : null}
              <div className="grid gap-1.5">
                <Label htmlFor="table">
                  {hasStays ? "Table / n° chambre" : "Table / Client"}
                </Label>
                <Input
                  id="table"
                  value={tableLabel}
                  onChange={(e) => {
                    const next = e.target.value;
                    setTableLabel(next);
                    if (stayId) {
                      const stay = activeStays.find((s) => s.id === stayId);
                      const stayLabel = stay
                        ? `Ch. ${stay.room.number}`
                        : "";
                      if (
                        stay &&
                        next.trim().toUpperCase() !== stayLabel.toUpperCase() &&
                        extractRoomNumber(next) !==
                          stay.room.number.trim().toUpperCase()
                      ) {
                        clearStayLink();
                      }
                    }
                  }}
                  placeholder={
                    hasStays ? "T1, 12, Ch. 101…" : "T1, bar…"
                  }
                />
                {hasStays ? (
                  <p className="text-[11px] text-muted-foreground">
                    Saisissez le n° de chambre pour lier un séjour actif.
                  </p>
                ) : null}
              </div>

              {roomMatchedStay && !stayId ? (
                <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-3 text-sm">
                  <p className="font-semibold text-amber-900 dark:text-amber-100">
                    Séjour check-in · ch. {roomMatchedStay.room.number}
                  </p>
                  <p className="mt-0.5 text-xs text-amber-800/90 dark:text-amber-200/90">
                    {roomMatchedStay.guestName} — lier à la note ou comptant
                  </p>
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      className="bg-amber-600 text-white hover:bg-amber-600/90"
                      onClick={() => applyMatchedStay(roomMatchedStay)}
                    >
                      Lier · Sur note
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setStayId(roomMatchedStay.id);
                        setTableLabel(`Ch. ${roomMatchedStay.room.number}`);
                        setSettlementMode("COMPTANT");
                      }}
                    >
                      Lier · Comptant
                    </Button>
                  </div>
                </div>
              ) : null}

              {roomLookup.status === "no_guest" && !stayId ? (
                <div className="rounded-xl border border-rose-500/35 bg-rose-500/10 px-3 py-3 text-sm">
                  <p className="font-semibold text-rose-800 dark:text-rose-200">
                    Aucun client check-in · ch. {roomLookup.roomNumber}
                  </p>
                  <p className="mt-0.5 text-xs text-rose-700/90 dark:text-rose-300/90">
                    La note de chambre n’est disponible que pour un séjour
                    occupé. Vérifiez le n° ou faites un check-in d’abord.
                  </p>
                </div>
              ) : null}

              {roomLookup.status === "no_checkins" && !stayId ? (
                <div className="rounded-xl border border-muted-foreground/25 bg-muted/40 px-3 py-3 text-sm">
                  <p className="font-semibold">Aucun client en séjour</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Pas de chambre check-in pour le moment — vente salle /
                    comptant uniquement.
                  </p>
                </div>
              ) : null}

              {selectedStay ? (
                <div className="grid gap-2 rounded-xl border border-sky-500/30 bg-sky-500/10 px-3 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">
                        Ch. {selectedStay.room.number} · {selectedStay.guestName}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Client en séjour — choisissez le règlement
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="xs"
                      variant="ghost"
                      onClick={clearStayLink}
                    >
                      Retirer
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-1 rounded-lg border border-border/60 bg-background/60 p-1">
                    {(
                      [
                        ["COMPTANT", "Comptant"],
                        ["NOTE_CHAMBRE", "Sur note"],
                      ] as const
                    ).map(([id, label]) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setSettlementMode(id)}
                        className={cn(
                          "rounded-md px-2 py-2 text-xs font-semibold transition",
                          settlementMode === id
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "text-muted-foreground hover:bg-muted",
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {settlementMode === "NOTE_CHAMBRE"
                      ? "Imputée à la note de chambre · solde au check-out"
                      : "Paiement immédiat en caisse"}
                  </p>
                </div>
              ) : hasStays && activeStays.length > 0 ? (
                <div className="grid gap-1.5">
                  <Label htmlFor="stay">Ou choisir un séjour check-in</Label>
                  <SearchCombobox
                    id="stay"
                    items={activeStays.map((s) => ({
                      value: s.id,
                      label: `Ch. ${s.room.number} · ${s.guestName}`,
                    }))}
                    value={stayId}
                    showClear
                    onValueChange={(next) => {
                      if (!next) {
                        clearStayLink();
                        return;
                      }
                      const stay = activeStays.find((s) => s.id === next);
                      if (stay) applyMatchedStay(stay);
                    }}
                    placeholder="Rechercher chambre / client…"
                    emptyText="Aucun séjour trouvé."
                  />
                </div>
              ) : hasStays ? (
                <p className="rounded-lg border border-dashed border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                  Aucun client check-in — impossible de lier une note de chambre
                  pour l’instant.
                </p>
              ) : null}
            </div>
          }
          actions={
            stayId ? (
              <PosChargeButton
                label={
                  editingOrderId
                    ? settlementMode === "NOTE_CHAMBRE"
                      ? "Enregistrer · Sur note"
                      : "Enregistrer · Comptant"
                    : settlementMode === "NOTE_CHAMBRE"
                      ? "Envoyer · Sur note de chambre"
                      : "Envoyer · Comptant"
                }
                pending={pending}
                disabled={cart.length === 0}
                onClick={() => send(settlementMode)}
              />
            ) : (
              <PosChargeButton
                label={
                  editingOrderId
                    ? "Enregistrer la modification"
                    : "Envoyer la commande"
                }
                pending={pending}
                disabled={cart.length === 0}
                onClick={() => send("COMPTANT")}
              />
            )
          }
        />
      ) : (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-semibold">Suivi des commandes</h2>
            <div className="flex gap-1 rounded-lg border border-border bg-muted/20 p-1">
              {(
                [
                  ["en_cours", `En cours (${enCoursOrders.length})`],
                  ["pret", `Prêt (${pretOrders.length})`],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setSuiviFilter(id)}
                  className={cn(
                    "rounded-md px-2.5 py-1.5 text-xs font-medium transition",
                    suiviFilter === id
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {suiviRows.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/50 px-6 py-16 text-center">
              <UtensilsCrossed className="mb-3 size-10 text-muted-foreground/50" />
              <p className="font-medium">
                {suiviFilter === "pret"
                  ? "Aucune commande prête"
                  : "Aucune commande en cours"}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {suiviFilter === "pret"
                  ? "Les commandes livrées à table s’afficheront ici."
                  : "Les tickets lancés apparaîtront ici jusqu’à la livraison."}
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {suiviRows.map((order) => {
                const meta = waiterPhaseMeta(order);
                const hint = kitchenHint(order.status);
                const isCooking = order.status === "EN_PREPARATION";
                const isDeliver =
                  canDeliver(order.status) && !isWaiterPret(order);
                const cd = isCooking
                  ? prepCountdown(
                      order.estimatedMinutes,
                      order.prepStartedAt,
                      now,
                    )
                  : null;
                const started = order.sentAt ?? order.createdAt;

                return (
                  <article
                    key={order.id}
                    className={cn(
                      "flex flex-col overflow-hidden rounded-2xl border bg-card shadow-sm transition",
                      isDeliver && "border-primary/50 ring-1 ring-primary/20",
                      cd?.overdue && "border-rose-500/60",
                      isCooking && !cd?.overdue && "border-orange-500/40",
                      !isDeliver && !isCooking && "border-border",
                    )}
                  >
                    <button
                      type="button"
                      className="flex flex-1 flex-col text-left"
                      onClick={() => setSelectedId(order.id)}
                    >
                      <header className="flex items-start justify-between gap-3 border-b border-border/80 px-4 py-3">
                        <div className="min-w-0">
                          <p className="truncate text-xl font-bold tracking-tight">
                            {order.tableLabel ?? "Salle"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            #{order.id.slice(0, 8)}
                            {order.createdByName
                              ? ` · ${order.createdByName}`
                              : ""}
                            {order.stay
                              ? ` · ${order.stay.guestName}${
                                  order.stay.room
                                    ? ` · ch. ${order.stay.room.number}`
                                    : ""
                                }`
                              : ""}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1.5">
                          {isOnNote(order) ? (
                            <span className="inline-flex rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:text-amber-200">
                              Sur note
                              {order.stay?.room
                                ? ` · Ch. ${order.stay.room.number}`
                                : ""}
                            </span>
                          ) : null}
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                              meta.tone,
                            )}
                          >
                            {isWaiterPret(order) ? (
                              <CheckCircle2 className="size-3" />
                            ) : isCooking ? (
                              <Flame className="size-3" />
                            ) : (
                              <Clock3 className="size-3" />
                            )}
                            {meta.label}
                          </span>
                          {hint && !isWaiterPret(order) ? (
                            <span className="text-[10px] font-medium text-muted-foreground">
                              {hint}
                            </span>
                          ) : null}
                          {started ? (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold tabular-nums text-muted-foreground">
                              <Clock3 className="size-3.5" />
                              {elapsedLabel(started, now)}
                            </span>
                          ) : null}
                        </div>
                      </header>

                      {cd ? (
                        <div
                          className={cn(
                            "flex items-center justify-between gap-2 border-b px-4 py-2.5 text-sm font-semibold tabular-nums",
                            cd.overdue
                              ? "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300"
                              : "border-orange-500/20 bg-orange-500/10 text-orange-800 dark:text-orange-200",
                          )}
                        >
                          <span className="inline-flex items-center gap-1.5">
                            <Timer className="size-3.5" />
                            {formatCountdownBanner(cd)}
                          </span>
                          <span className="text-xs font-medium opacity-80">
                            estimé {cd.totalMinutes} min
                          </span>
                        </div>
                      ) : order.status === "ENVOYEE" ? (
                        <div className="border-b border-sky-500/20 bg-sky-500/10 px-4 py-2 text-xs font-medium text-sky-800 dark:text-sky-200">
                          En attente cuisine — pas encore de temps estimé
                        </div>
                      ) : null}

                      <div className="flex-1 space-y-2 px-4 py-3">
                        {order.items.map((item, idx) => (
                          <div
                            key={`${order.id}-${item.name}-${idx}`}
                            className="flex items-center gap-3 rounded-xl bg-muted/35 px-3 py-2.5"
                          >
                            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-violet-500/15 text-base font-bold text-violet-700 tabular-nums dark:text-violet-300">
                              {item.quantity}
                            </span>
                            <span className="min-w-0 flex-1 text-sm font-semibold leading-snug">
                              {item.name}
                            </span>
                            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                              {fmtLine(
                                item.quantity,
                                item.unitPrice ??
                                  item.amount / Math.max(1, item.quantity),
                              )}
                            </span>
                          </div>
                        ))}
                        {order.serverNote ? (
                          <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-2 text-xs text-amber-800 dark:text-amber-200">
                            Note : {order.serverNote}
                          </p>
                        ) : null}
                      </div>
                    </button>

                    {canEditOrCancel(order) || isDeliver ? (
                      <footer className="space-y-2 border-t border-border p-3">
                        {canEditOrCancel(order) ? (
                          <div className="grid grid-cols-2 gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              className="gap-1.5"
                              disabled={pending}
                              onClick={() => startEdit(order)}
                            >
                              <Pencil className="size-4" />
                              Modifier
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              className="gap-1.5 text-rose-700 hover:text-rose-800 dark:text-rose-300"
                              disabled={pending}
                              onClick={() => cancelOrder(order.id)}
                            >
                              <Ban className="size-4" />
                              Annuler
                            </Button>
                          </div>
                        ) : null}
                        {isDeliver ? (
                          <Button
                            className="w-full gap-1.5"
                            disabled={pending}
                            onClick={() => markDelivered(order.id)}
                          >
                            <CheckCircle2 className="size-4" />
                            Prêt
                            {isCooking ? " (stop cuisine)" : ""}
                          </Button>
                        ) : null}
                      </footer>
                    ) : null}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}

      <Sheet
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}
      >
        <SheetContent className="flex w-full flex-col sm:max-w-md">
          {selected ? (
            <>
              <SheetHeader>
                <SheetTitle className="text-2xl">
                  {selected.tableLabel ?? "Salle"}
                </SheetTitle>
                <SheetDescription>
                  Ticket #{selected.id.slice(0, 8)} ·{" "}
                  {waiterPhaseMeta(selected).label}
                  {kitchenHint(selected.status) && !isWaiterPret(selected)
                    ? ` · ${kitchenHint(selected.status)}`
                    : ""}
                  {isOnNote(selected) ? " · Sur note de chambre" : ""}
                  {selected.createdByName
                    ? ` · Serveur ${selected.createdByName}`
                    : ""}
                </SheetDescription>
              </SheetHeader>

              <div className="flex-1 space-y-4 overflow-auto px-4 pb-2">
                {selected.status === "EN_PREPARATION"
                  ? (() => {
                      const cd = prepCountdown(
                        selected.estimatedMinutes,
                        selected.prepStartedAt,
                        now,
                      );
                      if (!cd) {
                        return (
                          <p className="rounded-xl bg-muted/30 px-3 py-3 text-sm text-muted-foreground">
                            Cuisine en cours — temps estimé non renseigné.
                          </p>
                        );
                      }
                      return (
                        <div
                          className={cn(
                            "rounded-xl px-3 py-4 text-center",
                            cd.overdue
                              ? "bg-rose-500/10 text-rose-700 dark:text-rose-300"
                              : "bg-orange-500/10 text-orange-800 dark:text-orange-200",
                          )}
                        >
                          <p className="text-xs font-semibold tracking-wide uppercase opacity-80">
                            Temps cuisine · {cd.totalMinutes} min
                          </p>
                          <p className="mt-1 text-4xl font-bold tabular-nums tracking-tight">
                            {cd.remainingLabel}
                          </p>
                          <p className="mt-1 text-sm font-medium">
                            {cd.overdue ? "En retard" : "Restant"}
                          </p>
                          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
                            <div
                              className={cn(
                                "h-full rounded-full transition-all",
                                cd.overdue ? "bg-rose-500" : "bg-orange-500",
                              )}
                              style={{
                                width: `${Math.min(100, cd.progress * 100)}%`,
                              }}
                            />
                          </div>
                        </div>
                      );
                    })()
                  : null}

                {selected.stay ? (
                  <div className="rounded-xl border border-border bg-muted/20 px-3 py-2 text-sm">
                    <p className="font-medium">{selected.stay.guestName}</p>
                    {selected.stay.room ? (
                      <p className="text-muted-foreground">
                        Chambre {selected.stay.room.number}
                      </p>
                    ) : null}
                  </div>
                ) : null}

                <div>
                  <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    Articles
                  </h3>
                  <ul className="space-y-2">
                    {selected.items.map((item, idx) => (
                      <li
                        key={`suivi-detail-${idx}`}
                        className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-3"
                      >
                        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 text-lg font-bold text-violet-700 tabular-nums dark:text-violet-300">
                          {item.quantity}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold">{item.name}</p>
                          <p className="text-xs text-muted-foreground tabular-nums">
                            {fmt(
                              item.unitPrice ??
                                item.amount / Math.max(1, item.quantity),
                            )}{" "}
                            / u.
                          </p>
                        </div>
                        <span className="font-semibold tabular-nums">
                          {fmtLine(
                            item.quantity,
                            item.unitPrice ??
                              item.amount / Math.max(1, item.quantity),
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                {selected.serverNote ? (
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-3 text-sm">
                    <p className="text-xs font-semibold tracking-wide text-amber-700 uppercase dark:text-amber-300">
                      Note
                    </p>
                    <p className="mt-1">{selected.serverNote}</p>
                  </div>
                ) : null}
              </div>

              {canEditOrCancel(selected) ||
              (canDeliver(selected.status) && !selected.deliveredAt) ? (
                <SheetFooter className="flex-col gap-2 border-t border-border sm:flex-col">
                  {canEditOrCancel(selected) ? (
                    <div className="grid w-full grid-cols-2 gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="lg"
                        className="gap-2"
                        disabled={pending}
                        onClick={() => startEdit(selected)}
                      >
                        <Pencil className="size-4" />
                        Modifier
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="lg"
                        className="gap-2 text-rose-700 hover:text-rose-800 dark:text-rose-300"
                        disabled={pending}
                        onClick={() => cancelOrder(selected.id)}
                      >
                        <Ban className="size-4" />
                        Annuler
                      </Button>
                    </div>
                  ) : null}
                  {canDeliver(selected.status) && !isWaiterPret(selected) ? (
                    <Button
                      size="lg"
                      className="w-full gap-2"
                      disabled={pending}
                      onClick={() => markDelivered(selected.id)}
                    >
                      <CheckCircle2 className="size-5" />
                      Prêt
                      {selected.status === "ENVOYEE" ||
                      selected.status === "EN_PREPARATION"
                        ? " — retire de la cuisine"
                        : ""}
                    </Button>
                  ) : null}
                </SheetFooter>
              ) : null}
            </>
          ) : null}
        </SheetContent>
      </Sheet>

      {props.stockCanOperate && !props.stockForeignSession ? (
        <ServiceStockOpsPanel
          organizationId={props.organizationId}
          branchId={props.branchId}
          branchName={props.branchName}
          currentUserName={props.currentUserName}
          rate={props.rate ?? null}
          ready={props.stockReady}
          session={props.stockSession}
          liveSituation={props.liveSituation}
          title="Stats service & fermeture restaurant"
        />
      ) : !props.stockCanOperate && props.stockReady && props.stockSession ? (
        <p className="text-xs text-muted-foreground">
          Stock service ouvert par {props.stockSession.vendorDisplayName} (
          {props.stockSession.number}) — vous vendez sur ce float.
        </p>
      ) : null}
    </div>
  );
}
