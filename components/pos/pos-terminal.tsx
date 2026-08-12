"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Barcode, ChevronLeft, ChevronRight, Minus, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useBarcodeScanField } from "@/hooks/use-barcode-scan-field";
import { normalizeBarcode } from "@/lib/hotel/barcode";
import { cn } from "@/lib/utils";

/** Heuristique : saisie type scan USB (pas une recherche nom). */
function looksLikeBarcode(raw: string) {
  const v = raw.trim();
  if (v.length < 6) return false;
  if (/\s/.test(v)) return false;
  return /^[A-Za-z0-9\-_.]+$/.test(v) && /\d/.test(v);
}

/** 2 lignes × 3 colonnes (grille sm+). */
const CATALOG_PAGE_SIZE = 6;
/** Lignes panier visibles avant pagination. */
const CART_PAGE_SIZE = 3;

function PosPager(props: {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  onPage: (page: number) => void;
  className?: string;
}) {
  const { page, pageCount, total, pageSize, onPage } = props;
  if (total === 0 || pageCount <= 1) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card/70 px-2.5 py-2",
        props.className,
      )}
    >
      <p className="text-[11px] text-muted-foreground tabular-nums">
        {from}–{to} sur {total}
      </p>
      <div className="flex items-center gap-0.5">
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label="Page précédente"
          onClick={() => onPage(Math.max(1, page - 1))}
          className={cn(
            "rounded-full",
            page <= 1 && "pointer-events-none opacity-40",
          )}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <div className="flex items-center gap-0.5 px-0.5">
          {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onPage(n)}
              aria-label={`Page ${n}`}
              aria-current={n === page ? "page" : undefined}
              className={cn(
                "flex size-7 items-center justify-center rounded-full text-[11px] font-semibold transition",
                n === page
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {n}
            </button>
          ))}
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label="Page suivante"
          onClick={() => onPage(Math.min(pageCount, page + 1))}
          className={cn(
            "rounded-full",
            page >= pageCount && "pointer-events-none opacity-40",
          )}
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}

export type PosMenuItem = {
  id: string;
  name: string;
  category: string;
  price: number;
  needsKitchen?: boolean;
  imageUrl?: string | null;
  stockQty?: number;
  barcode?: string | null;
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
  /** Format d’affichage des prix (défaut : 2 décimales + $). */
  formatPrice?: (amount: number) => string;
  /** Active le champ scan code-barres (défaut true). */
  barcodeScanEnabled?: boolean;
  /** Active la pagination catalogue (2 lignes). Défaut true. */
  paginateCatalog?: boolean;
  /** Active la pagination panier si > 3 lignes. Défaut true. */
  paginateCart?: boolean;
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
  emptyHint = "Touchez un article ou scannez un code-barres",
  className,
  formatPrice = (amount: number) => `${amount.toFixed(2)} $`,
  barcodeScanEnabled = true,
  paginateCatalog = true,
  paginateCart = true,
}: Props) {
  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const item of items) set.add(item.category || "Autres");
    return ["Tous", ...set];
  }, [items]);

  const [category, setCategory] = useState("Tous");
  const [scanFlash, setScanFlash] = useState<"ok" | "err" | null>(null);
  const [catalogPage, setCatalogPage] = useState(1);
  const [cartPage, setCartPage] = useState(1);
  const prevCartLen = useRef(0);

  const itemByBarcode = useMemo(() => {
    const map = new Map<string, PosMenuItem>();
    for (const item of items) {
      const code = normalizeBarcode(item.barcode);
      if (code) map.set(code, item);
    }
    return map;
  }, [items]);

  const scan = useBarcodeScanField(() => {}, {
    enabled: barcodeScanEnabled,
    autoFocus: true,
  });

  const filtered = useMemo(() => {
    const q = scan.value.trim().toLowerCase();
    return items.filter((item) => {
      const cat = item.category || "Autres";
      if (category !== "Tous" && cat !== category) return false;
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        cat.toLowerCase().includes(q) ||
        (item.barcode?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [items, category, scan.value]);

  const catalogPageCount = paginateCatalog
    ? Math.max(1, Math.ceil(filtered.length / CATALOG_PAGE_SIZE))
    : 1;
  const safeCatalogPage = Math.min(catalogPage, catalogPageCount);
  const pagedCatalog = useMemo(() => {
    if (!paginateCatalog) return filtered;
    const start = (safeCatalogPage - 1) * CATALOG_PAGE_SIZE;
    return filtered.slice(start, start + CATALOG_PAGE_SIZE);
  }, [filtered, paginateCatalog, safeCatalogPage]);

  const cartPageCount =
    paginateCart && cart.length > CART_PAGE_SIZE
      ? Math.max(1, Math.ceil(cart.length / CART_PAGE_SIZE))
      : 1;
  const safeCartPage = Math.min(cartPage, cartPageCount);
  const pagedCart = useMemo(() => {
    if (!paginateCart || cart.length <= CART_PAGE_SIZE) return cart;
    const start = (safeCartPage - 1) * CART_PAGE_SIZE;
    return cart.slice(start, start + CART_PAGE_SIZE);
  }, [cart, paginateCart, safeCartPage]);

  useEffect(() => {
    setCatalogPage(1);
  }, [category, scan.value]);

  useEffect(() => {
    if (catalogPage > catalogPageCount) setCatalogPage(catalogPageCount);
  }, [catalogPage, catalogPageCount]);

  useEffect(() => {
    if (!paginateCart || cart.length <= CART_PAGE_SIZE) {
      setCartPage(1);
      prevCartLen.current = cart.length;
      return;
    }
    const maxPage = Math.ceil(cart.length / CART_PAGE_SIZE);
    if (cart.length > prevCartLen.current) {
      setCartPage(maxPage);
    } else {
      setCartPage((p) => Math.min(p, maxPage));
    }
    prevCartLen.current = cart.length;
  }, [cart.length, paginateCart]);

  const total = cart.reduce((s, l) => s + l.price * l.quantity, 0);
  const linesCount = cart.reduce((s, l) => s + l.quantity, 0);
  const activeLabel = category === "Tous" ? "Catalogue" : category;

  const cartQtyById = useMemo(() => {
    const map = new Map<string, number>();
    for (const line of cart) {
      map.set(line.menuItemId, (map.get(line.menuItemId) ?? 0) + line.quantity);
    }
    return map;
  }, [cart]);

  const itemById = useMemo(() => {
    const map = new Map(items.map((i) => [i.id, i]));
    return map;
  }, [items]);

  /** Stock restant — décompte panier en live (caisse / resto). */
  function liveStock(item: PosMenuItem): number | null {
    if (typeof item.stockQty !== "number") return null;
    const inCart = cartQtyById.get(item.id) ?? 0;
    return Math.max(0, item.stockQty - inCart);
  }

  function tryAdd(item: PosMenuItem): boolean {
    const rem = liveStock(item);
    if (rem !== null && rem <= 0) return false;
    onAdd(item);
    return true;
  }

  function trySetQty(menuItemId: string, quantity: number) {
    const item = itemById.get(menuItemId);
    if (item && typeof item.stockQty === "number") {
      quantity = Math.min(quantity, item.stockQty);
    }
    onSetQty(menuItemId, quantity);
  }

  function addFromBarcode(raw: string): "ok" | "unknown" | "stock" | "skip" {
    const code = normalizeBarcode(raw);
    if (!code) return "skip";
    const item = itemByBarcode.get(code);
    if (!item) {
      if (!looksLikeBarcode(raw)) return "skip";
      setScanFlash("err");
      toast.error(`Produit inconnu : ${code}`);
      return "unknown";
    }
    const rem = liveStock(item);
    if (rem !== null && rem <= 0) {
      setScanFlash("err");
      toast.error(`Rupture — ${item.name}`);
      return "stock";
    }
    if (!tryAdd(item)) {
      setScanFlash("err");
      toast.error(`Rupture — ${item.name}`);
      return "stock";
    }
    setScanFlash("ok");
    toast.success(`${item.name} · +1`, { duration: 1200 });
    return "ok";
  }

  function onSearchKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    e.stopPropagation();
    const raw = scan.value.trim() || e.currentTarget.value.trim();
    if (!raw) return;
    const result = addFromBarcode(raw);
    if (result === "ok" || result === "unknown" || result === "stock") {
      scan.clear();
    }
    // Recherche par nom : Enter ne vide pas le filtre
  }

  useEffect(() => {
    if (!scanFlash) return;
    const t = window.setTimeout(() => setScanFlash(null), 700);
    return () => window.clearTimeout(t);
  }, [scanFlash]);

  return (
    <div
      className={cn(
        "grid min-h-[min(70vh,720px)] overflow-hidden rounded-2xl border border-border bg-card shadow-sm lg:grid-cols-[minmax(0,1fr)_320px]",
        className,
      )}
    >
      <div className="flex min-h-0 flex-col border-b border-border lg:border-b-0 lg:border-r">
        <div className="flex items-center gap-3 bg-primary px-4 py-3 text-primary-foreground">
          <div className="min-w-0 shrink-0">
            <p className="truncate text-lg font-semibold tracking-tight">
              {activeLabel}
            </p>
            <p className="text-xs text-primary-foreground/80">
              {filtered.length} article{filtered.length === 1 ? "" : "s"}
            </p>
          </div>
          <div
            className={cn(
              "relative flex min-w-0 flex-1 items-center gap-2 rounded-lg border px-2.5 py-1.5 transition",
              !scanFlash && "border-neutral-200 bg-white dark:border-neutral-200 dark:bg-white",
              scanFlash === "ok" &&
                "border-emerald-500 bg-white ring-2 ring-emerald-500/40 dark:bg-white",
              scanFlash === "err" &&
                "border-rose-500 bg-white ring-2 ring-rose-500/40 dark:bg-white",
            )}
          >
            <Barcode className="size-4 shrink-0 text-neutral-500" />
            <Input
              ref={scan.inputRef}
              value={scan.value}
              onChange={(e) => scan.setValue(e.target.value)}
              onKeyDown={onSearchKeyDown}
              onBlur={() => {
                window.setTimeout(() => {
                  if (document.activeElement?.tagName === "INPUT") return;
                  if (document.activeElement?.tagName === "TEXTAREA") return;
                  if (document.activeElement?.tagName === "SELECT") return;
                  if (
                    (document.activeElement as HTMLElement | null)
                      ?.isContentEditable
                  ) {
                    return;
                  }
                  scan.focus();
                }, 120);
              }}
              placeholder="Nom ou code-barres…"
              className="h-8 min-w-0 flex-1 border-0 bg-white px-0 text-sm text-black shadow-none placeholder:text-neutral-400 focus-visible:ring-0 dark:bg-white dark:text-black dark:placeholder:text-neutral-400"
              autoComplete="off"
              aria-label="Recherche et scan code-barres"
            />
            {scan.value ? (
              <button
                type="button"
                className="shrink-0 rounded p-0.5 text-neutral-500 hover:text-black"
                aria-label="Effacer"
                onClick={() => {
                  scan.clear();
                  scan.focus();
                }}
              >
                <X className="size-3.5" />
              </button>
            ) : null}
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col bg-muted/30">
          <div className="min-h-0 flex-1 overflow-auto p-3 sm:p-4">
            {filtered.length === 0 ? (
              <p className="py-16 text-center text-sm text-muted-foreground">
                Aucun article dans cette catégorie.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                {pagedCatalog.map((item) => {
                  const rem = liveStock(item);
                  const soldOut = rem === 0;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => tryAdd(item)}
                      disabled={soldOut}
                      aria-disabled={soldOut}
                      className={cn(
                        "group relative aspect-[4/5] overflow-hidden rounded-xl text-left shadow-sm transition",
                        "ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                        "bg-gradient-to-br",
                        toneFor(item.id + item.category),
                        soldOut
                          ? "cursor-not-allowed grayscale opacity-45"
                          : "hover:scale-[1.02] hover:shadow-md active:scale-[0.98]",
                      )}
                    >
                      {item.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.imageUrl}
                          alt=""
                          className={cn(
                            "absolute inset-0 size-full object-cover",
                            soldOut && "grayscale",
                          )}
                        />
                      ) : (
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.22),transparent_55%)]" />
                      )}
                      <div
                        className={cn(
                          "absolute inset-0",
                          item.imageUrl ? "bg-black/25" : null,
                          soldOut && "bg-black/40",
                        )}
                      />
                      <div className="absolute top-2 right-2 rounded-md bg-black/35 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-white uppercase backdrop-blur-sm">
                        {formatPrice(item.price)}
                      </div>
                      {rem !== null ? (
                        <div
                          className={cn(
                            "absolute top-2 left-2 rounded-md px-1.5 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm",
                            rem <= 0
                              ? "bg-rose-600/90"
                              : rem <= 5
                                ? "bg-amber-600/85"
                                : "bg-emerald-700/80",
                          )}
                        >
                          {rem <= 0 ? "Rupture" : `Stock ${rem}`}
                        </div>
                      ) : null}
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/45 to-transparent px-2.5 pt-8 pb-2.5">
                        <p className="line-clamp-2 text-sm font-semibold text-white drop-shadow">
                          {item.name}
                        </p>
                        <p className="mt-0.5 text-[11px] text-white/75">
                          {soldOut
                            ? "Indisponible"
                            : item.needsKitchen
                              ? "Cuisine"
                              : item.category}
                          {!soldOut && rem !== null ? ` · ${rem} dispo` : ""}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          {paginateCatalog && filtered.length > CATALOG_PAGE_SIZE ? (
            <div className="border-t border-border px-3 py-2">
              <PosPager
                page={safeCatalogPage}
                pageCount={catalogPageCount}
                total={filtered.length}
                pageSize={CATALOG_PAGE_SIZE}
                onPage={setCatalogPage}
              />
            </div>
          ) : null}
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

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-auto px-3 py-3">
            {cart.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                {emptyHint}
              </p>
            ) : (
              <ul className="space-y-2">
                {pagedCart.map((line) => (
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
                          {formatPrice(line.price)} / u.
                        </p>
                      </div>
                      <p className="shrink-0 text-sm font-semibold tabular-nums">
                        {formatPrice(line.price * line.quantity)}
                      </p>
                    </div>
                    <div className="mt-2 flex items-center gap-1.5">
                      <button
                        type="button"
                        className="flex size-7 items-center justify-center rounded-md border border-border bg-card hover:bg-muted"
                        onClick={() =>
                          trySetQty(line.menuItemId, line.quantity - 1)
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
                        className="flex size-7 items-center justify-center rounded-md border border-border bg-card hover:bg-muted disabled:opacity-40"
                        disabled={(() => {
                          const item = itemById.get(line.menuItemId);
                          if (!item || typeof item.stockQty !== "number") {
                            return false;
                          }
                          return line.quantity >= item.stockQty;
                        })()}
                        onClick={() =>
                          trySetQty(line.menuItemId, line.quantity + 1)
                        }
                        aria-label="Augmenter"
                      >
                        <Plus className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        className="ml-auto flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => trySetQty(line.menuItemId, 0)}
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
          {paginateCart && cart.length > CART_PAGE_SIZE ? (
            <div className="border-t border-border px-3 py-2">
              <PosPager
                page={safeCartPage}
                pageCount={cartPageCount}
                total={cart.length}
                pageSize={CART_PAGE_SIZE}
                onPage={setCartPage}
              />
            </div>
          ) : null}
        </div>

        <div className="mt-auto space-y-3 border-t border-border bg-muted/20 px-4 py-4">
          <div className="flex items-end justify-between gap-3">
            <span className="text-sm text-muted-foreground">Total</span>
            <span className="text-2xl font-bold tracking-tight tabular-nums">
              {formatPrice(total)}
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
      const nextQty = (existing?.quantity ?? 0) + 1;
      if (typeof item.stockQty === "number" && nextQty > item.stockQty) {
        return prev;
      }
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
  const locked = Boolean(props.disabled || props.pending);
  return (
    <Button
      size="lg"
      className={cn(
        "h-12 w-full text-base font-semibold",
        locked && "pointer-events-none opacity-50",
        props.className,
      )}
      aria-disabled={locked || undefined}
      // Évite le mismatch SSR Base UI (`disabled={true}` vs `disabled={null}`).
      onClick={() => {
        if (locked) return;
        props.onClick();
      }}
    >
      {props.label}
    </Button>
  );
}
