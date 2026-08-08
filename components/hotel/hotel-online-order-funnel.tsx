"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { Minus, Plus, ShoppingBag, UtensilsCrossed } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  claimGuestStayAction,
  createOnlineFoodOrderAction,
} from "@/lib/hotel/client-online-order-actions";
import type { GuestStayLink } from "@/lib/hotel/client-online-order";
import type { MenuCategoryView } from "@/lib/hotel/list-fnb";
import { clientHotelRoutes } from "@/lib/branch/paths";
import { formatMontantFc } from "@/lib/reservation/labels";
import { cn } from "@/lib/utils";

gsap.registerPlugin(useGSAP);

type Step = "claim" | "menu" | "cart";

type CartLine = {
  menuItemId: string;
  name: string;
  unitPrice: number;
  quantity: number;
};

type Props = {
  orgSlug: string;
  organizationId: string;
  hotelName: string;
  categories: MenuCategoryView[];
  initialClaim: GuestStayLink | null;
  initialPhone: string;
  initialRoom: string;
};

export function HotelOnlineOrderFunnel({
  orgSlug,
  organizationId,
  hotelName,
  categories,
  initialClaim,
  initialPhone,
  initialRoom,
}: Props) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState<Step>(initialClaim ? "menu" : "claim");
  const [claim, setClaim] = useState<GuestStayLink | null>(initialClaim);
  const [phone, setPhone] = useState(initialPhone);
  const [roomNumber, setRoomNumber] = useState(initialRoom);
  const [notes, setNotes] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);

  useGSAP(
    () => {
      const ctx = gsap.context(() => {
        gsap.from("[data-funnel-step]", {
          opacity: 0,
          y: 16,
          duration: 0.45,
          ease: "power2.out",
        });
        gsap.from("[data-menu-item]", {
          opacity: 0,
          y: 10,
          duration: 0.35,
          stagger: 0.04,
          ease: "power2.out",
          delay: 0.1,
        });
      }, rootRef);
      return () => ctx.revert();
    },
    { dependencies: [step], scope: rootRef, revertOnUpdate: true },
  );

  const cartCount = cart.reduce((sum, line) => sum + line.quantity, 0);
  const cartTotal = cart.reduce(
    (sum, line) => sum + line.unitPrice * line.quantity,
    0,
  );

  function addToCart(item: {
    id: string;
    name: string;
    price: number;
  }) {
    setCart((prev) => {
      const existing = prev.find((line) => line.menuItemId === item.id);
      if (existing) {
        return prev.map((line) =>
          line.menuItemId === item.id
            ? { ...line, quantity: Math.min(99, line.quantity + 1) }
            : line,
        );
      }
      return [
        ...prev,
        {
          menuItemId: item.id,
          name: item.name,
          unitPrice: item.price,
          quantity: 1,
        },
      ];
    });
  }

  function setQuantity(menuItemId: string, quantity: number) {
    setCart((prev) => {
      if (quantity <= 0) {
        return prev.filter((line) => line.menuItemId !== menuItemId);
      }
      return prev.map((line) =>
        line.menuItemId === menuItemId
          ? { ...line, quantity: Math.min(99, quantity) }
          : line,
      );
    });
  }

  function onClaim() {
    startTransition(async () => {
      const result = await claimGuestStayAction({
        organizationId,
        guestPhone: phone,
        roomNumber,
      });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      setClaim(result.data);
      setStep("menu");
      toast.success(`Séjour lié — ${result.data.guestName}`);
    });
  }

  function onSubmit() {
    if (!claim) return;
    startTransition(async () => {
      const result = await createOnlineFoodOrderAction({
        organizationId,
        stayId: claim.id,
        guestPhone: phone || claim.guestPhone,
        roomNumber: roomNumber || claim.roomNumber || "",
        notes,
        lines: cart.map((line) => ({
          menuItemId: line.menuItemId,
          quantity: line.quantity,
        })),
      });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success("Commande envoyée");
      router.push(clientHotelRoutes.commandeOrder(orgSlug, result.data.id));
    });
  }

  return (
    <div ref={rootRef} className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <p className="text-sm text-muted-foreground">{hotelName}</p>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Room service
        </h1>
        <p className="text-sm text-muted-foreground">
          Commandez en ligne depuis votre chambre. Montants en CDF.
        </p>
      </header>

      <nav
        aria-label="Étapes"
        className="flex flex-wrap gap-2 text-xs font-medium sm:text-sm"
      >
        {(
          [
            ["claim", "Séjour"],
            ["menu", "Carte"],
            ["cart", "Panier"],
          ] as const
        ).map(([id, label]) => (
          <Badge
            key={id}
            variant="outline"
            className={cn(
              step === id
                ? "border-transparent bg-primary/15 text-primary"
                : "text-muted-foreground",
            )}
          >
            {label}
          </Badge>
        ))}
      </nav>

      {step === "claim" ? (
        <section
          data-funnel-step
          className="flex flex-col gap-4 rounded-xl border bg-card/60 p-4 sm:p-5"
          aria-labelledby="claim-title"
        >
          <div>
            <h2 id="claim-title" className="text-lg font-semibold">
              Lier votre séjour
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Indiquez le téléphone du séjour et le numéro de chambre (en
              maison).
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="rs-phone">Téléphone</Label>
              <Input
                id="rs-phone"
                type="tel"
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+243…"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rs-room">Chambre</Label>
              <Input
                id="rs-room"
                value={roomNumber}
                onChange={(e) => setRoomNumber(e.target.value)}
                placeholder="ex. 12"
              />
            </div>
          </div>
          <Button
            type="button"
            disabled={pending || !phone.trim() || !roomNumber.trim()}
            onClick={onClaim}
          >
            Continuer
          </Button>
        </section>
      ) : null}

      {step === "menu" && claim ? (
        <section data-funnel-step className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-muted/40 px-3 py-2 text-sm">
            <span>
              {claim.guestName}
              {claim.roomNumber ? ` · ch. ${claim.roomNumber}` : ""}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setStep("claim")}
            >
              Changer
            </Button>
          </div>

          {categories.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed py-12 text-center">
              <UtensilsCrossed className="size-8 text-muted-foreground" />
              <p className="font-medium">Carte indisponible</p>
              <p className="text-sm text-muted-foreground">
                Aucun plat actif pour le moment.
              </p>
            </div>
          ) : (
            categories.map((cat) => (
              <div key={cat.id} className="flex flex-col gap-2">
                <h2 className="text-base font-semibold">{cat.name}</h2>
                <ul className="flex flex-col gap-2">
                  {cat.items.map((item) => (
                    <li
                      key={item.id}
                      data-menu-item
                      className="flex items-start justify-between gap-3 rounded-xl border bg-card/50 p-3"
                    >
                      <div className="min-w-0">
                        <p className="font-medium">{item.name}</p>
                        {item.description ? (
                          <p className="mt-0.5 text-sm text-muted-foreground">
                            {item.description}
                          </p>
                        ) : null}
                        <p className="mt-1 text-sm tabular-nums text-foreground">
                          {formatMontantFc(item.price)}
                        </p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() =>
                          addToCart({
                            id: item.id,
                            name: item.name,
                            price: item.price,
                          })
                        }
                      >
                        <Plus data-icon="inline-start" />
                        Ajouter
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}

          <div className="sticky bottom-3 z-10">
            <Button
              type="button"
              className="w-full shadow-md"
              size="lg"
              disabled={cartCount === 0}
              onClick={() => setStep("cart")}
            >
              <ShoppingBag data-icon="inline-start" />
              Panier · {cartCount} · {formatMontantFc(cartTotal)}
            </Button>
          </div>
        </section>
      ) : null}

      {step === "cart" && claim ? (
        <section
          data-funnel-step
          className="flex flex-col gap-4 rounded-xl border bg-card/60 p-4 sm:p-5"
        >
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">Votre panier</h2>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setStep("menu")}
            >
              Modifier
            </Button>
          </div>

          {cart.length === 0 ? (
            <p className="text-sm text-muted-foreground">Panier vide.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {cart.map((line) => (
                <li
                  key={line.menuItemId}
                  className="flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="font-medium">{line.name}</p>
                    <p className="text-sm tabular-nums text-muted-foreground">
                      {formatMontantFc(line.unitPrice)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="outline"
                      aria-label="Diminuer"
                      onClick={() =>
                        setQuantity(line.menuItemId, line.quantity - 1)
                      }
                    >
                      <Minus />
                    </Button>
                    <span className="w-8 text-center tabular-nums text-sm">
                      {line.quantity}
                    </span>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="outline"
                      aria-label="Augmenter"
                      onClick={() =>
                        setQuantity(line.menuItemId, line.quantity + 1)
                      }
                    >
                      <Plus />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="space-y-2">
            <Label htmlFor="rs-notes">Note (optionnel)</Label>
            <Textarea
              id="rs-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Allergies, sans piment…"
              rows={2}
            />
          </div>

          <div className="flex items-center justify-between border-t pt-3 text-base font-semibold">
            <span>Total</span>
            <span className="tabular-nums">{formatMontantFc(cartTotal)}</span>
          </div>

          <Button
            type="button"
            size="lg"
            disabled={pending || cart.length === 0}
            onClick={onSubmit}
          >
            Commander · facturé au folio
          </Button>
        </section>
      ) : null}
    </div>
  );
}
