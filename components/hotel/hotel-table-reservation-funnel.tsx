"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { Minus, Plus, Utensils } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { clientHotelRoutes } from "@/lib/branch/paths";
import type { MenuCategoryView } from "@/lib/hotel/list-fnb";
import {
  createClientTableReservationAction,
  getClientAvailableTablesAction,
} from "@/lib/hotel/table-reservation-actions";
import { formatMontantFc } from "@/lib/reservation/labels";
import { cn } from "@/lib/utils";

gsap.registerPlugin(useGSAP);

type Step = "slot" | "table" | "food" | "confirm";

type CartLine = {
  menuItemId: string;
  name: string;
  unitPrice: number;
  quantity: number;
};

type TableOption = {
  id: string;
  number: string;
  capacity: number;
};

type Props = {
  orgSlug: string;
  organizationId: string;
  hotelName: string;
  categories: MenuCategoryView[];
};

function toLocalInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function defaultStartsAt(): string {
  const d = new Date();
  d.setHours(d.getHours() + 2, 0, 0, 0);
  return toLocalInputValue(d);
}

export function HotelTableReservationFunnel({
  orgSlug,
  organizationId,
  hotelName,
  categories,
}: Props) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState<Step>("slot");
  const [withFood, setWithFood] = useState(false);
  const [startsAt, setStartsAt] = useState(defaultStartsAt);
  const [covers, setCovers] = useState(2);
  const [tables, setTables] = useState<TableOption[]>([]);
  const [tableId, setTableId] = useState("");
  const [guestPrenom, setGuestPrenom] = useState("");
  const [guestNom, setGuestNom] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
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
          delay: 0.08,
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
  const activeCategories = categories.filter((c) =>
    c.items.some((i) => i.active),
  );

  function addToCart(item: { id: string; name: string; price: number }) {
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

  function loadTablesAndContinue() {
    startTransition(async () => {
      const result = await getClientAvailableTablesAction({
        organizationId,
        startsAt: new Date(startsAt),
        covers,
      });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      if (result.data.length === 0) {
        toast.error("Aucune table disponible pour ce créneau.");
        return;
      }
      setTables(result.data);
      setTableId("");
      setStep("table");
    });
  }

  function onSubmit() {
    startTransition(async () => {
      const result = await createClientTableReservationAction({
        organizationId,
        guestPrenom,
        guestNom,
        guestPhone,
        startsAt: new Date(startsAt),
        covers,
        tableId: tableId || "",
        notes,
        lines: withFood
          ? cart.map((line) => ({
              menuItemId: line.menuItemId,
              quantity: line.quantity,
            }))
          : [],
      });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success("Table réservée");
      router.push(clientHotelRoutes.tableReservation(orgSlug, result.data.id));
    });
  }

  return (
    <div ref={rootRef} className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <p className="text-sm text-muted-foreground">{hotelName}</p>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Réserver une table
        </h1>
        <p className="text-sm text-muted-foreground">
          À une heure précise, seule ou avec précommande. Montants en CDF.
        </p>
      </header>

      <nav
        aria-label="Étapes"
        className="flex flex-wrap gap-2 text-xs font-medium sm:text-sm"
      >
        {(
          [
            ["slot", "Créneau"],
            ["table", "Table"],
            ["food", "Plats"],
            ["confirm", "Confirmer"],
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

      {step === "slot" ? (
        <section
          data-funnel-step
          className="flex flex-col gap-4 rounded-2xl border bg-card/50 p-5"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="table-starts">Date et heure</Label>
              <Input
                id="table-starts"
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="table-covers">Couverts</Label>
              <Input
                id="table-covers"
                type="number"
                min={1}
                max={50}
                value={covers}
                onChange={(e) => setCovers(Number(e.target.value) || 1)}
              />
            </div>
          </div>
          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium">Option</legend>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="with-food"
                checked={!withFood}
                onChange={() => setWithFood(false)}
              />
              Table seule
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="with-food"
                checked={withFood}
                onChange={() => setWithFood(true)}
              />
              Table avec nourriture
            </label>
          </fieldset>
          <Button
            type="button"
            size="lg"
            disabled={pending}
            onClick={loadTablesAndContinue}
          >
            {pending ? "Recherche…" : "Voir les tables"}
          </Button>
        </section>
      ) : null}

      {step === "table" ? (
        <section
          data-funnel-step
          className="flex flex-col gap-4 rounded-2xl border bg-card/50 p-5"
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="table-pick">Table</Label>
            <Select
              id="table-pick"
              value={tableId}
              onChange={(e) => setTableId(e.target.value)}
            >
              <option value="">Attribution automatique</option>
              {tables.map((t) => (
                <option key={t.id} value={t.id}>
                  Table {t.number} · {t.capacity} places
                </option>
              ))}
            </Select>
            <p className="text-xs text-muted-foreground">
              {tables.length} table{tables.length > 1 ? "s" : ""} disponible
              {tables.length > 1 ? "s" : ""}.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => setStep("slot")}
            >
              Retour
            </Button>
            <Button
              type="button"
              disabled={pending}
              onClick={() => setStep(withFood ? "food" : "confirm")}
            >
              Continuer
            </Button>
          </div>
        </section>
      ) : null}

      {step === "food" ? (
        <section data-funnel-step className="flex flex-col gap-4">
          {activeCategories.length === 0 ? (
            <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
              Carte indisponible pour le moment. Vous pouvez réserver la table
              seule.
            </p>
          ) : (
            activeCategories.map((cat) => (
              <div key={cat.id} className="flex flex-col gap-2">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  {cat.name}
                </h2>
                <ul className="flex flex-col gap-2">
                  {cat.items
                    .filter((i) => i.active)
                    .map((item) => (
                      <li
                        key={item.id}
                        data-menu-item
                        className="flex items-center justify-between gap-3 rounded-xl border px-3 py-2"
                      >
                        <div>
                          <p className="font-medium">{item.name}</p>
                          <p className="text-sm tabular-nums text-muted-foreground">
                            {formatMontantFc(item.price)}
                          </p>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            addToCart({
                              id: item.id,
                              name: item.name,
                              price: item.price,
                            })
                          }
                        >
                          <Plus className="size-4" aria-hidden />
                          Ajouter
                        </Button>
                      </li>
                    ))}
                </ul>
              </div>
            ))
          )}

          {cart.length > 0 ? (
            <div className="rounded-xl border p-4">
              <p className="mb-2 text-sm font-medium">
                Panier · {cartCount} article{cartCount > 1 ? "s" : ""} ·{" "}
                {formatMontantFc(cartTotal)}
              </p>
              <ul className="space-y-2">
                {cart.map((line) => (
                  <li
                    key={line.menuItemId}
                    className="flex items-center justify-between gap-2 text-sm"
                  >
                    <span>
                      {line.name} · {formatMontantFc(line.unitPrice)}
                    </span>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="outline"
                        onClick={() =>
                          setQuantity(line.menuItemId, line.quantity - 1)
                        }
                      >
                        <Minus className="size-3.5" />
                      </Button>
                      <span className="w-6 text-center tabular-nums">
                        {line.quantity}
                      </span>
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="outline"
                        onClick={() =>
                          setQuantity(line.menuItemId, line.quantity + 1)
                        }
                      >
                        <Plus className="size-3.5" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => setStep("table")}
            >
              Retour
            </Button>
            <Button
              type="button"
              disabled={pending || (withFood && cart.length === 0)}
              onClick={() => setStep("confirm")}
            >
              Continuer
            </Button>
          </div>
        </section>
      ) : null}

      {step === "confirm" ? (
        <section
          data-funnel-step
          className="flex flex-col gap-4 rounded-2xl border bg-card/50 p-5"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="guest-prenom">Prénom</Label>
              <Input
                id="guest-prenom"
                value={guestPrenom}
                onChange={(e) => setGuestPrenom(e.target.value)}
                autoComplete="given-name"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="guest-nom">Nom</Label>
              <Input
                id="guest-nom"
                value={guestNom}
                onChange={(e) => setGuestNom(e.target.value)}
                autoComplete="family-name"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="guest-phone">Téléphone</Label>
            <Input
              id="guest-phone"
              value={guestPhone}
              onChange={(e) => setGuestPhone(e.target.value)}
              autoComplete="tel"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="guest-notes">Note (optionnel)</Label>
            <Textarea
              id="guest-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>
          <div className="rounded-xl border bg-background/60 p-3 text-sm">
            <p>
              {new Date(startsAt).toLocaleString("fr-FR", {
                dateStyle: "full",
                timeStyle: "short",
              })}
            </p>
            <p className="text-muted-foreground">
              {covers} couvert{covers > 1 ? "s" : ""}
              {tableId
                ? ` · table ${tables.find((t) => t.id === tableId)?.number ?? ""}`
                : " · attribution auto"}
              {withFood
                ? ` · ${cartCount} plat${cartCount > 1 ? "s" : ""} (${formatMontantFc(cartTotal)})`
                : " · sans nourriture"}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => setStep(withFood ? "food" : "table")}
            >
              Retour
            </Button>
            <Button type="button" disabled={pending} onClick={onSubmit}>
              {pending ? "Confirmation…" : "Confirmer la réservation"}
            </Button>
          </div>
        </section>
      ) : null}

      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Utensils className="size-3.5" aria-hidden />
        Sur place sans réservation : adressez-vous au serveur.
      </p>
    </div>
  );
}
