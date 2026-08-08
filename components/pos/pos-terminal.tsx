"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Minus, Plus, Search, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type PosMenuItem = {
  id: string;
  name: string;
  category: string;
  price: number;
  needsKitchen?: boolean;
};

export type PosCartLine = {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
};

const TILE_TONES = [
  "from-orange-600/90 via-orange-500/70 to-amber-700/90",
  "from-emerald-700/90 via-teal-600/70 to-cyan-800/90",
  "from-sky-700/90 via-blue-600/70 to-indigo-800/90",
  "from-rose-700/90 via-pink-600/70 to-fuchsia-800/90",
  "from-lime-700/90 via-green-600/70 to-emerald-800/90",
  "from-amber-700/90 via-yellow-600/70 to-orange-800/90",
] as const;

function toneFor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h + seed.charCodeAt(i) * (i + 1)) % TILE_TONES.length;
  return TILE_TONES[h]!;
}

type Props = {
  items: PosMenuItem[];
  cart: PosCartLine[];
  onAdd: (item: PosMenuItem) => void;
  onSetQty: (menuItemId: string, quantity: number) => void;
  onClear: () => void;
  ticketTitle?: string;
  ticketMeta?: ReactNode;
  actions: ReactNode;
  emptyHint?: string;
  className?: string;
};

export function PosTerminal({
  items,
  cart,
  onAdd,
  onSetQty,
  onClear,
  ticketTitle = "Ticket",
  ticketMeta,
  actions,
  emptyHint = "Touchez un article pour l’ajouter",
  className,
}: Props) {
  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const item of items) set.add(item.category || "Autres");
    return ["Tous", ...set];
  }, [items]);

  const [category, setCategory] = useState("Tous");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      const cat = item.category || "Autres";
      if (category !== "Tous" && cat !== category) return false;
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        cat.toLowerCase().includes(q)
      );
    });
  }, [items, category, query]);

  const total = cart.reduce((s, l) => s + l.price * l.quantity, 0);
  const linesCount = cart.reduce((s, l) => s + l.quantity, 0);
  const activeLabel = category === "Tous" ? "Catalogue" : category;

  return (
    <div
      className={cn(
        "grid min-h-[min(70vh,720px)] overflow-hidden rounded-2xl border border-border bg-card shadow-sm lg:grid-cols-[minmax(0,1fr)_320px]",
        className,
      )}
    >
      <div className="flex min-h-0 flex-col border-b border-border lg:border-b-0 lg:border-r">
        <div className="flex items-center gap-3 bg-primary px-4 py-3 text-primary-foreground">
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-semibold tracking-tight">
              {activeLabel}
            </p>
            <p className="text-xs text-primary-foreground/80">
              {filtered.length} article{filtered.length === 1 ? "" : "s"}
            </p>
          </div>
          <div className="relative w-full max-w-[220px]">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 opacity-70" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher…"
              className="h-9 border-primary-foreground/20 bg-primary-foreground/10 pl-8 text-primary-foreground placeholder:text-primary-foreground/60 focus-visible:ring-primary-foreground/30"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto bg-muted/30 p-3 sm:p-4">
          {filtered.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">
              Aucun article dans cette catégorie.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {filtered.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onAdd(item)}
                  className={cn(
                    "group relative aspect-[4/5] overflow-hidden rounded-xl text-left shadow-sm transition",
                    "ring-offset-background hover:scale-[1.02] hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none active:scale-[0.98]",
                    "bg-gradient-to-br",
                    toneFor(item.id + item.category),
                  )}
                >
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.22),transparent_55%)]" />
                  <div className="absolute top-2 right-2 rounded-md bg-black/35 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-white uppercase backdrop-blur-sm">
                    {item.price.toFixed(2)}
                  </div>
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/45 to-transparent px-2.5 pt-8 pb-2.5">
                    <p className="line-clamp-2 text-sm font-semibold text-white drop-shadow">
                      {item.name}
                    </p>
                    {item.needsKitchen ? (
                      <p className="mt-0.5 text-[11px] text-white/75">Cuisine</p>
                    ) : (
                      <p className="mt-0.5 text-[11px] text-white/75">
                        {item.category}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <nav className="flex gap-1 overflow-x-auto border-t border-border bg-card px-2 py-2">
          {categories.map((cat) => {
            const active = cat === category;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                className={cn(
                  "shrink-0 rounded-lg px-3 py-2 text-xs font-semibold tracking-wide uppercase transition",
                  active
                    ? "bg-primary/15 text-primary ring-1 ring-primary/30"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {cat}
              </button>
            );
          })}
        </nav>
      </div>

      <aside className="flex min-h-[320px] flex-col bg-card lg:min-h-0">
        <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
          <div>
            <p className="font-semibold tracking-tight">{ticketTitle}</p>
            <p className="text-xs text-muted-foreground">
              {linesCount} article{linesCount === 1 ? "" : "s"}
            </p>
          </div>
          {cart.length > 0 ? (
            <button
              type="button"
              onClick={onClear}
              className="rounded-md p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
              aria-label="Vider le ticket"
            >
              <Trash2 className="size-4" />
            </button>
          ) : null}
        </div>

        {ticketMeta ? (
          <div className="border-b border-border px-4 py-3">{ticketMeta}</div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-auto px-3 py-3">
          {cart.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              {emptyHint}
            </p>
          ) : (
            <ul className="space-y-2">
              {cart.map((line) => (
                <li
                  key={line.menuItemId}
                  className="rounded-xl border border-border/80 bg-muted/20 px-3 py-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {line.name}{" "}
                        <span className="text-muted-foreground">
                          × {line.quantity}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {line.price.toFixed(2)} / u.
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-semibold tabular-nums">
                      {(line.price * line.quantity).toFixed(2)}
                    </p>
                  </div>
                  <div className="mt-2 flex items-center gap-1.5">
                    <button
                      type="button"
                      className="flex size-7 items-center justify-center rounded-md border border-border bg-card hover:bg-muted"
                      onClick={() =>
                        onSetQty(line.menuItemId, line.quantity - 1)
                      }
                      aria-label="Diminuer"
                    >
                      <Minus className="size-3.5" />
                    </button>
                    <span className="min-w-6 text-center text-sm font-medium tabular-nums">
                      {line.quantity}
                    </span>
                    <button
                      type="button"
                      className="flex size-7 items-center justify-center rounded-md border border-border bg-card hover:bg-muted"
                      onClick={() =>
                        onSetQty(line.menuItemId, line.quantity + 1)
                      }
                      aria-label="Augmenter"
                    >
                      <Plus className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      className="ml-auto flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => onSetQty(line.menuItemId, 0)}
                      aria-label="Retirer"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-auto space-y-3 border-t border-border bg-muted/20 px-4 py-4">
          <div className="flex items-end justify-between gap-3">
            <span className="text-sm text-muted-foreground">Total</span>
            <span className="text-2xl font-bold tracking-tight tabular-nums">
              {total.toFixed(2)}
            </span>
          </div>
          {actions}
        </div>
      </aside>
    </div>
  );
}

export function usePosCart() {
  const [cart, setCart] = useState<PosCartLine[]>([]);

  function addItem(item: PosMenuItem) {
    setCart((prev) => {
      const existing = prev.find((l) => l.menuItemId === item.id);
      if (existing) {
        return prev.map((l) =>
          l.menuItemId === item.id
            ? { ...l, quantity: l.quantity + 1 }
            : l,
        );
      }
      return [
        ...prev,
        {
          menuItemId: item.id,
          name: item.name,
          price: item.price,
          quantity: 1,
        },
      ];
    });
  }

  function setQty(menuItemId: string, quantity: number) {
    setCart((prev) => {
      if (quantity <= 0) return prev.filter((l) => l.menuItemId !== menuItemId);
      return prev.map((l) =>
        l.menuItemId === menuItemId ? { ...l, quantity } : l,
      );
    });
  }

  function clear() {
    setCart([]);
  }

  function toPayload() {
    return cart.map((l) => ({
      menuItemId: l.menuItemId,
      quantity: l.quantity,
    }));
  }

  return { cart, addItem, setQty, clear, toPayload };
}

export function PosPayMethodPicker(props: {
  value: "CASH" | "MOBILE_MONEY" | "CARTE";
  onChange: (v: "CASH" | "MOBILE_MONEY" | "CARTE") => void;
  className?: string;
}) {
  return (
    <div className={cn("grid grid-cols-3 gap-1.5", props.className)}>
      {(
        [
          ["CASH", "Cash"],
          ["MOBILE_MONEY", "Mobile"],
          ["CARTE", "Carte"],
        ] as const
      ).map(([id, label]) => (
        <button
          key={id}
          type="button"
          onClick={() => props.onChange(id)}
          className={cn(
            "rounded-lg border px-2 py-2 text-xs font-semibold transition",
            props.value === id
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-card text-muted-foreground hover:bg-muted",
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export function PosChargeButton(props: {
  label: string;
  disabled?: boolean;
  pending?: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <Button
      size="lg"
      className={cn("h-12 w-full text-base font-semibold", props.className)}
      disabled={props.disabled || props.pending}
      onClick={props.onClick}
    >
      {props.label}
    </Button>
  );
}
