"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  ChefHat,
  Clock3,
  Flame,
  RefreshCw,
  Timer,
  UtensilsCrossed,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { advanceHotelOrderAction } from "@/lib/hotel/actions";
import {
  elapsedLabel,
  formatCountdownBanner,
  prepCountdown,
  urgencyTone,
} from "@/lib/hotel/order-time";
import { cn } from "@/lib/utils";

const ESTIMATE_PRESETS = [5, 10, 15, 20, 30, 45];

type OrderItem = {
  name: string;
  quantity: number;
  needsKitchen: boolean;
  unitPrice?: number;
  amount?: number;
};

type Order = {
  id: string;
  tableLabel: string | null;
  status: string;
  serverNote: string | null;
  sentAt: string | Date | null;
  prepStartedAt?: string | Date | null;
  estimatedMinutes?: number | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  items: OrderItem[];
  stay?: { guestName: string; room?: { number: string } | null } | null;
};

export function CuisineClient(props: {
  organizationId: string;
  branchId: string;
  orders: Order[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [filter, setFilter] = useState<"all" | "ENVOYEE" | "EN_PREPARATION">(
    "all",
  );
  const [prepOrderId, setPrepOrderId] = useState<string | null>(null);
  const [estimateMins, setEstimateMins] = useState("15");

  useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    const refresh = window.setInterval(() => router.refresh(), 15000);
    return () => {
      window.clearInterval(tick);
      window.clearInterval(refresh);
    };
  }, [router]);

  const selected = useMemo(
    () => props.orders.find((o) => o.id === selectedId) ?? null,
    [props.orders, selectedId],
  );
  const prepOrder = useMemo(
    () => props.orders.find((o) => o.id === prepOrderId) ?? null,
    [props.orders, prepOrderId],
  );

  const filtered = useMemo(() => {
    const list =
      filter === "all"
        ? props.orders
        : props.orders.filter((o) => o.status === filter);
    return [...list].sort((a, b) => {
      const ta = new Date(a.sentAt ?? a.createdAt).getTime();
      const tb = new Date(b.sentAt ?? b.createdAt).getTime();
      return ta - tb;
    });
  }, [props.orders, filter]);

  const counts = useMemo(
    () => ({
      all: props.orders.length,
      ENVOYEE: props.orders.filter((o) => o.status === "ENVOYEE").length,
      EN_PREPARATION: props.orders.filter((o) => o.status === "EN_PREPARATION")
        .length,
    }),
    [props.orders],
  );

  function openPrepDialog(orderId: string) {
    setEstimateMins("15");
    setPrepOrderId(orderId);
  }

  function confirmPrep() {
    if (!prepOrderId) return;
    const mins = Math.round(Number(estimateMins));
    if (!Number.isFinite(mins) || mins < 1 || mins > 180) {
      toast.error("Temps estimé : entre 1 et 180 minutes");
      return;
    }
    start(async () => {
      try {
        await advanceHotelOrderAction({
          organizationId: props.organizationId,
          branchId: props.branchId,
          orderId: prepOrderId,
          to: "EN_PREPARATION",
          estimatedMinutes: mins,
        });
        toast.success(`En préparation · ~${mins} min`);
        setPrepOrderId(null);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erreur");
      }
    });
  }

  function markReady(orderId: string) {
    start(async () => {
      try {
        await advanceHotelOrderAction({
          organizationId: props.organizationId,
          branchId: props.branchId,
          orderId,
          to: "PRETE",
        });
        toast.success("Prêt — notifié caisse");
        setSelectedId(null);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erreur");
      }
    });
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-5 px-3 py-5 sm:px-5 lg:px-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-orange-500/15 text-orange-500">
            <ChefHat className="size-6" />
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Cuisine</h1>
            <p className="text-sm text-muted-foreground">
              Au clic « Préparer », indiquez le temps estimé — le serveur le
              voit en décompte.
            </p>
          </div>
        </div>
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
      </header>

      <div className="grid grid-cols-3 gap-2 sm:max-w-md">
        {(
          [
            ["all", "File", counts.all],
            ["ENVOYEE", "Nouvelles", counts.ENVOYEE],
            ["EN_PREPARATION", "En cours", counts.EN_PREPARATION],
          ] as const
        ).map(([id, label, count]) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilter(id)}
            className={cn(
              "rounded-xl border px-3 py-2.5 text-left transition",
              filter === id
                ? "border-primary bg-primary/10 shadow-sm"
                : "border-border bg-card hover:bg-muted/40",
            )}
          >
            <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
              {label}
            </p>
            <p className="text-xl font-bold tabular-nums">{count}</p>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/50 px-6 py-16 text-center">
          <ChefHat className="mb-3 size-10 text-muted-foreground/50" />
          <p className="font-medium">Aucune commande en cuisine</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Les tickets envoyés par le serveur apparaîtront ici.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((order) => {
            const kitchenItems = order.items.filter((i) => i.needsKitchen);
            const sideItems = order.items.filter((i) => !i.needsKitchen);
            const started = order.sentAt ?? order.createdAt;
            const tone = urgencyTone(started, now);
            const isCooking = order.status === "EN_PREPARATION";
            const cd = isCooking
              ? prepCountdown(order.estimatedMinutes, order.prepStartedAt, now)
              : null;

            return (
              <article
                key={order.id}
                className={cn(
                  "flex flex-col overflow-hidden rounded-2xl border bg-card shadow-sm transition",
                  tone === "critical" &&
                    "border-rose-500/60 ring-1 ring-rose-500/30",
                  tone === "warn" && "border-amber-500/50",
                  tone === "normal" && "border-border",
                  isCooking && "bg-orange-500/[0.04]",
                  cd?.overdue && "border-rose-500/70",
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
                      <Badge
                        variant={isCooking ? "default" : "secondary"}
                        className="gap-1"
                      >
                        {isCooking ? (
                          <Flame className="size-3" />
                        ) : (
                          <UtensilsCrossed className="size-3" />
                        )}
                        {isCooking ? "En cours" : "Nouvelle"}
                      </Badge>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 text-xs font-semibold tabular-nums",
                          tone === "critical" && "text-rose-600",
                          tone === "warn" && "text-amber-600",
                          tone === "normal" && "text-muted-foreground",
                        )}
                      >
                        <Clock3 className="size-3.5" />
                        {elapsedLabel(started, now)}
                      </span>
                    </div>
                  </header>

                  {cd ? (
                    <div
                      className={cn(
                        "flex items-center justify-between gap-2 border-b px-4 py-2 text-sm font-semibold tabular-nums",
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
                        ~{cd.totalMinutes} min
                      </span>
                    </div>
                  ) : null}

                  <div className="flex-1 space-y-2 px-4 py-3">
                    {kitchenItems.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Aucun article cuisine.
                      </p>
                    ) : (
                      kitchenItems.map((item, idx) => (
                        <div
                          key={`${order.id}-${item.name}-${idx}`}
                          className="flex items-center gap-3 rounded-xl bg-muted/35 px-3 py-2.5"
                        >
                          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-orange-500/15 text-base font-bold text-orange-600 tabular-nums">
                            {item.quantity}
                          </span>
                          <span className="min-w-0 flex-1 text-sm font-semibold leading-snug">
                            {item.name}
                          </span>
                        </div>
                      ))
                    )}
                    {sideItems.length > 0 ? (
                      <p className="pt-1 text-xs text-muted-foreground">
                        + hors cuisine :{" "}
                        {sideItems
                          .map((i) => `${i.quantity}× ${i.name}`)
                          .join(", ")}
                      </p>
                    ) : null}
                    {order.serverNote ? (
                      <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-2 text-xs text-amber-800 dark:text-amber-200">
                        Note : {order.serverNote}
                      </p>
                    ) : null}
                  </div>
                </button>

                <footer className="sticky bottom-0 z-10 mt-auto flex gap-2 border-t border-border bg-card p-3">
                  {order.status === "ENVOYEE" ? (
                    <Button
                      className="flex-1"
                      variant="outline"
                      disabled={pending}
                      onClick={() => openPrepDialog(order.id)}
                    >
                      Préparer
                    </Button>
                  ) : null}
                  <Button
                    className={cn(
                      "flex-1 gap-1.5",
                      cd?.overdue && "ring-2 ring-rose-500/50",
                    )}
                    variant={cd?.overdue ? "destructive" : "default"}
                    disabled={pending}
                    onClick={() => markReady(order.id)}
                  >
                    <CheckCircle2 className="size-4" />
                    {cd?.overdue ? "C’est prêt (en retard)" : "C’est prêt"}
                  </Button>
                </footer>
              </article>
            );
          })}
        </div>
      )}

      <Dialog
        open={!!prepOrder}
        onOpenChange={(open) => {
          if (!open) setPrepOrderId(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Temps estimé</DialogTitle>
            <DialogDescription>
              {prepOrder
                ? `${prepOrder.tableLabel ?? "Salle"} — combien de minutes pour cette commande ? Le serveur verra le décompte.`
                : null}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="flex flex-wrap gap-2">
              {ESTIMATE_PRESETS.map((m) => (
                <Button
                  key={m}
                  type="button"
                  size="sm"
                  variant={estimateMins === String(m) ? "default" : "outline"}
                  onClick={() => setEstimateMins(String(m))}
                >
                  {m} min
                </Button>
              ))}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="estimate-mins">Minutes</Label>
              <Input
                id="estimate-mins"
                type="number"
                min={1}
                max={180}
                value={estimateMins}
                onChange={(e) => setEstimateMins(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPrepOrderId(null)}
              disabled={pending}
            >
              Annuler
            </Button>
            <Button disabled={pending} onClick={confirmPrep}>
              Démarrer · {estimateMins || "?"} min
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                  {selected.status === "EN_PREPARATION"
                    ? "En préparation"
                    : "Nouvelle commande"}{" "}
                  · {elapsedLabel(selected.sentAt ?? selected.createdAt, now)}
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
                      if (!cd) return null;
                      return (
                        <div
                          className={cn(
                            "rounded-xl px-3 py-3 text-center",
                            cd.overdue
                              ? "bg-rose-500/10 text-rose-700 dark:text-rose-300"
                              : "bg-orange-500/10 text-orange-800 dark:text-orange-200",
                          )}
                        >
                          <p className="text-xs font-semibold tracking-wide uppercase opacity-80">
                            Temps estimé {cd.totalMinutes} min
                          </p>
                          <p className="mt-1 text-3xl font-bold tabular-nums">
                            {formatCountdownBanner(cd)}
                          </p>
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
                    Articles cuisine
                  </h3>
                  <ul className="space-y-2">
                    {selected.items
                      .filter((i) => i.needsKitchen)
                      .map((item, idx) => (
                        <li
                          key={`detail-k-${idx}`}
                          className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-3"
                        >
                          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-orange-500/15 text-lg font-bold text-orange-600 tabular-nums">
                            {item.quantity}
                          </span>
                          <div className="min-w-0">
                            <p className="font-semibold">{item.name}</p>
                            <p className="text-xs text-muted-foreground">
                              À préparer
                            </p>
                          </div>
                        </li>
                      ))}
                  </ul>
                </div>

                {selected.items.some((i) => !i.needsKitchen) ? (
                  <div>
                    <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                      Hors cuisine (info)
                    </h3>
                    <ul className="space-y-1.5 text-sm text-muted-foreground">
                      {selected.items
                        .filter((i) => !i.needsKitchen)
                        .map((item, idx) => (
                          <li key={`detail-s-${idx}`}>
                            {item.quantity}× {item.name}
                          </li>
                        ))}
                    </ul>
                  </div>
                ) : null}

                {selected.serverNote ? (
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-3 text-sm">
                    <p className="text-xs font-semibold tracking-wide text-amber-700 uppercase dark:text-amber-300">
                      Note serveur
                    </p>
                    <p className="mt-1">{selected.serverNote}</p>
                  </div>
                ) : null}

                <p className="text-xs text-muted-foreground">
                  Reçue à{" "}
                  {new Date(
                    selected.sentAt ?? selected.createdAt,
                  ).toLocaleTimeString("fr-FR")}
                </p>
              </div>

              <SheetFooter className="sticky bottom-0 z-10 gap-2 border-t border-border bg-background sm:flex-col">
                {selected.status === "ENVOYEE" ? (
                  <Button
                    size="lg"
                    variant="outline"
                    className="w-full"
                    disabled={pending}
                    onClick={() => openPrepDialog(selected.id)}
                  >
                    Commencer la préparation
                  </Button>
                ) : null}
                {(() => {
                  const cd =
                    selected.status === "EN_PREPARATION"
                      ? prepCountdown(
                          selected.estimatedMinutes,
                          selected.prepStartedAt,
                          now,
                        )
                      : null;
                  return (
                    <Button
                      size="lg"
                      className={cn(
                        "w-full gap-2",
                        cd?.overdue && "ring-2 ring-rose-500/50",
                      )}
                      variant={cd?.overdue ? "destructive" : "default"}
                      disabled={pending}
                      onClick={() => markReady(selected.id)}
                    >
                      <CheckCircle2 className="size-5" />
                      {cd?.overdue
                        ? "Valider — c’est prêt (en retard)"
                        : "Valider — c’est prêt"}
                    </Button>
                  );
                })()}
              </SheetFooter>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
