"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
  UserRound,
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
import {
  extractRoomNumber,
  lookupRoomStay,
} from "@/lib/hotel/stay-room-match";
import { caisseRoutes } from "@/lib/branch/paths";
import {
  formatConfiguredRateLabel,
  formatPrimaryAmount,
  formatSecondaryAmount,
  formatUsdLineTotal,
  formatUsdLinesTotal,
  isCdfPrimary,
} from "@/lib/cash/exchange";
import { SearchCombobox } from "@/components/ui/search-combobox";
import { cn } from "@/lib/utils";
import {
  ServiceStockOpsPanel,
  type ServiceStockOpsHistoryRow,
  type ServiceStockOpsSession,
} from "@/components/hotel/service-stock-ops-panel";

type FolioRow = {
  id: string;
  label: string | null;
  balance: number;
  inCheckoutQueue?: boolean;
  checkoutQueuedAt?: string | Date | null;
  stay: {
    guestName: string;
    room: { number: string };
  } | null;
  lines?: { kind: string; amount: number; description: string }[];
};

type OrderRow = {
  id: string;
  tableLabel: string | null;
  status: string;
  serverNote?: string | null;
  createdByName?: string | null;
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
  barcode?: string | null;
};

type ActiveStay = {
  id: string;
  guestName: string;
  room: { number: string };
  folio: { id: string } | null;
};

type PaymentRow = {
  id: string;
  receiptNumber: string;
  amountCdf: number;
  amountForeign?: number | null;
  method: string;
  paidAt: string | Date;
  exchangeRateUsed: number | null;
  note?: string | null;
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
  activeStays?: ActiveStay[];
  hasStays?: boolean;
  hasRestaurant?: boolean;
  currentUserName?: string;
  stockReady?: boolean;
  stockSession?: ServiceStockOpsSession | null;
  stockHistory?: ServiceStockOpsHistoryRow[];
};

type HubTab = "fnb" | "vente" | "folios" | "paiements";

function folioLabel(f: FolioRow) {
  if (f.stay) return `${f.stay.guestName} · ch. ${f.stay.room.number}`;
  return f.label ?? "Note de chambre";
}

function orderTotal(order: OrderRow) {
  return order.items.reduce((s, i) => s + i.amount, 0);
}

function orderUnit(item: { unitPrice?: number; amount: number; quantity: number }) {
  return item.unitPrice ?? item.amount / Math.max(1, item.quantity);
}

function elapsedLabel(from: string | Date | null | undefined, now: number | null) {
  if (now == null || !from) return "—";
  const mins = Math.floor(Math.max(0, now - new Date(from).getTime()) / 60000);
  if (mins < 1) return "< 1 min";
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)} h ${mins % 60} min`;
}

function defaultHubTab(hasStays: boolean, hasRestaurant: boolean): HubTab {
  if (hasRestaurant) return "fnb";
  if (hasStays) return "folios";
  return "paiements";
}

function parseHubTab(
  raw: string | null,
  hasStays: boolean,
  hasRestaurant: boolean,
): HubTab {
  if (raw === "fnb" && hasRestaurant) return "fnb";
  if (raw === "vente" && hasRestaurant) return "vente";
  if (raw === "folios" && hasStays) return "folios";
  if (raw === "paiements") return "paiements";
  return defaultHubTab(hasStays, hasRestaurant);
}

export function CaisseClient(props: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, start] = useTransition();
  const [float, setFloat] = useState("0");
  const [method, setMethod] = useState<
    "CASH" | "MOBILE_MONEY" | "CARTE" | "BANK"
  >("CASH");
  const hasStays = props.hasStays !== false;
  const hasRestaurant = props.hasRestaurant !== false;
  const [tab, setTab] = useState<HubTab>(() =>
    parseHubTab(searchParams.get("tab"), hasStays, hasRestaurant),
  );
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [folioPayId, setFolioPayId] = useState<string | null>(null);
  const [folioPayAmount, setFolioPayAmount] = useState("");
  const [quickSaleLabel, setQuickSaleLabel] = useState("");
  const [quickStayId, setQuickStayId] = useState("");
  const [quickSettlementMode, setQuickSettlementMode] = useState<
    "COMPTANT" | "NOTE_CHAMBRE"
  >("COMPTANT");
  const [now, setNow] = useState<number | null>(null);
  const [sessionDialogOpen, setSessionDialogOpen] = useState(!props.cashSession);
  const { cart, addItem, setQty, clear, toPayload } = usePosCart();

  const activeStays = props.activeStays ?? [];
  const quickRoomLookup = useMemo(() => {
    if (!hasStays || quickStayId) return { status: "idle" as const };
    return lookupRoomStay(activeStays, quickSaleLabel);
  }, [hasStays, quickStayId, activeStays, quickSaleLabel]);
  const quickRoomMatched =
    quickRoomLookup.status === "matched" ? quickRoomLookup.stay : null;
  const quickSelectedStay = useMemo(
    () => activeStays.find((s) => s.id === quickStayId) ?? null,
    [activeStays, quickStayId],
  );

  function applyQuickStay(stay: ActiveStay, mode: "COMPTANT" | "NOTE_CHAMBRE") {
    setQuickStayId(stay.id);
    setQuickSaleLabel(`Ch. ${stay.room.number}`);
    setQuickSettlementMode(mode);
  }

  function clearQuickStay() {
    setQuickStayId("");
    setQuickSettlementMode("COMPTANT");
  }

  useEffect(() => {
    if (!props.cashSession) setSessionDialogOpen(true);
  }, [props.cashSession]);

  useEffect(() => {
    const fromUrl = searchParams.get("tab");
    if (fromUrl) {
      setTab(parseHubTab(fromUrl, hasStays, hasRestaurant));
    }
  }, [searchParams, hasStays, hasRestaurant]);

  useEffect(() => {
    // File d’attente check-out : ouvrir l’onglet notes, sans auto-ouvrir le paiement.
    if (!hasStays) return;
    if (searchParams.get("queue") === "1" || searchParams.get("tab") === "folios") {
      setTab("folios");
    }
  }, [searchParams, hasStays]);

  useEffect(() => {
    setNow(Date.now());
    const tick = window.setInterval(() => setNow(Date.now()), 30000);
    const refresh = window.setInterval(() => router.refresh(), 12000);
    return () => {
      window.clearInterval(tick);
      window.clearInterval(refresh);
    };
  }, [router]);

  const openFolios = useMemo(() => {
    const open = props.folios.filter(
      (f) => f.balance > 0.01 || f.balance < -0.01 || f.inCheckoutQueue,
    );
    return [...open].sort((a, b) => {
      const aq = a.inCheckoutQueue ? 1 : 0;
      const bq = b.inCheckoutQueue ? 1 : 0;
      if (aq !== bq) return bq - aq;
      const at = a.checkoutQueuedAt
        ? new Date(a.checkoutQueuedAt).getTime()
        : 0;
      const bt = b.checkoutQueuedAt
        ? new Date(b.checkoutQueuedAt).getTime()
        : 0;
      return at - bt;
    });
  }, [props.folios]);
  const checkoutQueue = useMemo(
    () => openFolios.filter((f) => f.inCheckoutQueue),
    [openFolios],
  );
  const otherOpenFolios = useMemo(
    () => openFolios.filter((f) => !f.inCheckoutQueue),
    [openFolios],
  );
  const folioPayTarget = useMemo(
    () => openFolios.find((f) => f.id === folioPayId) ?? null,
    [openFolios, folioPayId],
  );
  const caJour = useMemo(() => {
    return props.todayPayments.reduce(
      (acc, p) => {
        const note = (p.note ?? "").toLowerCase();
        // Caution / remboursement caution ≠ CA ventes
        if (
          note.includes("caution consommation") ||
          note.startsWith("remboursement caution")
        ) {
          return acc;
        }
        if (p.amountForeign != null && p.amountForeign !== 0) {
          acc.usd += p.amountForeign;
          acc.cdf += p.amountCdf;
        } else if (props.rate && props.rate.rate > 0) {
          acc.usd += p.amountCdf / props.rate.rate;
          acc.cdf += p.amountCdf;
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

  function fmtLine(quantity: number, unitUsd: number) {
    return formatUsdLineTotal(quantity, unitUsd, moneyRate);
  }

  function fmtCart(lines: { quantity: number; price: number }[]) {
    return formatUsdLinesTotal(
      lines.map((l) => ({ quantity: l.quantity, unitPriceUsd: l.price })),
      moneyRate,
    );
  }

  function fmtOrder(order: OrderRow) {
    return formatUsdLinesTotal(
      order.items.map((i) => ({
        quantity: i.quantity,
        unitPriceUsd: orderUnit(i),
      })),
      moneyRate,
    );
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

  function openFolioPay(folioId: string, balanceUsd: number) {
    setFolioPayId(folioId);
    setFolioPayAmount(Math.abs(balanceUsd).toFixed(2));
  }

  function payFolio(folioId: string, amountUsd: number, isPartial: boolean) {
    start(async () => {
      try {
        if (!(amountUsd > 0)) throw new Error("Montant invalide.");
        const target = props.folios.find((f) => f.id === folioId);
        const isRefund = (target?.balance ?? 0) < -0.01;
        const signedUsd = isRefund ? -amountUsd : amountUsd;
        const amountCdf = props.rate
          ? signedUsd * props.rate.rate
          : signedUsd;
        const hasDepositLine = (target?.lines ?? []).some(
          (l: { kind: string }) => l.kind === "DEPOSIT",
        );
        const p = await createPaymentAction({
          organizationId: props.organizationId,
          branchId: props.branchId,
          folioId,
          amountCdf,
          amountForeign: signedUsd,
          method,
          isRefund,
          note: isRefund
            ? hasDepositLine
              ? "Remboursement caution consommation"
              : "Remboursement départ anticipé"
            : isPartial
              ? "Acompte note de chambre"
              : "Règlement note de chambre",
        });
        toast.success(
          isRefund
            ? `Remboursé · ${p.receiptNumber}`
            : isPartial
              ? `Acompte · ${p.receiptNumber}`
              : `Payé · ${p.receiptNumber}`,
        );
        setFolioPayId(null);
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

  function quickSale(mode: "COMPTANT" | "NOTE_CHAMBRE" = quickSettlementMode) {
    const items = toPayload();
    if (!items.length) {
      toast.message("Sélectionnez des articles");
      return;
    }
    if (mode === "NOTE_CHAMBRE" && !quickStayId) {
      toast.message("Sélectionnez un séjour pour la note de chambre");
      return;
    }
    start(async () => {
      try {
        const res = await createQuickSaleAction({
          organizationId: props.organizationId,
          branchId: props.branchId,
          items,
          tableLabel: quickSaleLabel.trim() || undefined,
          stayId: quickStayId || undefined,
          settlementMode: mode,
        });
        clear();
        setQuickSaleLabel("");
        clearQuickStay();
        if (res.onNote) {
          toast.success("Imputée à la note de chambre");
          setTab("folios");
        } else {
          toast.success("Ajoutée à la file F&B");
          setTab("fnb");
        }
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
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{folioLabel(row.original)}</span>
            {row.original.inCheckoutQueue ? (
              <Badge variant="secondary" className="gap-1">
                <Clock3 className="size-3" />
                Check-out
              </Badge>
            ) : null}
          </div>
        ),
      },
      {
        accessorKey: "balance",
        header: "Solde",
        cell: ({ row }) => {
          const bal = row.original.balance;
          const sub = fmtSub(Math.abs(bal));
          return (
            <div className="text-right">
              <div
                className={cn(
                  "font-semibold tabular-nums",
                  bal < -0.01 && "text-amber-700 dark:text-amber-400",
                )}
              >
                {bal < -0.01 ? `À remb. ${fmt(Math.abs(bal))}` : fmt(bal)}
              </div>
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
              openFolioPay(row.original.id, row.original.balance)
            }
          >
            {row.original.balance < -0.01 ? "Rembourser" : "Encaisser"}
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
      label: "Notes chambre",
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
              hasRestaurant
                ? (["fnb", `F&B (${props.readyOrders.length})`, CircleDollarSign] as const)
                : null,
              hasRestaurant
                ? (["vente", "Vente rapide", ShoppingBag] as const)
                : null,
              hasStays
                ? ([
                    "folios",
                    checkoutQueue.length > 0
                      ? `File (${checkoutQueue.length})`
                      : `Notes (${openFolios.length})`,
                    Receipt,
                  ] as const)
                : null,
              ["paiements", "Paiements", Printer] as const,
            ] as const
          )
            .filter((x): x is NonNullable<typeof x> => x != null)
            .map(([id, label, Icon]) => (
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
                            {order.stay?.room
                              ? `Ch. ${order.stay.room.number}`
                              : (order.tableLabel ?? "Salle")}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            #{order.id.slice(0, 8)}
                            {order.stay ? ` · ${order.stay.guestName} · séjour` : ""}
                          </p>
                          {order.createdByName ? (
                            <p className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-foreground/80">
                              <UserRound className="size-3" />
                              Serveur {order.createdByName}
                            </p>
                          ) : null}
                          {order.stay ? (
                            <span className="mt-1 inline-flex rounded-full bg-sky-500/15 px-2 py-0.5 text-[11px] font-semibold text-sky-800 dark:text-sky-200">
                              Client en chambre
                            </span>
                          ) : null}
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
                              {fmtLine(item.quantity, orderUnit(item))}
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
                          {fmtOrder(order)}
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
                      {selectedOrder.createdByName
                        ? ` · Serveur ${selectedOrder.createdByName}`
                        : ""}
                    </SheetDescription>
                  </SheetHeader>

                  <div className="flex-1 space-y-4 overflow-auto px-4 pb-2">
                    {selectedOrder.stay ? (
                      <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 px-3 py-2.5 text-sm">
                        <p className="text-[11px] font-semibold tracking-wide text-sky-800 uppercase dark:text-sky-200">
                          Client en chambre
                        </p>
                        <p className="mt-1 font-medium">
                          {selectedOrder.stay.guestName}
                          {selectedOrder.stay.room
                            ? ` · ch. ${selectedOrder.stay.room.number}`
                            : ""}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Paiement comptant (file F&B) — la note de chambre se
                          règle dans l’onglet Notes.
                        </p>
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
                                {fmt(orderUnit(item))} / u.
                              </p>
                            </div>
                            <span className="font-semibold tabular-nums">
                              {fmtLine(item.quantity, orderUnit(item))}
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
                        {fmtOrder(selectedOrder)}
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
                  {hasStays
                    ? "Comptant → file F&B · Sur note → imputée à la note de chambre"
                    : "Statut « en cours » — Livrer puis Encaisser dans la file F&B."}
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
            formatLineTotal={fmtLine}
            formatCartTotal={fmtCart}
            ticketMeta={
              <div className="grid gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="quick-sale-label">
                    {hasStays ? "Table / n° chambre" : "Table / client"}
                  </Label>
                  <Input
                    id="quick-sale-label"
                    value={quickSaleLabel}
                    onChange={(e) => {
                      const next = e.target.value;
                      setQuickSaleLabel(next);
                      if (quickStayId) {
                        const stay = activeStays.find((s) => s.id === quickStayId);
                        if (
                          stay &&
                          extractRoomNumber(next) !==
                            stay.room.number.trim().toUpperCase() &&
                          next.trim().toUpperCase() !==
                            `CH. ${stay.room.number}`.toUpperCase()
                        ) {
                          clearQuickStay();
                        }
                      }
                    }}
                    placeholder={
                      hasStays ? "T1, 12, Ch. 101…" : "T1, Comptoir, Jean…"
                    }
                  />
                  {hasStays ? (
                    <p className="text-[11px] text-muted-foreground">
                      Saisissez le n° de chambre pour lier un séjour actif.
                    </p>
                  ) : null}
                </div>

                {quickRoomMatched && !quickStayId ? (
                  <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-3 text-sm">
                    <p className="font-semibold text-amber-900 dark:text-amber-100">
                      Séjour check-in · ch. {quickRoomMatched.room.number}
                    </p>
                    <p className="mt-0.5 text-xs text-amber-800/90 dark:text-amber-200/90">
                      {quickRoomMatched.guestName} — mode de règlement
                    </p>
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        className="bg-amber-600 text-white hover:bg-amber-600/90"
                        onClick={() =>
                          applyQuickStay(quickRoomMatched, "NOTE_CHAMBRE")
                        }
                      >
                        Lier · Sur note
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          applyQuickStay(quickRoomMatched, "COMPTANT")
                        }
                      >
                        Lier · Comptant
                      </Button>
                    </div>
                  </div>
                ) : null}

                {quickRoomLookup.status === "no_guest" && !quickStayId ? (
                  <div className="rounded-xl border border-rose-500/35 bg-rose-500/10 px-3 py-3 text-sm">
                    <p className="font-semibold text-rose-800 dark:text-rose-200">
                      Aucun client check-in · ch. {quickRoomLookup.roomNumber}
                    </p>
                    <p className="mt-0.5 text-xs text-rose-700/90 dark:text-rose-300/90">
                      Impossible de lier une note — chambre libre ou pas encore
                      check-in.
                    </p>
                  </div>
                ) : null}

                {quickRoomLookup.status === "no_checkins" && !quickStayId ? (
                  <div className="rounded-xl border border-muted-foreground/25 bg-muted/40 px-3 py-3 text-sm">
                    <p className="font-semibold">Aucun client en séjour</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Pas de chambre check-in — vente comptoir / comptant
                      uniquement.
                    </p>
                  </div>
                ) : null}

                {quickSelectedStay ? (
                  <div className="grid gap-2 rounded-xl border border-sky-500/30 bg-sky-500/10 px-3 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">
                          Ch. {quickSelectedStay.room.number} ·{" "}
                          {quickSelectedStay.guestName}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          Client en séjour
                        </p>
                      </div>
                      <Button
                        type="button"
                        size="xs"
                        variant="ghost"
                        onClick={clearQuickStay}
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
                          onClick={() => setQuickSettlementMode(id)}
                          className={cn(
                            "rounded-md px-2 py-2 text-xs font-semibold transition",
                            quickSettlementMode === id
                              ? "bg-primary text-primary-foreground shadow-sm"
                              : "text-muted-foreground hover:bg-muted",
                          )}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {quickSettlementMode === "NOTE_CHAMBRE"
                        ? "Ajoutée directement à la note · solde au check-out"
                        : "File F&B — livrer puis encaisser"}
                    </p>
                  </div>
                ) : hasStays && activeStays.length > 0 ? (
                  <div className="grid gap-1.5">
                    <Label htmlFor="quick-stay">Ou choisir un séjour check-in</Label>
                    <SearchCombobox
                      id="quick-stay"
                      items={activeStays.map((s) => ({
                        value: s.id,
                        label: `Ch. ${s.room.number} · ${s.guestName}`,
                      }))}
                      value={quickStayId}
                      showClear
                      onValueChange={(next) => {
                        if (!next) {
                          clearQuickStay();
                          return;
                        }
                        const stay = activeStays.find((s) => s.id === next);
                        if (stay) applyQuickStay(stay, "NOTE_CHAMBRE");
                      }}
                      placeholder="Rechercher chambre / client…"
                      emptyText="Aucun séjour trouvé."
                    />
                  </div>
                ) : hasStays ? (
                  <p className="rounded-lg border border-dashed border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                    Aucun client check-in — impossible de lier une note de
                    chambre pour l’instant.
                  </p>
                ) : null}
              </div>
            }
            actions={
              quickStayId ? (
                <PosChargeButton
                  label={
                    quickSettlementMode === "NOTE_CHAMBRE"
                      ? "Imputer à la note de chambre"
                      : "Envoyer · Comptant (file F&B)"
                  }
                  pending={pending}
                  disabled={cart.length === 0}
                  onClick={() => quickSale(quickSettlementMode)}
                />
              ) : (
                <PosChargeButton
                  label="Envoyer à la file F&B"
                  pending={pending}
                  disabled={cart.length === 0}
                  onClick={() => quickSale("COMPTANT")}
                />
              )
            }
          />
        </div>
      ) : null}

      {tab === "folios" ? (
        <section className="space-y-4 rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">Notes de chambre</h2>
              <p className="text-xs text-muted-foreground">
                File d’attente check-out en tête · acompte ou solde total
              </p>
            </div>
            <PosPayMethodPicker
              value={method}
              onChange={setMethod}
              className="w-full max-w-xs"
            />
          </div>

          {checkoutQueue.length > 0 ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Clock3 className="size-4 text-amber-700" />
                <h3 className="text-sm font-semibold">
                  File d’attente check-out ({checkoutQueue.length})
                </h3>
              </div>
              <ResponsiveDataTable
                columns={folioColumns}
                data={checkoutQueue}
                emptyText="Aucune note en file d’attente."
                mobileCardTitle={(row) => folioLabel(row)}
                mobileCardSubtitle={(row) =>
                  row.balance < -0.01
                    ? `À remb. ${fmt(Math.abs(row.balance))}`
                    : fmt(row.balance)
                }
                mobileCardActions={(row) => (
                  <Button
                    size="sm"
                    disabled={pending || !props.cashSession}
                    onClick={() => openFolioPay(row.id, row.balance)}
                  >
                    {row.balance < -0.01 ? "Rembourser" : "Encaisser"}
                  </Button>
                )}
              />
            </div>
          ) : null}

          <div className="space-y-2">
            {checkoutQueue.length > 0 ? (
              <h3 className="text-sm font-semibold text-muted-foreground">
                Autres notes ouvertes
              </h3>
            ) : null}
            <ResponsiveDataTable
              columns={folioColumns}
              data={otherOpenFolios}
              emptyText={
                checkoutQueue.length > 0
                  ? "Aucune autre note ouverte."
                  : "Aucune note ouverte avec solde."
              }
              mobileCardTitle={(row) => folioLabel(row)}
              mobileCardSubtitle={(row) =>
                row.balance < -0.01
                  ? `À remb. ${fmt(Math.abs(row.balance))}`
                  : fmt(row.balance)
              }
              mobileCardActions={(row) => (
                <Button
                  size="sm"
                  disabled={pending || !props.cashSession}
                  onClick={() => openFolioPay(row.id, row.balance)}
                >
                  {row.balance < -0.01 ? "Rembourser" : "Encaisser"}
                </Button>
              )}
            />
          </div>
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

      <Dialog
        open={!!folioPayTarget}
        onOpenChange={(open) => {
          if (!open) setFolioPayId(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {folioPayTarget && folioPayTarget.balance < -0.01
                ? "Remboursement note de chambre"
                : "Règlement note de chambre"}
            </DialogTitle>
            <DialogDescription>
              {folioPayTarget
                ? folioPayTarget.balance < -0.01
                  ? `${folioLabel(folioPayTarget)} — à rembourser ${Math.abs(folioPayTarget.balance).toFixed(2)} $ (nuitées consommées)`
                  : `${folioLabel(folioPayTarget)} — solde ${folioPayTarget.balance.toFixed(2)} $`
                : null}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            {folioPayTarget ? (
              <div className="rounded-xl border border-border bg-muted/30 px-3 py-2.5">
                <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Client
                </p>
                <p className="mt-0.5 font-semibold">
                  {folioPayTarget.stay?.guestName ??
                    folioPayTarget.label ??
                    "Client"}
                </p>
                {folioPayTarget.stay?.room ? (
                  <p className="text-xs text-muted-foreground">
                    Chambre {folioPayTarget.stay.room.number}
                  </p>
                ) : null}
              </div>
            ) : null}
            <div className="grid gap-1.5">
              <Label htmlFor="folio-amount">
                {folioPayTarget && folioPayTarget.balance < -0.01
                  ? "Montant USD à rembourser"
                  : "Montant USD (acompte ou solde)"}
              </Label>
              <Input
                id="folio-amount"
                type="number"
                min={0.01}
                step="0.01"
                value={folioPayAmount}
                onChange={(e) => setFolioPayAmount(e.target.value)}
              />
              {folioPayTarget ? (
                <p className="text-xs text-muted-foreground">
                  {folioPayTarget.balance < -0.01
                    ? `Max ${Math.abs(folioPayTarget.balance).toFixed(2)} $ · rembourser le trop-perçu après recalcul des nuitées.`
                    : `Max ${folioPayTarget.balance.toFixed(2)} $ · laissez le solde pour tout régler, ou un montant inférieur pour un acompte.`}
                </p>
              ) : null}
            </div>
            <PosPayMethodPicker
              value={method}
              onChange={setMethod}
              includeBank
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setFolioPayId(null)}
              disabled={pending}
            >
              Annuler
            </Button>
            <Button
              disabled={pending || !folioPayTarget || !props.cashSession}
              onClick={() => {
                if (!folioPayTarget) return;
                const amount = Number(folioPayAmount);
                if (!(amount > 0)) {
                  toast.message("Montant invalide");
                  return;
                }
                const due = Math.abs(folioPayTarget.balance);
                if (amount > due + 0.01) {
                  toast.message(
                    folioPayTarget.balance < -0.01
                      ? "Montant supérieur au remboursement dû"
                      : "Montant supérieur au solde",
                  );
                  return;
                }
                const isPartial = amount < due - 0.01;
                payFolio(folioPayTarget.id, amount, isPartial);
              }}
            >
              {folioPayTarget && folioPayTarget.balance < -0.01
                ? "Rembourser"
                : "Encaisser"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {hasRestaurant ? (
        <ServiceStockOpsPanel
          organizationId={props.organizationId}
          branchId={props.branchId}
          branchName={props.branchName}
          currentUserName={props.currentUserName ?? "Manager"}
          rate={props.rate}
          ready={Boolean(props.stockReady)}
          session={props.stockSession ?? null}
          history={props.stockHistory ?? []}
          title="Stats service & fermeture (vente rapide)"
        />
      ) : null}
    </div>
  );
}
