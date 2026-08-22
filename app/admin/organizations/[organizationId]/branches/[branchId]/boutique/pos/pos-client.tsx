"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Clock3,
  Pause,
  ShoppingBag,
  Wallet,
  X,
} from "lucide-react";
import { toast } from "sonner";
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
import {
  PosChargeButton,
  PosPayMethodPicker,
  PosTerminal,
  usePosCart,
  type PosMenuItem,
} from "@/components/pos/pos-terminal";
import { PosReceptionBanner } from "./pos-reception-banner";
import {
  ServiceStockOpsPanel,
  type ServiceStockOpsSession,
} from "@/components/hotel/service-stock-ops-panel";
import type { LiveShiftSituation } from "@/lib/hotel/service-stock";
import type { NormalizedUsdCdfRate } from "@/lib/cash/exchange";
import {
  cancelHeldSaleAction,
  checkoutShopSaleAction,
  holdShopSaleAction,
  type ShopProductDto,
} from "@/lib/boutique/actions";
import {
  closeCashSessionAction,
  openCashSessionAction,
} from "@/lib/cash/actions";
import {
  branchDashboardPath,
  boutiqueRoutes,
  caisseRoutes,
  usineRoutes,
} from "@/lib/branch/paths";
import type { PendingPosReception } from "@/lib/warehouse/actions";
import {
  BoutiqueHero,
  BoutiquePage,
  boutiqueOutlineBtn,
  boutiquePrimaryBtn,
} from "@/components/boutique/boutique-shell";
import { cn } from "@/lib/utils";

type HeldSale = {
  id: string;
  ticketNumber: string;
  holdLabel: string | null;
  totalAmount: number;
  heldAt: Date | string | null;
  items: {
    productId: string | null;
    name: string;
    quantity: number;
    unitPrice: number;
  }[];
};

type CashSession = {
  id: string;
  openedAt: Date | string;
  openingFloat: number;
} | null;

type Props = {
  organizationId: string;
  branchId: string;
  branchName: string;
  products: ShopProductDto[];
  heldSales: HeldSale[];
  cashSession: CashSession;
  foreignCashSessions?: {
    id: string;
    openedAt: Date | string;
    openingFloat: number;
    openedByUserId: string;
    openedByName: string;
  }[];
  pendingReceptions?: PendingPosReception[];
  currentUserName?: string;
  stockReady?: boolean;
  stockSession?: ServiceStockOpsSession | null;
  stockForeignSession?: ServiceStockOpsSession | null;
  liveSituation?: LiveShiftSituation | null;
  stockCanOperate?: boolean;
  rate?: NormalizedUsdCdfRate | null;
  /** Usine : filtres Eau/Vins + choix cash / crédit. */
  catalogMode?: "boutique" | "usine";
  hasEau?: boolean;
  hasVin?: boolean;
  creditNewHref?: string;
  depotHref?: string;
};

export function BoutiquePosClient(props: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const { cart, addItem, setQty, clear, toPayload } = usePosCart();
  const usine = props.catalogMode === "usine";
  const [kindFilter, setKindFilter] = useState<"ALL" | "ARTICLE" | "PLAT">(
    "ALL",
  );
  const [familyFilter, setFamilyFilter] = useState<"ALL" | "EAU" | "VIN">(
    props.hasEau && !props.hasVin
      ? "EAU"
      : !props.hasEau && props.hasVin
        ? "VIN"
        : "ALL",
  );
  const [saleKind, setSaleKind] = useState<"CASH" | "CREDIT">("CASH");
  const [method, setMethod] = useState<
    "CASH" | "MOBILE_MONEY" | "CARTE" | "BANK"
  >(
    "CASH",
  );
  const [sessionDialogOpen, setSessionDialogOpen] = useState(
    !props.cashSession,
  );
  const [float, setFloat] = useState("0");
  const [holdOpen, setHoldOpen] = useState(false);
  const [holdLabel, setHoldLabel] = useState("");
  const [heldOpen, setHeldOpen] = useState(false);
  const [clientOpen, setClientOpen] = useState(false);
  const [clientLabel, setClientLabel] = useState("");
  const [clientPhone, setClientPhone] = useState("");

  useEffect(() => {
    if (!props.cashSession) setSessionDialogOpen(true);
  }, [props.cashSession]);

  const stockReady = Boolean(props.stockReady);
  const prevStockReady = useRef(stockReady);
  useEffect(() => {
    if (!prevStockReady.current && stockReady) {
      toast.success(
        props.stockCanOperate
          ? "Service stock ouvert."
          : "Le service stock est ouvert — vous pouvez vendre.",
      );
    }
    prevStockReady.current = stockReady;
  }, [stockReady, props.stockCanOperate]);

  useEffect(() => {
    const ms = stockReady ? 12000 : 4000;
    const refresh = window.setInterval(() => router.refresh(), ms);
    return () => window.clearInterval(refresh);
  }, [stockReady, router]);

  const posItems: PosMenuItem[] = useMemo(() => {
    return props.products
      .filter((p) => {
        if (usine) {
          if (p.productKind === "CONSUMABLE") return false;
          if (familyFilter === "EAU") return p.finishedFamily === "EAU";
          if (familyFilter === "VIN") return p.finishedFamily === "VIN";
          return true;
        }
        return kindFilter === "ALL" || p.kind === kindFilter;
      })
      .map((p) => ({
        id: p.id,
        name: p.promoLive
          ? `${p.name}${p.promoLabel ? ` · ${p.promoLabel}` : " · Promo"}`
          : p.name,
        category: p.categoryName,
        price: p.effectivePrice,
        stockQty: p.availableQty,
        barcode: p.barcode,
        imageUrl: usine ? null : p.imageUrl,
        sku: p.sku,
        family: p.finishedFamily ?? null,
        promoLive: p.promoLive,
        basePrice: p.price,
      }));
  }, [props.products, kindFilter, familyFilter, usine]);

  const cartTotal = cart.reduce((s, l) => s + l.price * l.quantity, 0);

  function openSession() {
    start(async () => {
      try {
        await openCashSessionAction({
          organizationId: props.organizationId,
          branchId: props.branchId,
          openingFloat: Number(float) || 0,
        });
        setSessionDialogOpen(false);
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

  function putOnHold() {
    if (!cart.length) {
      toast.error("Panier vide");
      return;
    }
    start(async () => {
      try {
        await holdShopSaleAction({
          organizationId: props.organizationId,
          branchId: props.branchId,
          holdLabel: holdLabel.trim() || undefined,
          items: toPayload().map((l) => ({
            productId: l.menuItemId,
            quantity: l.quantity,
          })),
        });
        clear();
        setHoldOpen(false);
        setHoldLabel("");
        toast.success("Ticket mis en attente");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erreur");
      }
    });
  }

  function resumeHold(sale: HeldSale) {
    start(async () => {
      try {
        // Libère la réservation soft ; le panier client redevient source de vérité.
        await cancelHeldSaleAction({
          organizationId: props.organizationId,
          branchId: props.branchId,
          saleId: sale.id,
        });
        clear();
        for (const item of sale.items) {
          if (!item.productId) continue;
          for (let i = 0; i < item.quantity; i++) {
            addItem({
              id: item.productId,
              name: item.name,
              category: "",
              price: item.unitPrice,
            });
          }
        }
        setHeldOpen(false);
        toast.message(`Reprise ${sale.ticketNumber}`);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erreur");
      }
    });
  }

  function cancelHold(saleId: string) {
    start(async () => {
      try {
        await cancelHeldSaleAction({
          organizationId: props.organizationId,
          branchId: props.branchId,
          saleId,
        });
        toast.success("Ticket annulé");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erreur");
      }
    });
  }

  function charge() {
    if (!props.cashSession) {
      setSessionDialogOpen(true);
      return;
    }
    if (!stockReady) {
      toast.error("Ouvrez le service stock avant d’encaisser.");
      return;
    }
    if (!cart.length) {
      toast.error("Panier vide");
      return;
    }
    setClientOpen(true);
  }

  function goCredit() {
    if (!props.creditNewHref) return;
    if (!stockReady) {
      toast.error("Ouvrez le float marketeur avant de vendre.");
      return;
    }
    if (!cart.length) {
      toast.error("Panier vide");
      return;
    }
    const lines = cart
      .map((l) => `${l.menuItemId}:${l.quantity}`)
      .join(",");
    const params = new URLSearchParams({ lines });
    if (familyFilter !== "ALL") params.set("family", familyFilter);
    router.push(`${props.creditNewHref}?${params.toString()}`);
  }

  function confirmCheckout(anonymous: boolean) {
    start(async () => {
      try {
        const result = await checkoutShopSaleAction({
          organizationId: props.organizationId,
          branchId: props.branchId,
          items: toPayload().map((l) => ({
            productId: l.menuItemId,
            quantity: l.quantity,
          })),
          method,
          anonymous,
          clientLabel: anonymous ? undefined : clientLabel,
          clientPhone: anonymous ? undefined : clientPhone,
        });
        clear();
        setClientOpen(false);
        setClientLabel("");
        setClientPhone("");
        toast.success(
          result.sale.isAnonymous
            ? `Encaissé · ${result.sale.anonymousCode}`
            : "Encaissé",
        );
        router.push(
          caisseRoutes.receipt(
            props.organizationId,
            props.branchId,
            result.payment.id,
          ),
        );
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erreur");
      }
    });
  }

  const heldAndCashButtons = (
    <>
      <Button
        variant="outline"
        size="sm"
        className={boutiqueOutlineBtn()}
        onClick={() => setHeldOpen(true)}
      >
        <Clock3 className="size-4" />
        En attente ({props.heldSales.length})
      </Button>
      {props.cashSession ? (
        <Button
          variant="outline"
          size="sm"
          className={boutiqueOutlineBtn()}
          disabled={pending}
          onClick={closeSession}
        >
          <Wallet className="size-4" />
          Clôturer caisse
        </Button>
      ) : (
        <Button
          size="sm"
          className={boutiquePrimaryBtn()}
          onClick={() => setSessionDialogOpen(true)}
        >
          <Wallet className="size-4" />
          Ouvrir caisse
        </Button>
      )}
    </>
  );

  const posActions = (
    <div className="space-y-2">
      {usine ? (
        <div className="grid grid-cols-2 gap-1.5">
          {(
            [
              ["CASH", "Cash"],
              ["CREDIT", "Crédit"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setSaleKind(k)}
              className={cn(
                "h-10 rounded-xl border text-sm font-semibold",
                saleKind === k
                  ? "border-emerald-800 bg-emerald-800 text-white"
                  : "border-border bg-card text-muted-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}
      {usine && saleKind === "CREDIT" ? (
        <Button
          className="h-12 w-full rounded-2xl bg-amber-700 text-white hover:bg-amber-700/90"
          disabled={!cart.length || !stockReady || pending}
          onClick={goCredit}
        >
          Crédit — client & échéance
        </Button>
      ) : (
        <div className="space-y-2">
          <PosPayMethodPicker value={method} onChange={setMethod} />
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              className={cn(
                "h-12 rounded-2xl",
                (!cart.length ||
                  pending ||
                  !props.cashSession ||
                  !stockReady) &&
                  "pointer-events-none opacity-50",
              )}
              aria-disabled={
                !cart.length ||
                pending ||
                !props.cashSession ||
                !stockReady ||
                undefined
              }
              onClick={() => {
                if (
                  !cart.length ||
                  pending ||
                  !props.cashSession ||
                  !stockReady
                )
                  return;
                setHoldOpen(true);
              }}
            >
              <Pause className="size-4" />
              Attente
            </Button>
            <PosChargeButton
              label="Encaisser"
              disabled={!cart.length || !props.cashSession || !stockReady}
              pending={pending}
              onClick={charge}
              className="h-12 rounded-2xl bg-emerald-700 text-white hover:bg-emerald-700/90"
            />
          </div>
        </div>
      )}
    </div>
  );

  return (
    <BoutiquePage wide={usine}>
      {usine ? (
        <div className="flex flex-col gap-2 rounded-xl border border-border bg-card px-3 py-2.5 shadow-sm sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              className="-ml-1 h-8 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
              render={
                <Link
                  href={branchDashboardPath(
                    props.organizationId,
                    props.branchId,
                  )}
                />
              }
            >
              <ArrowLeft className="size-4" />
              Hub
            </Button>
            {heldAndCashButtons}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[11px] text-muted-foreground">
              <span
                className={
                  stockReady
                    ? "font-semibold text-emerald-700"
                    : "font-semibold text-amber-700"
                }
              >
                {stockReady ? "Float ouvert" : "Float fermé"}
              </span>
              {" · "}
              <span
                className={
                  props.cashSession
                    ? "font-semibold text-emerald-700"
                    : "font-semibold text-amber-700"
                }
              >
                {props.cashSession ? "Caisse ouverte" : "Caisse fermée"}
              </span>
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 rounded-full"
              render={
                <Link
                  href={usineRoutes.serviceStock(
                    props.organizationId,
                    props.branchId,
                  )}
                />
              }
            >
              Float
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 rounded-full"
              render={
                <Link
                  href={
                    props.depotHref ??
                    usineRoutes.depot(props.organizationId, props.branchId)
                  }
                />
              }
            >
              Dépôt
            </Button>
          </div>
        </div>
      ) : (
        <BoutiqueHero
          kicker={`${props.branchName} · caisse`}
          title="Point de vente"
          subtitle="Le stock vendu est le float du service — ouvrez-le depuis le stock auxiliaire."
          icon={ShoppingBag}
          backHref={branchDashboardPath(props.organizationId, props.branchId)}
          actions={
            <>
              {heldAndCashButtons}
              <Button
                variant="ghost"
                size="sm"
                className="rounded-full"
                render={
                  <Link
                    href={boutiqueRoutes.serviceStock(
                      props.organizationId,
                      props.branchId,
                    )}
                  />
                }
              >
                Service stock
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="rounded-full"
                render={
                  <Link
                    href={boutiqueRoutes.produits(
                      props.organizationId,
                      props.branchId,
                    )}
                  />
                }
              >
                Produits
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="rounded-full"
                render={
                  <Link
                    href={
                      props.depotHref ??
                      boutiqueRoutes.stock(
                        props.organizationId,
                        props.branchId,
                      )
                    }
                  />
                }
              >
                Stock
              </Button>
            </>
          }
        />
      )}

      {(props.foreignCashSessions?.length ?? 0) > 0 ? (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm">
          Session caisse encore ouverte par{" "}
          <strong>{props.foreignCashSessions![0]!.openedByName}</strong> —
          ouvrez la vôtre pour encaisser (l’autre reste intacte).
        </div>
      ) : null}

      <PosReceptionBanner
        organizationId={props.organizationId}
        branchId={props.branchId}
        pending={props.pendingReceptions ?? []}
      />

      {usine ? null : (
        <div className="flex flex-wrap gap-1.5">
          {(["ALL", "ARTICLE", "PLAT"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKindFilter(k)}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-xs font-semibold transition",
                kindFilter === k
                  ? "border-primary bg-primary text-primary-foreground shadow-sm"
                  : "border-border bg-card text-muted-foreground hover:bg-muted",
              )}
            >
              {k === "ALL" ? "Tous" : k === "ARTICLE" ? "Articles" : "Plats"}
            </button>
          ))}
        </div>
      )}

      {usine ? (
        <PosTerminal
          items={posItems}
          cart={cart}
          onAdd={addItem}
          onSetQty={setQty}
          onClear={clear}
          catalogLayout="list"
          catalogStatus={
            <div className="flex flex-wrap gap-1">
              {(
                [
                  ["ALL", "Tous"],
                  ...(props.hasEau !== false
                    ? ([["EAU", "Eau"]] as const)
                    : []),
                  ...(props.hasVin !== false
                    ? ([["VIN", "Vins"]] as const)
                    : []),
                ] as const
              ).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setFamilyFilter(k)}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-[11px] font-semibold transition",
                    familyFilter === k
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-muted-foreground hover:bg-muted",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          }
          ticketTitle="Panier"
          emptyHint="Ajoutez un produit du catalogue"
          formatPrice={(n) => `${n.toFixed(2)} $`}
          actions={posActions}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <PosTerminal
            items={posItems}
            cart={cart}
            onAdd={addItem}
            onSetQty={setQty}
            onClear={clear}
            catalogLayout="tiles"
            ticketTitle="Ticket commerce"
            emptyHint="Scannez ou cherchez un article / plat"
            formatPrice={(n) => `${n.toFixed(2)} $`}
            actions={posActions}
          />
        </div>
      )}

      {/* Session caisse */}
      <Dialog
        open={sessionDialogOpen && !props.cashSession}
        onOpenChange={() => {}}
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Ouvrir la caisse</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Une session de caisse est requise pour encaisser au point de vente.
          </p>
          <div className="grid gap-1.5">
            <Label>Fond de caisse ($)</Label>
            <Input
              type="number"
              min={0}
              value={float}
              onChange={(e) => setFloat(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              render={
                <Link
                  href={branchDashboardPath(
                    props.organizationId,
                    props.branchId,
                  )}
                />
              }
            >
              Retour
            </Button>
            <Button disabled={pending} onClick={openSession}>
              Ouvrir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Hold label */}
      <Dialog open={holdOpen} onOpenChange={setHoldOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mettre en attente</DialogTitle>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label>Libellé (optionnel)</Label>
            <Input
              placeholder="ex. Client bleu"
              value={holdLabel}
              onChange={(e) => setHoldLabel(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHoldOpen(false)}>
              Annuler
            </Button>
            <Button disabled={pending} onClick={putOnHold}>
              Confirmer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Held list */}
      <Dialog open={heldOpen} onOpenChange={setHeldOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Tickets en attente</DialogTitle>
          </DialogHeader>
          <div className="max-h-[50vh] space-y-2 overflow-y-auto">
            {props.heldSales.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Aucun ticket en attente
              </p>
            ) : (
              props.heldSales.map((s) => (
                <div
                  key={s.id}
                  className="rounded-xl border border-border p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">
                        {s.holdLabel || s.ticketNumber}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {s.ticketNumber} · {s.totalAmount.toFixed(2)} $ ·{" "}
                        {s.items.reduce((n, i) => n + i.quantity, 0)} art.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground"
                      onClick={() => cancelHold(s.id)}
                      aria-label="Annuler"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                  <Button
                    className="mt-2 w-full"
                    size="sm"
                    onClick={() => resumeHold(s)}
                  >
                    Reprendre
                  </Button>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Client optional */}
      <Dialog open={clientOpen} onOpenChange={setClientOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Client (optionnel)</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Laissez vide pour un client anonyme.
          </p>
          <p className="rounded-xl border border-border bg-muted/40 px-3 py-2 text-center text-lg font-bold tabular-nums">
            Total {cartTotal.toFixed(2)} $
          </p>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label>Nom</Label>
              <Input
                value={clientLabel}
                onChange={(e) => setClientLabel(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Téléphone</Label>
              <Input
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button
              disabled={pending}
              className="h-11 bg-emerald-600 text-white hover:bg-emerald-600/90"
              onClick={() =>
                confirmCheckout(!clientLabel.trim() && !clientPhone.trim())
              }
            >
              {clientLabel.trim() || clientPhone.trim()
                ? "Encaisser"
                : "Continuer sans enregistrer"}
            </Button>
            <Button variant="outline" onClick={() => setClientOpen(false)}>
              Annuler
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {usine ? null : props.stockCanOperate && !props.stockForeignSession ? (
        <ServiceStockOpsPanel
          organizationId={props.organizationId}
          branchId={props.branchId}
          branchName={props.branchName}
          currentUserName={props.currentUserName ?? "Caissier"}
          rate={props.rate ?? null}
          ready={stockReady}
          session={props.stockSession ?? null}
          liveSituation={props.liveSituation}
          title="Stats service & fermeture POS"
          serviceStockHref={boutiqueRoutes.serviceStock(
            props.organizationId,
            props.branchId,
          )}
        />
      ) : !usine &&
        !props.stockCanOperate &&
        stockReady &&
        props.stockSession ? (
        <p className="text-xs text-muted-foreground">
          Stock service ouvert par {props.stockSession.vendorDisplayName} (
          {props.stockSession.number}) — vous vendez sur ce float.
        </p>
      ) : null}
    </BoutiquePage>
  );
}
