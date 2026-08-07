"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Banknote,
  Printer,
  ShoppingCart,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  closeCashSessionAction,
  createPaymentAction,
  openCashSessionAction,
} from "@/lib/cash/actions";
import { createQuickSaleAction } from "@/lib/hotel/actions";
import { caisseRoutes, hotelRoutes } from "@/lib/branch/paths";
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
  items: { name: string; quantity: number; amount: number }[];
};

type MenuItem = {
  id: string;
  name: string;
  category: string;
  price: number;
  needsKitchen: boolean;
};

type PaymentRow = {
  id: string;
  receiptNumber: string;
  amountCdf: number;
  method: string;
  paidAt: string | Date;
  exchangeRateUsed: number | null;
};

type Props = {
  organizationId: string;
  branchId: string;
  branchName: string;
  cashSession: { id: string; openedAt: string | Date; openingFloat: number } | null;
  rate: { rate: number; fromCurrency: string; toCurrency: string } | null;
  folios: FolioRow[];
  readyOrders: OrderRow[];
  todayPayments: PaymentRow[];
  menuItems: MenuItem[];
};

export function CaisseClient(props: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [float, setFloat] = useState("0");
  const [quickQty, setQuickQty] = useState<Record<string, number>>({});
  const [method, setMethod] = useState<"CASH" | "MOBILE_MONEY" | "CARTE">("CASH");

  function openSession() {
    start(async () => {
      try {
        await openCashSessionAction({
          organizationId: props.organizationId,
          branchId: props.branchId,
          openingFloat: Number(float) || 0,
        });
        toast.success("Caisse ouverte");
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

  function payFolio(folioId: string, balance: number) {
    start(async () => {
      try {
        const p = await createPaymentAction({
          organizationId: props.organizationId,
          branchId: props.branchId,
          folioId,
          amountCdf: balance,
          method,
          amountForeign: props.rate ? balance / props.rate.rate : undefined,
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

  function payOrder(orderId: string, total: number) {
    start(async () => {
      try {
        const p = await createPaymentAction({
          organizationId: props.organizationId,
          branchId: props.branchId,
          orderId,
          amountCdf: total,
          method,
        });
        toast.success(`Commande encaissée · ${p.receiptNumber}`);
        router.push(
          caisseRoutes.receipt(props.organizationId, props.branchId, p.id),
        );
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erreur");
      }
    });
  }

  function quickSale() {
    const items = Object.entries(quickQty)
      .filter(([, q]) => q > 0)
      .map(([menuItemId, quantity]) => ({ menuItemId, quantity }));
    if (!items.length) {
      toast.message("Sélectionnez des articles");
      return;
    }
    start(async () => {
      try {
        const p = await createQuickSaleAction({
          organizationId: props.organizationId,
          branchId: props.branchId,
          items,
          method,
        });
        toast.success(`Vente · ${p.receiptNumber}`);
        setQuickQty({});
        router.push(
          caisseRoutes.receipt(props.organizationId, props.branchId, p.id),
        );
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erreur");
      }
    });
  }

  const drinks = props.menuItems.filter((m) => !m.needsKitchen);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Wallet className="size-6" />
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Caisse & Ventes</h1>
            <p className="text-sm text-muted-foreground">{props.branchName}</p>
            {props.rate ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Taux actif : 1 {props.rate.fromCurrency} = {props.rate.rate}{" "}
                {props.rate.toCurrency}
              </p>
            ) : (
              <p className="mt-1 text-xs text-amber-600">
                Aucun taux — configurez-le depuis Taux de Change.
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {(["CASH", "MOBILE_MONEY", "CARTE"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMethod(m)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium border transition",
                method === m
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground",
              )}
            >
              {m === "CASH" ? "Cash" : m === "CARTE" ? "Carte" : "Mobile Money"}
            </button>
          ))}
        </div>
      </header>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          Session de caisse
        </h2>
        {props.cashSession ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm">
              <span className="font-medium text-emerald-500">Ouverte</span>
              {" · "}
              depuis {new Date(props.cashSession.openedAt).toLocaleString("fr-FR")}
              {" · fond "}
              {props.cashSession.openingFloat}
            </p>
            <Button
              variant="destructive"
              size="sm"
              disabled={pending}
              onClick={closeSession}
            >
              Clôturer
            </Button>
          </div>
        ) : (
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="float">Fond d’ouverture</Label>
              <Input
                id="float"
                value={float}
                onChange={(e) => setFloat(e.target.value)}
                className="w-36"
                type="number"
                min={0}
              />
            </div>
            <Button disabled={pending} onClick={openSession} className="gap-2">
              <Banknote className="size-4" />
              Ouvrir la caisse
            </Button>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-primary/30 bg-primary/5 p-5">
        <h2 className="font-semibold">Raccourcis</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="sm"
            render={
              <Link
                href={hotelRoutes.sejours(props.organizationId, props.branchId)}
              />
            }
          >
            Séjours
            <ArrowRight className="size-3.5" />
          </Button>
          <Button
            variant="secondary"
            size="sm"
            render={
              <Link
                href={hotelRoutes.restauration(
                  props.organizationId,
                  props.branchId,
                )}
              />
            }
          >
            Restauration
          </Button>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          Folios à encaisser
        </h2>
        {props.folios.filter((f) => f.balance > 0.01).length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun solde ouvert.</p>
        ) : (
          props.folios
            .filter((f) => f.balance > 0.01)
            .map((f) => (
              <div
                key={f.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4"
              >
                <div>
                  <p className="font-medium">
                    {f.stay
                      ? `${f.stay.guestName} · ch. ${f.stay.room.number}`
                      : f.label ?? "Folio"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Solde {f.balance.toFixed(2)} CDF
                    {props.rate
                      ? ` ≈ ${(f.balance / props.rate.rate).toFixed(2)} ${props.rate.fromCurrency}`
                      : ""}
                  </p>
                </div>
                <Button
                  size="sm"
                  disabled={pending || !props.cashSession}
                  onClick={() => payFolio(f.id, f.balance)}
                >
                  Encaisser
                </Button>
              </div>
            ))
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          Commandes F&B prêtes
        </h2>
        {props.readyOrders.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune commande en attente.</p>
        ) : (
          props.readyOrders.map((o) => {
            const total = o.items.reduce((s, i) => s + i.amount, 0);
            return (
              <div
                key={o.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4"
              >
                <div>
                  <p className="font-medium">
                    {o.tableLabel ?? "Salle"} · {o.status}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {o.items.map((i) => `${i.quantity}× ${i.name}`).join(", ")} —{" "}
                    {total.toFixed(2)} CDF
                  </p>
                </div>
                <Button
                  size="sm"
                  disabled={pending || !props.cashSession}
                  onClick={() => payOrder(o.id, total)}
                >
                  Encaisser
                </Button>
              </div>
            );
          })
        )}
      </section>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <ShoppingCart className="size-5 text-primary" />
          <h2 className="font-semibold">Vente rapide (boissons / hors cuisine)</h2>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {drinks.map((m) => (
            <label
              key={m.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm"
            >
              <span>
                {m.name}{" "}
                <span className="text-muted-foreground">· {m.price}</span>
              </span>
              <Input
                type="number"
                min={0}
                className="h-8 w-16"
                value={quickQty[m.id] ?? 0}
                onChange={(e) =>
                  setQuickQty((q) => ({
                    ...q,
                    [m.id]: Number(e.target.value) || 0,
                  }))
                }
              />
            </label>
          ))}
        </div>
        <Button
          className="mt-4 gap-2"
          disabled={pending || !props.cashSession}
          onClick={quickSale}
        >
          Encaisser la vente
          <ArrowRight className="size-4" />
        </Button>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          Paiements du jour
        </h2>
        {props.todayPayments.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun paiement aujourd’hui.</p>
        ) : (
          props.todayPayments.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 text-sm"
            >
              <span>
                {p.receiptNumber} · {p.amountCdf.toFixed(2)} CDF · {p.method}
              </span>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                render={
                  <Link
                    href={caisseRoutes.receipt(
                      props.organizationId,
                      props.branchId,
                      p.id,
                    )}
                  />
                }
              >
                <Printer className="size-3.5" />
                Reçu
              </Button>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
