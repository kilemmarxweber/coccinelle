"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import {
  Banknote,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  Printer,
  Receipt,
  RefreshCw,
  ShoppingBag,
  Truck,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { ResponsiveDataTable } from "@/components/data-table/responsive-data-table";
import {
  PosChargeButton,
  PosPayMethodPicker,
  PosTerminal,
  usePosCart,
} from "@/components/pos/pos-terminal";
import {
  closeCashSessionAction,
  createPaymentAction,
  openCashSessionAction,
} from "@/lib/cash/actions";
import { createQuickSaleAction, advanceHotelOrderAction } from "@/lib/hotel/actions";
import { caisseRoutes } from "@/lib/branch/paths";
import {
  formatConfiguredRateLabel,
  formatPrimaryAmount,
  formatSecondaryAmount,
  isCdfPrimary,
} from "@/lib/cash/exchange";
import { cn } from "@/lib/utils";

type FolioRow = {
  id: string;
  label: string | null;
  balance: number;
  stay: {
    guestName: string;
    room: { number: string };
  } | null;
};

type OrderRow = {
  id: string;
  tableLabel: string | null;
  status: string;
  serverNote?: string | null;
  readyAt?: string | Date | null;
  sentAt?: string | Date | null;
  createdAt?: string | Date;
  deliveredAt?: string | Date | null;
  paidAt?: string | Date | null;
  items: {
    name: string;
    quantity: number;
    amount: number;
    unitPrice?: number;
    needsKitchen?: boolean;
  }[];
  stay?: {
    guestName: string;
    room?: { number: string } | null;
  } | null;
};

type MenuItem = {
  id: string;
  name: string;
  category: string;
  price: number;
  needsKitchen: boolean;
  imageUrl?: string | null;
  stockQty?: number;
};

type PaymentRow = {
  id: string;
  receiptNumber: string;
  amountCdf: number;
  amountForeign?: number | null;
  method: string;
  paidAt: string | Date;
  exchangeRateUsed: number | null;
};

type Props = {
  organizationId: string;
  branchId: string;
  branchName: string;
  cashSession: { id: string; openedAt: string | Date; openingFloat: number } | null;
  rate: {
    rate: number;
    fromCurrency: string;
    toCurrency: string;
    configuredFrom?: string;
    configuredTo?: string;
    configuredRate?: number;
  } | null;
  folios: FolioRow[];
  readyOrders: OrderRow[];
  todayPayments: PaymentRow[];
  menuItems: MenuItem[];
};

type HubTab = "fnb" | "vente" | "folios" | "paiements";

function folioLabel(f: FolioRow) {
  if (f.stay) return `${f.stay.guestName} · ch. ${f.stay.room.number}`;
  return f.label ?? "Folio";
}

function orderTotal(order: OrderRow) {
  return order.items.reduce((s, i) => s + i.amount, 0);
}

function elapsedLabel(from: string | Date | null | undefined, now: number) {
  if (!from) return "—";
  const mins = Math.floor(Math.max(0, now - new Date(from).getTime()) / 60000);
  if (mins < 1) return "< 1 min";
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)} h ${mins % 60} min`;
}

export function CaisseClient(props: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [float, setFloat] = useState("0");
  const [method, setMethod] = useState<"CASH" | "MOBILE_MONEY" | "CARTE">("CASH");
  const [tab, setTab] = useState<HubTab>("fnb");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [quickSaleLabel, setQuickSaleLabel] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [sessionDialogOpen, setSessionDialogOpen] = useState(!props.cashSession);
  const { cart, addItem, setQty, clear, toPayload } = usePosCart();

  useEffect(() => {
    if (!props.cashSession) setSessionDialogOpen(true);
  }, [props.cashSession]);

  useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), 30000);
    const refresh = window.setInterval(() => router.refresh(), 12000);
    return () => {
      window.clearInterval(tick);
      window.clearInterval(refresh);
    };
  }, [router]);

  const openFolios = useMemo(
    () => props.folios.filter((f) => f.balance > 0.01),
    [props.folios],
  );
  const caJour = useMemo(() => {
    return props.todayPayments.reduce(
      (acc, p) => {
        if (p.amountForeign != null && p.amountForeign > 0) {
          acc.usd += p.amountForeign;
          acc.cdf += p.amountCdf;
        } else if (props.rate && props.rate.rate > 0) {
          acc.usd += p.amountCdf;
          acc.cdf += p.amountCdf * props.rate.rate;
        } else {
          acc.usd += p.amountCdf;
          acc.cdf += p.amountCdf;
        }
        return acc;
      },
      { usd: 0, cdf: 0 },
    );
  }, [props.todayPayments, props.rate]);
  const readySorted = useMemo(
    () =>
      [...props.readyOrders].sort((a, b) => {
        const ta = new Date(a.readyAt ?? a.sentAt ?? a.createdAt ?? 0).getTime();
        const tb = new Date(b.readyAt ?? b.sentAt ?? b.createdAt ?? 0).getTime();
        return ta - tb;
      }),
    [props.readyOrders],
  );
  const selectedOrder = useMemo(
    () => readySorted.find((o) => o.id === selectedOrderId) ?? null,
    [readySorted, selectedOrderId],
  );

  const moneyRate = props.rate
    ? {
        rate: props.rate.rate,
        configuredFrom: props.rate.configuredFrom ?? props.rate.fromCurrency,
        configuredTo: props.rate.configuredTo ?? props.rate.toCurrency,
        configuredRate: props.rate.configuredRate ?? props.rate.rate,
      }
    : null;

  function fmt(amountUsd: number) {
    return formatPrimaryAmount(amountUsd, moneyRate);
  }

  function fmtSub(amountUsd: number) {
    return formatSecondaryAmount(amountUsd, moneyRate);
  }

  function openSession() {
    start(async () => {
      try {
        await openCashSessionAction({
          organizationId: props.organizationId,
          branchId: props.branchId,
          openingFloat: Number(float) || 0,
        });
        toast.success("Caisse ouverte");
        setSessionDialogOpen(false);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erreur");
      }
    });
  }

  function closeSession() {
    start(async () => {
      try {
        await closeCashSessionAction({
          organizationId: props.organizationId,
          branchId: props.branchId,
        });
        toast.success("Caisse clôturée");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erreur");
      }
    });
  }

  function payFolio(folioId: string, balanceUsd: number) {
    start(async () => {
      try {
        const amountCdf = props.rate
          ? balanceUsd * props.rate.rate
          : balanceUsd;
        const p = await createPaymentAction({
          organizationId: props.organizationId,
          branchId: props.branchId,
          folioId,
          amountCdf,
          amountForeign: balanceUsd,
          method,
        });
        toast.success(`Payé · ${p.receiptNumber}`);
        router.push(
          caisseRoutes.receipt(props.organizationId, props.branchId, p.id),
        );
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erreur");
      }
    });
  }

  function payOrder(orderId: string, totalUsd: number) {
    start(async () => {
      try {
        const amountCdf = props.rate ? totalUsd * props.rate.rate : totalUsd;
        const p = await createPaymentAction({
          organizationId: props.organizationId,
          branchId: props.branchId,
          orderId,
          amountCdf,
          amountForeign: totalUsd,
          method,
        });
        toast.success(`Encaissée · ${p.receiptNumber}`);
        setSelectedOrderId(null);
        router.push(
          caisseRoutes.receipt(props.organizationId, props.branchId, p.id),
        );
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erreur");
      }
    });
  }

  function deliverOrder(orderId: string) {
    start(async () => {
      try {
        const order = props.readyOrders.find((o) => o.id === orderId);
        const alreadyPaid =
          order?.status === "PAYEE" || order?.paidAt != null;
        const fromKitchen =
          order?.status === "ENVOYEE" || order?.status === "EN_PREPARATION";
        await advanceHotelOrderAction({
          organizationId: props.organizationId,
          branchId: props.branchId,
          orderId,
          to: "LIVREE",
        });
        toast.success(
          alreadyPaid
            ? "Livrée"
            : fromKitchen
              ? "Livrée — hors cuisine · reste à encaisser"
              : "Livrée — reste à encaisser & imprimer le reçu",
        );
        setSelectedOrderId(null);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erreur");
      }
    });
  }

  function quickSale() {
    const items = toPayload();
    if (!items.length) {
      toast.message("Sélectionnez des articles");
      return;
    }
    start(async () => {
      try {
        await createQuickSaleAction({
          organizationId: props.organizationId,
          branchId: props.branchId,
          items,
          tableLabel: quickSaleLabel.trim() || "Vente rapide",
        });
        toast.success("Ajoutée à la file F&B");
        clear();
        setQuickSaleLabel("");
        setTab("fnb");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erreur");
      }
    });
  }

  const folioColumns = useMemo<ColumnDef<FolioRow>[]>(
    () => [
      {
        accessorFn: (row) => folioLabel(row),
        id: "client",
        header: "Client / chambre",
        cell: ({ row }) => (
          <span className="font-medium">{folioLabel(row.original)}</span>
        ),
      },
      {
        accessorKey: "balance",
        header: "Solde",
        cell: ({ row }) => {
          const bal = row.original.balance;
          const sub = fmtSub(bal);
          return (
            <div className="text-right">
              <div className="font-semibold tabular-nums">{fmt(bal)}</div>
              {sub ? (
                <div className="text-xs text-muted-foreground tabular-nums">
                  ≈ {sub}
                </div>
              ) : null}
            </div>
          );
        },
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <Button
            size="sm"
            disabled={pending || !props.cashSession}
            onClick={() =>
              payFolio(row.original.id, row.original.balance)
            }
          >
            Encaisser
          </Button>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pending, props.cashSession, props.rate, method],
  );

  const paymentColumns = useMemo<ColumnDef<PaymentRow>[]>(
    () => [
      {
        accessorKey: "receiptNumber",
        header: "Reçu",
        cell: ({ row }) => (
          <span className="font-medium tabular-nums">
            {row.original.receiptNumber}
          </span>
        ),
      },
      {
        accessorKey: "amountCdf",
        header: "Montant",
        cell: ({ row }) => {
          const usd =
            row.original.amountForeign != null && row.original.amountForeign > 0
              ? row.original.amountForeign
              : props.rate && props.rate.rate > 0
                ? row.original.amountCdf / props.rate.rate
                : row.original.amountCdf;
          return (
            <div className="text-right">
              <span className="font-medium tabular-nums">{fmt(usd)}</span>
              {fmtSub(usd) ? (
                <span className="block text-xs text-muted-foreground tabular-nums">
                  {fmtSub(usd)}
                </span>
              ) : null}
            </div>
          );
        },
      },
      {
        accessorKey: "method",
        header: "Mode",
        cell: ({ row }) => <Badge variant="outline">{row.original.method}</Badge>,
      },
      {
        accessorKey: "paidAt",
        header: "Heure",
        cell: ({ row }) =>
          new Date(row.original.paidAt).toLocaleTimeString("fr-FR"),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            render={
              <Link
                href={caisseRoutes.receipt(
                  props.organizationId,
                  props.branchId,
                  row.original.id,
                )}
              />
            }
          >
            <Printer className="size-3.5" />
            Reçu
          </Button>
        ),
      },
    ],
    [props.organizationId, props.branchId],
  );

  const stats = [
    {
      label: "Session",
      value: props.cashSession ? "Ouverte" : "Fermée",
      sub: null as string | null,
      tone: props.cashSession
        ? "text-emerald-600 dark:text-emerald-400"
        : "text-muted-foreground",
    },
    {
      label: "Folios",
      value: String(openFolios.length),
      sub: null,
      tone: "text-foreground",
    },
    {
      label: "F&B prêts",
      value: String(props.readyOrders.length),
      sub: null,
      tone: "text-foreground",
    },
    {
      label: "CA du jour",
      value: isCdfPrimary(moneyRate)
        ? `${caJour.cdf.toLocaleString("fr-FR", {
            maximumFractionDigits: 0,
          })} CDF`
        : `${caJour.usd.toFixed(2)} $`,
      sub: props.rate
        ? isCdfPrimary(moneyRate)
          ? `${caJour.usd.toFixed(2)} $`
          : `${caJour.cdf.toLocaleString("fr-FR", {
              maximumFractionDigits: 0,
            })} CDF`
        : null,
      tone: "text-foreground",
    },
  ];

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-5 px-3 py-5 sm:px-5 lg:px-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Wallet className="size-6" />
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Caisse & Ventes</h1>
            <p className="text-sm text-muted-foreground">{props.branchName}</p>
            {props.rate && moneyRate ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Taux : {formatConfiguredRateLabel(moneyRate)}
                {isCdfPrimary(moneyRate)
                  ? ` · (1 USD = ${props.rate.rate.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} CDF)`
                  : ` · (1 CDF ≈ ${(1 / props.rate.rate).toLocaleString("fr-FR", { maximumFractionDigits: 6 })} USD)`}
              </p>
            ) : (
              <p className="mt-1 text-xs text-amber-600">
                Aucun taux — configurez Taux de Change.
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {props.cashSession ? (
            <>
              <Badge variant="default" className="gap-1.5 px-2.5 py-1">
                Session ouverte · fond {props.cashSession.openingFloat}
              </Badge>
              <Button
                variant="destructive"
                size="sm"
                disabled={pending}
                onClick={closeSession}
              >
                Clôturer
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              className="gap-1.5"
              onClick={() => setSessionDialogOpen(true)}
            >
              <Banknote className="size-4" />
              Ouvrir la session
            </Button>
          )}
        </div>
      </header>

      <Dialog
        open={sessionDialogOpen && !props.cashSession}
        onOpenChange={(open) => {
          if (!props.cashSession) setSessionDialogOpen(open);
        }}
      >
        <DialogContent className="sm:max-w-md" showCloseButton>
          <DialogHeader>
            <DialogTitle>Ouvrir la session de caisse</DialogTitle>
            <DialogDescription>
              Indiquez le fond d’ouverture (0 ou autre montant) avant
              d’encaisser.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <Label htmlFor="float">Fond d’ouverture</Label>
            <Input
              id="float"
              value={float}
              onChange={(e) => setFloat(e.target.value)}
              type="number"
              min={0}
              step="0.01"
              autoFocus
              placeholder="0"
            />
            <div className="flex flex-wrap gap-2 pt-1">
              {["0", "50", "100", "200"].map((preset) => (
                <Button
                  key={preset}
                  type="button"
                  size="sm"
                  variant={float === preset ? "default" : "outline"}
                  onClick={() => setFloat(preset)}
                >
                  {preset}
                </Button>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button
              disabled={pending}
              onClick={openSession}
              className="gap-2 sm:w-full"
              size="lg"
            >
              <Banknote className="size-4" />
              Confirmer l’ouverture
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-2xl border border-border bg-card px-4 py-3 shadow-sm"
          >
            <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
              {s.label}
            </p>
            <p className={cn("mt-1 text-xl font-bold tracking-tight", s.tone)}>
              {s.value}
            </p>
            {s.sub ? (
              <p className="mt-0.5 text-xs font-medium text-muted-foreground tabular-nums">
                {s.sub}
              </p>
            ) : null}
          </div>
        ))}
      </section>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-card p-1">
          {(
            [
              ["fnb", `F&B (${props.readyOrders.length})`, CircleDollarSign],
              ["vente", "Vente rapide", ShoppingBag],
              ["folios", `Folios (${openFolios.length})`, Receipt],
              ["paiements", "Paiements", Printer],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium transition",
                tab === id
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
                id === "fnb" &&
                  props.readyOrders.length > 0 &&
                  tab !== "fnb" &&
                  "ring-1 ring-primary/40",
              )}
            >
              <Icon className="size-3.5" />
              {label}
            </button>
          ))}
        </div>
        {tab === "fnb" ? (
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

      {tab === "fnb" ? (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">File F&B — caisse</h2>
              <p className="text-sm text-muted-foreground">
                Encaisser (vert) après Livrer (jaune) — la livraison doit être
                faite avant l’encaissement.
              </p>
            </div>
            <PosPayMethodPicker
              value={method}
              onChange={setMethod}
              className="w-full max-w-xs"
            />
          </div>

          {readySorted.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/50 px-6 py-14 text-center">
              <CircleDollarSign className="mb-3 size-10 text-muted-foreground/50" />
              <p className="font-medium">Aucune commande en file F&B</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Vente rapide et tickets cuisine prêts apparaîtront ici.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {readySorted.map((order) => {
                const total = orderTotal(order);
                const waited = order.readyAt ?? order.sentAt ?? order.createdAt;
                const isPaid = order.status === "PAYEE";
                const isEnCours = order.status === "EN_CAISSE";
                const alreadyServed = !!order.deliveredAt && !isPaid;
                const inKitchen =
                  order.status === "ENVOYEE" ||
                  order.status === "EN_PREPARATION";
                const canMarkDelivered =
                  !order.deliveredAt && order.status !== "LIVREE";
                // Encaisser seulement après livraison
                const canPay =
                  !isPaid &&
                  order.status !== "LIVREE" &&
                  !!order.deliveredAt;
                const statusLabel = isPaid
                  ? "À livrer"
                  : alreadyServed
                    ? "Livrée · à encaisser"
                    : isEnCours
                      ? "En cours"
                      : inKitchen
                        ? order.status === "EN_PREPARATION"
                          ? "Cuisine"
                          : "Envoyée"
                        : "Prêt";
                return (
                  <article
                    key={order.id}
                    className={cn(
                      "flex flex-col overflow-hidden rounded-2xl border bg-card shadow-sm",
                      isPaid
                        ? "border-primary/40 ring-1 ring-primary/15"
                        : alreadyServed
                          ? "border-amber-500/50 ring-1 ring-amber-500/20"
                          : inKitchen
                            ? "border-orange-500/40 ring-1 ring-orange-500/10"
                            : isEnCours
                              ? "border-sky-500/40 ring-1 ring-sky-500/10"
                              : "border-emerald-500/30 ring-1 ring-emerald-500/10",
                    )}
                  >
                    <button
                      type="button"
                      className="flex flex-1 flex-col text-left"
                      onClick={() => setSelectedOrderId(order.id)}
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
                            className={cn(
                              isPaid && "bg-primary text-primary-foreground",
                              alreadyServed &&
                                "bg-amber-600 text-white hover:bg-amber-600",
                              isEnCours &&
                                !alreadyServed &&
                                "bg-sky-600 text-white hover:bg-sky-600",
                              inKitchen &&
                                "bg-orange-600 text-white hover:bg-orange-600",
                              !isPaid &&
                                !alreadyServed &&
                                !isEnCours &&
                                !inKitchen &&
                                "bg-emerald-600 text-white hover:bg-emerald-600",
                            )}
                          >
                            {statusLabel}
                          </Badge>
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground tabular-nums">
                            <Clock3 className="size-3.5" />
                            {elapsedLabel(waited, now)}
                          </span>
                        </div>
                      </header>

                      <div className="flex-1 space-y-2 px-4 py-3">
                        {order.items.map((item, idx) => (
                          <div
                            key={`${order.id}-${item.name}-${idx}`}
                            className="flex items-center gap-3 rounded-xl bg-muted/35 px-3 py-2.5"
                          >
                            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-base font-bold text-emerald-700 tabular-nums dark:text-emerald-400">
                              {item.quantity}
                            </span>
                            <span className="min-w-0 flex-1 text-sm font-semibold leading-snug">
                              {item.name}
                            </span>
                            <span className="shrink-0 text-sm font-medium tabular-nums text-muted-foreground">
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

                      <div className="flex items-center justify-between gap-2 border-t border-dashed border-border px-4 py-2.5">
                        <span className="text-sm text-muted-foreground">Total</span>
                        <span className="text-lg font-bold tabular-nums">
                          {fmt(total)}
                        </span>
                      </div>
                    </button>

                    <footer className="mt-auto grid grid-cols-2 gap-2 border-t border-border p-3">
                      <Button
                        className="gap-1.5 bg-amber-500 text-white hover:bg-amber-500/90"
                        disabled={pending || !canMarkDelivered}
                        onClick={() => deliverOrder(order.id)}
                      >
                        <Truck className="size-4" />
                        Livrer
                      </Button>
                      <Button
                        className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-600/90"
                        disabled={pending || !canPay || !props.cashSession}
                        onClick={() => payOrder(order.id, total)}
                        title={
                          !order.deliveredAt
                            ? "Livrer d’abord avant d’encaisser"
                            : undefined
                        }
                      >
                        <CheckCircle2 className="size-4" />
                        Encaisser
                      </Button>
                    </footer>
                  </article>
                );
              })}
            </div>
          )}

          <Sheet
            open={!!selectedOrder}
            onOpenChange={(open) => {
              if (!open) setSelectedOrderId(null);
            }}
          >
            <SheetContent className="flex w-full flex-col sm:max-w-md">
              {selectedOrder ? (
                <>
                  <SheetHeader>
                    <SheetTitle className="text-2xl">
                      {selectedOrder.tableLabel ?? "Salle"}
                    </SheetTitle>
                    <SheetDescription>
                      Ticket #{selectedOrder.id.slice(0, 8)} ·{" "}
                      {selectedOrder.status === "EN_CAISSE"
                        ? "en cours"
                        : selectedOrder.status === "PAYEE"
                          ? "à livrer"
                          : "prêt"}{" "}
                      ·{" "}
                      {elapsedLabel(
                        selectedOrder.readyAt ??
                          selectedOrder.sentAt ??
                          selectedOrder.createdAt,
                        now,
                      )}
                    </SheetDescription>
                  </SheetHeader>

                  <div className="flex-1 space-y-4 overflow-auto px-4 pb-2">
                    {selectedOrder.stay ? (
                      <div className="rounded-xl border border-border bg-muted/20 px-3 py-2 text-sm">
                        <p className="font-medium">
                          {selectedOrder.stay.guestName}
                        </p>
                        {selectedOrder.stay.room ? (
                          <p className="text-muted-foreground">
                            Chambre {selectedOrder.stay.room.number}
                          </p>
                        ) : null}
                      </div>
                    ) : null}

                    <div>
                      <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                        Détail commande
                      </h3>
                      <ul className="space-y-2">
                        {selectedOrder.items.map((item, idx) => (
                          <li
                            key={`fnb-detail-${idx}`}
                            className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-3"
                          >
                            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-lg font-bold text-emerald-700 tabular-nums dark:text-emerald-400">
                              {item.quantity}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold">{item.name}</p>
                              <p className="text-xs text-muted-foreground tabular-nums">
                                {fmt(
                                  item.unitPrice ??
                                    item.amount / item.quantity,
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

                    {selectedOrder.serverNote ? (
                      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-3 text-sm">
                        <p className="text-xs font-semibold tracking-wide text-amber-700 uppercase dark:text-amber-300">
                          Note serveur
                        </p>
                        <p className="mt-1">{selectedOrder.serverNote}</p>
                      </div>
                    ) : null}

                    <div className="flex items-center justify-between rounded-xl bg-muted/30 px-3 py-3">
                      <span className="font-medium">
                        {selectedOrder.status === "PAYEE"
                          ? "Déjà payé"
                          : "Total à encaisser"}
                      </span>
                      <span className="text-xl font-bold tabular-nums">
                        {fmt(orderTotal(selectedOrder))}
                      </span>
                    </div>

                    {selectedOrder.status !== "PAYEE" ? (
                      <PosPayMethodPicker value={method} onChange={setMethod} />
                    ) : null}
                  </div>

                  <SheetFooter className="grid grid-cols-2 gap-2 border-t border-border sm:flex-row">
                    <Button
                      size="lg"
                      className="gap-2 bg-amber-500 text-white hover:bg-amber-500/90"
                      disabled={
                        pending ||
                        !!selectedOrder.deliveredAt ||
                        selectedOrder.status === "LIVREE"
                      }
                      onClick={() => deliverOrder(selectedOrder.id)}
                    >
                      <Truck className="size-5" />
                      Livrer
                    </Button>
                    <Button
                      size="lg"
                      className="gap-2 bg-emerald-600 text-white hover:bg-emerald-600/90"
                      disabled={
                        pending ||
                        !props.cashSession ||
                        selectedOrder.status === "PAYEE" ||
                        selectedOrder.status === "LIVREE" ||
                        !selectedOrder.deliveredAt
                      }
                      onClick={() =>
                        payOrder(selectedOrder.id, orderTotal(selectedOrder))
                      }
                      title={
                        !selectedOrder.deliveredAt
                          ? "Livrer d’abord avant d’encaisser"
                          : undefined
                      }
                    >
                      <CheckCircle2 className="size-5" />
                      Encaisser
                    </Button>
                  </SheetFooter>
                </>
              ) : null}
            </SheetContent>
          </Sheet>
        </section>
      ) : null}

      {tab === "vente" ? (
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <ShoppingBag className="size-4 text-primary" />
              <div>
                <h2 className="font-semibold">Vente rapide — tous les produits</h2>
                <p className="text-xs text-muted-foreground">
                  Statut « en cours » — visible resto & caisse. Ordre : Livrer
                  (jaune) puis Encaisser (vert).
                </p>
              </div>
            </div>
          </div>
          <PosTerminal
            items={props.menuItems}
            cart={cart}
            onAdd={addItem}
            onSetQty={setQty}
            onClear={clear}
            ticketTitle="Ticket vente rapide"
            emptyHint="Touchez un produit pour l’ajouter au ticket"
            formatPrice={fmt}
            ticketMeta={
              <div className="grid gap-1.5">
                <Label htmlFor="quick-sale-label">Table / client</Label>
                <Input
                  id="quick-sale-label"
                  value={quickSaleLabel}
                  onChange={(e) => setQuickSaleLabel(e.target.value)}
                  placeholder="T1, Comptoir, Jean…"
                />
              </div>
            }
            actions={
              <PosChargeButton
                label="Envoyer à la file F&B"
                pending={pending}
                disabled={cart.length === 0}
                onClick={quickSale}
              />
            }
          />
        </div>
      ) : null}

      {tab === "folios" ? (
        <section className="space-y-4 rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-semibold">Folios à encaisser</h2>
            <PosPayMethodPicker
              value={method}
              onChange={setMethod}
              className="w-full max-w-xs"
            />
          </div>
          <ResponsiveDataTable
            columns={folioColumns}
            data={openFolios}
            emptyText="Aucun solde ouvert."
            mobileCardTitle={(row) => folioLabel(row)}
            mobileCardSubtitle={(row) => fmt(row.balance)}
            mobileCardActions={(row) => (
              <Button
                size="sm"
                disabled={pending || !props.cashSession}
                onClick={() => payFolio(row.id, row.balance)}
              >
                Encaisser
              </Button>
            )}
          />
        </section>
      ) : null}

      {tab === "paiements" ? (
        <section className="space-y-4 rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
          <h2 className="font-semibold">Paiements du jour</h2>
          <ResponsiveDataTable
            columns={paymentColumns}
            data={props.todayPayments}
            emptyText="Aucun paiement aujourd’hui."
            mobileCardTitle={(row) => row.receiptNumber}
            mobileCardSubtitle={(row) => {
              const usd =
                row.amountForeign != null && row.amountForeign > 0
                  ? row.amountForeign
                  : props.rate && props.rate.rate > 0
                    ? row.amountCdf / props.rate.rate
                    : row.amountCdf;
              return `${fmt(usd)} · ${row.method}`;
            }}
            mobileCardActions={(row) => (
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                render={
                  <Link
                    href={caisseRoutes.receipt(
                      props.organizationId,
                      props.branchId,
                      row.id,
                    )}
                  />
                }
              >
                <Printer className="size-3.5" />
                Reçu
              </Button>
            )}
          />
        </section>
      ) : null}
    </div>
  );
}
