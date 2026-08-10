"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  CheckCircle2,
  Clock3,
  Flame,
  RefreshCw,
  Timer,
  Truck,
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
} from "@/lib/hotel/actions";
import { ORDER_SETTLEMENT } from "@/lib/hotel/folio-note";
import {
  extractRoomNumber,
  lookupRoomStay,
} from "@/lib/hotel/stay-room-match";
import {
  formatPrimaryAmount,
  type NormalizedUsdCdfRate,
} from "@/lib/cash/exchange";
import {
  elapsedLabel,
  formatCountdownBanner,
  prepCountdown,
} from "@/lib/hotel/order-time";
import { SearchCombobox } from "@/components/ui/search-combobox";
import { cn } from "@/lib/utils";

type MenuItem = {
  id: string;
  name: string;
  category: string;
  price: number;
  needsKitchen: boolean;
  imageUrl?: string | null;
  stockQty?: number;
};

type OrderItem = {
  name: string;
  quantity: number;
  amount: number;
  needsKitchen?: boolean;
  unitPrice?: number;
};

type Order = {
  id: string;
  tableLabel: string | null;
  status: string;
  settlementMode?: string | null;
  postedToFolioAt?: string | Date | null;
  serverNote?: string | null;
  sentAt?: string | Date | null;
  prepStartedAt?: string | Date | null;
  estimatedMinutes?: number | null;
  readyAt?: string | Date | null;
  deliveredAt?: string | Date | null;
  createdAt?: string | Date;
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
  PAYEE: 0,
  PRETE: 1,
  EN_CAISSE: 2,
  EN_PREPARATION: 3,
  ENVOYEE: 4,
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

const STATUS_META: Record<
  string,
  { label: string; tone: string }
> = {
  ENVOYEE: { label: "Envoyée", tone: "bg-sky-500/15 text-sky-700 dark:text-sky-300" },
  EN_PREPARATION: {
    label: "En cuisine",
    tone: "bg-orange-500/15 text-orange-800 dark:text-orange-200",
  },
  PRETE: { label: "Prête", tone: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  EN_CAISSE: {
    label: "En cours",
    tone: "bg-sky-500/15 text-sky-800 dark:text-sky-200",
  },
  PAYEE: { label: "À livrer", tone: "bg-primary/15 text-primary" },
  LIVREE: { label: "Livrée", tone: "bg-muted text-muted-foreground" },
};

function isOnNote(order: Order) {
  return order.settlementMode === ORDER_SETTLEMENT.NOTE_CHAMBRE;
}

export function RestaurationClient(props: {
  organizationId: string;
  branchId: string;
  menuItems: MenuItem[];
  orders: Order[];
  activeStays?: ActiveStay[];
  hasStays?: boolean;
  rate?: NormalizedUsdCdfRate | null;
  initialView?: "commande" | "suivi";
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
  const toDeliverCount = props.orders.filter(
    (o) => canDeliver(o.status) && !o.deliveredAt,
  ).length;
  const [view, setView] = useState<"commande" | "suivi">(
    props.initialView === "suivi" || toDeliverCount > 0 ? "suivi" : "commande",
  );
  const [suiviFilter, setSuiviFilter] = useState<"actives" | "livrer" | "toutes">(
    "actives",
  );
  const { cart, addItem, setQty, clear, toPayload } = usePosCart();

  const toDeliver = useMemo(
    () =>
      props.orders.filter((o) => canDeliver(o.status) && !o.deliveredAt),
    [props.orders],
  );
  const activeOrders = useMemo(
    () =>
      props.orders.filter(
        (o) =>
          o.status !== "LIVREE" &&
          o.status !== "ANNULEE" &&
          !o.deliveredAt,
      ),
    [props.orders],
  );

  useEffect(() => {
    if (searchParams.get("view") === "suivi") {
      setView("suivi");
      setSuiviFilter("actives");
    }
    const orderId = searchParams.get("orderId");
    if (orderId) {
      setView("suivi");
      setSuiviFilter("actives");
      setSelectedId(orderId);
    }
  }, [searchParams]);

  useEffect(() => {
    setNow(Date.now());
  }, []);

  useEffect(() => {
    if (view !== "suivi") return;
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    const refresh = window.setInterval(() => router.refresh(), 12000);
    return () => {
      window.clearInterval(tick);
      window.clearInterval(refresh);
    };
  }, [view, router]);

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
    let rows = props.orders;
    if (suiviFilter === "actives") {
      rows = activeOrders;
    } else if (suiviFilter === "livrer") {
      rows = toDeliver;
    }
    return [...rows].sort(
      (a, b) =>
        (STATUS_RANK[a.status] ?? 99) - (STATUS_RANK[b.status] ?? 99),
    );
  }, [props.orders, suiviFilter, activeOrders, toDeliver]);

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
    start(async () => {
      try {
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
        clear();
        router.refresh();
        setView("suivi");
        setSuiviFilter("actives");
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
            ? "Livrée · imputée à la note de chambre"
            : fromKitchen
              ? "Livrée — hors cuisine · encaissement en caisse"
              : order?.status === "PAYEE"
                ? "Livrée"
                : "Livrée — reste à encaisser en caisse",
        );
        setSelectedId(null);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erreur");
      }
    });
  }

  const enCoursCount = activeOrders.length;

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-5 px-3 py-5 sm:px-5 lg:px-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-violet-500/15 text-violet-500">
            <UtensilsCrossed className="size-6" />
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Restauration</h1>
            <p className="text-sm text-muted-foreground">
              Serveur — commande tactile + suivi avec temps cuisine.
            </p>
          </div>
        </div>
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

      {view === "commande" ? (
        <PosTerminal
          items={props.menuItems}
          cart={cart}
          onAdd={addItem}
          onSetQty={setQty}
          onClear={clear}
          formatPrice={fmt}
          ticketTitle="Ticket serveur"
          emptyHint="Touchez un plat ou une boisson pour composer le ticket"
          ticketMeta={
            <div className="grid gap-3">
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
                  settlementMode === "NOTE_CHAMBRE"
                    ? "Envoyer · Sur note de chambre"
                    : "Envoyer · Comptant"
                }
                pending={pending}
                disabled={cart.length === 0}
                onClick={() => send(settlementMode)}
              />
            ) : (
              <PosChargeButton
                label="Envoyer la commande"
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
                  ["actives", `En cours (${activeOrders.length})`],
                  ["livrer", `À livrer (${toDeliver.length})`],
                  ["toutes", "Toutes"],
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
                {suiviFilter === "livrer"
                  ? "Aucune commande à livrer"
                  : "Aucune commande pour le moment"}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Les tickets envoyés apparaîtront ici avec le temps cuisine.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {suiviRows.map((order) => {
                const meta = STATUS_META[order.status] ?? {
                  label: order.status,
                  tone: "bg-muted text-muted-foreground",
                };
                const isCooking = order.status === "EN_PREPARATION";
                const isDeliver = canDeliver(order.status) && !order.deliveredAt;
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
                            {isCooking ? (
                              <Flame className="size-3" />
                            ) : isDeliver ? (
                              <Truck className="size-3" />
                            ) : null}
                            {meta.label}
                          </span>
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
                              {fmt(item.amount)}
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

                    {isDeliver ? (
                      <footer className="border-t border-border p-3">
                        <Button
                          className="w-full gap-1.5"
                          disabled={pending}
                          onClick={() => markDelivered(order.id)}
                        >
                          <CheckCircle2 className="size-4" />
                          Livrer
                          {isCooking ? " (stop cuisine)" : ""}
                        </Button>
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
                  {STATUS_META[selected.status]?.label ?? selected.status}
                  {isOnNote(selected) ? " · Sur note de chambre" : ""}
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
                          {fmt(item.amount)}
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

              {canDeliver(selected.status) && !selected.deliveredAt ? (
                <SheetFooter className="border-t border-border">
                  <Button
                    size="lg"
                    className="w-full gap-2"
                    disabled={pending}
                    onClick={() => markDelivered(selected.id)}
                  >
                    <CheckCircle2 className="size-5" />
                    Livrer
                    {selected.status === "ENVOYEE" ||
                    selected.status === "EN_PREPARATION"
                      ? " — retire de la cuisine"
                      : ""}
                  </Button>
                </SheetFooter>
              ) : null}
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
