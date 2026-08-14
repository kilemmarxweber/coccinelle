"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Clock3,
  Pause,
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
} from "@/lib/branch/paths";
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
};

export function BoutiquePosClient(props: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const { cart, addItem, setQty, clear, toPayload } = usePosCart();
  const [kindFilter, setKindFilter] = useState<"ALL" | "ARTICLE" | "PLAT">(
    "ALL",
  );
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

  const posItems: PosMenuItem[] = useMemo(() => {
    return props.products
      .filter((p) => kindFilter === "ALL" || p.kind === kindFilter)
      .map((p) => ({
        id: p.id,
        name: p.promoLive
          ? `${p.name}${p.promoLabel ? ` · ${p.promoLabel}` : " · Promo"}`
          : p.name,
        category: p.categoryName,
        price: p.effectivePrice,
        stockQty: p.availableQty,
        barcode: p.barcode,
        imageUrl: p.imageUrl,
      }));
  }, [props.products, kindFilter]);

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
    if (!cart.length) {
      toast.error("Panier vide");
      return;
    }
    setClientOpen(true);
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

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-3 px-3 py-4 sm:px-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
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
          <div>
            <h1 className="text-lg font-bold tracking-tight sm:text-xl">
              Point de vente
            </h1>
            <p className="text-xs text-muted-foreground">{props.branchName}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setHeldOpen(true)}
          >
            <Clock3 className="size-4" />
            En attente ({props.heldSales.length})
          </Button>
          {props.cashSession ? (
            <Button
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={closeSession}
            >
              <Wallet className="size-4" />
              Clôturer caisse
            </Button>
          ) : (
            <Button size="sm" onClick={() => setSessionDialogOpen(true)}>
              <Wallet className="size-4" />
              Ouvrir caisse
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
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
        </div>
      </div>

      {(props.foreignCashSessions?.length ?? 0) > 0 ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm">
          Session caisse encore ouverte par{" "}
          <strong>{props.foreignCashSessions![0]!.openedByName}</strong> —
          ouvrez la vôtre pour encaisser (l’autre reste intacte).
        </div>
      ) : null}

      <div className="flex flex-wrap gap-1.5">
        {(["ALL", "ARTICLE", "PLAT"] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKindFilter(k)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-semibold",
              kindFilter === k
                ? "border-emerald-600 bg-emerald-600 text-white"
                : "border-border bg-card text-muted-foreground",
            )}
          >
            {k === "ALL" ? "Tous" : k === "ARTICLE" ? "Articles" : "Plats"}
          </button>
        ))}
      </div>

      <PosTerminal
        items={posItems}
        cart={cart}
        onAdd={addItem}
        onSetQty={setQty}
        onClear={clear}
        ticketTitle="Ticket commerce"
        emptyHint="Scannez ou cherchez un article / plat"
        formatPrice={(n) => `${n.toFixed(2)} $`}
        actions={
          <div className="space-y-2">
            <PosPayMethodPicker value={method} onChange={setMethod} />
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                className={cn(
                  "h-12",
                  (!cart.length || pending || !props.cashSession) &&
                    "pointer-events-none opacity-50",
                )}
                aria-disabled={
                  !cart.length || pending || !props.cashSession || undefined
                }
                onClick={() => {
                  if (!cart.length || pending || !props.cashSession) return;
                  setHoldOpen(true);
                }}
              >
                <Pause className="size-4" />
                Attente
              </Button>
              <PosChargeButton
                label="Encaisser"
                disabled={!cart.length || !props.cashSession}
                pending={pending}
                onClick={charge}
                className="bg-emerald-600 text-white hover:bg-emerald-600/90"
              />
            </div>
          </div>
        }
      />

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
    </div>
  );
}
