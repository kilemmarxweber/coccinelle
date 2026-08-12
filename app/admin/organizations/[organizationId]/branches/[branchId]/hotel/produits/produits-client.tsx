"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ChefHat,
  ImagePlus,
  Package,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Truck,
  Wine,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
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
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  createMenuItemAction,
  updateMenuItemAction,
} from "@/lib/hotel/actions";
import { generateInternalBarcode } from "@/lib/hotel/barcode";
import {
  HOTEL_MENU_CATEGORIES,
  STOCK_LOW_THRESHOLD,
  defaultNeedsKitchen,
  isConsumableCategory,
  type HotelMenuCategory,
} from "@/lib/hotel/menu-categories";
import {
  formatPrimaryAmount,
  formatUsdPrimaryInputValue,
  primaryAmountToUsd,
  primaryCurrencyLabel,
  primaryPriceInputStep,
  type NormalizedUsdCdfRate,
} from "@/lib/cash/exchange";
import { cn } from "@/lib/utils";

type MenuItem = {
  id: string;
  name: string;
  category: string;
  price: number;
  imageUrl: string | null;
  stockQty: number;
  barcode?: string | null;
  needsKitchen: boolean;
  active: boolean;
  isConsumable?: boolean;
  provenance?: string | null;
  supplierName?: string | null;
  createdByUserId?: string | null;
  createdByName?: string | null;
};

type FormState = {
  name: string;
  category: HotelMenuCategory;
  price: string;
  stockQty: string;
  barcode: string;
  needsKitchen: boolean;
  active: boolean;
  imageUrl: string | null;
  provenance: string;
  supplierName: string;
};

const EMPTY_FORM: FormState = {
  name: "",
  category: "Plats",
  price: "",
  stockQty: "50",
  barcode: "",
  needsKitchen: true,
  active: true,
  imageUrl: null,
  provenance: "",
  supplierName: "",
};

function stockTone(qty: number) {
  if (qty <= 0) return "bg-rose-500/15 text-rose-700 dark:text-rose-300";
  if (qty <= STOCK_LOW_THRESHOLD) {
    return "bg-amber-500/15 text-amber-800 dark:text-amber-200";
  }
  return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
}

function stockLabel(qty: number) {
  if (qty <= 0) return "Rupture";
  if (qty <= STOCK_LOW_THRESHOLD) return `Stock bas · ${qty}`;
  return `Stock ${qty}`;
}

function categoryIcon(category: string) {
  const c = category.toLowerCase();
  if (c === "boissons") return Wine;
  if (c === "consommables") return Truck;
  if (c === "plats" || c === "petit-déj" || c === "desserts") return ChefHat;
  return Package;
}

export function ProduitsClient(props: {
  organizationId: string;
  branchId: string;
  items: MenuItem[];
  rate?: NormalizedUsdCdfRate | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("Tous");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<MenuItem | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const consumable = isConsumableCategory(form.category);
  const priceCurrency = primaryCurrencyLabel(props.rate);
  const priceStep = primaryPriceInputStep(props.rate);

  function fmt(amountUsd: number) {
    return formatPrimaryAmount(amountUsd, props.rate);
  }

  const categories = useMemo(() => {
    const set = new Set<string>(HOTEL_MENU_CATEGORIES);
    for (const item of props.items) set.add(item.category || "Divers");
    return ["Tous", ...[...set].sort((a, b) => a.localeCompare(b, "fr"))];
  }, [props.items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return props.items.filter((item) => {
      if (categoryFilter !== "Tous" && item.category !== categoryFilter) {
        return false;
      }
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        (item.barcode?.toLowerCase().includes(q) ?? false) ||
        (item.supplierName?.toLowerCase().includes(q) ?? false) ||
        (item.provenance?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [props.items, query, categoryFilter]);

  function openCreate() {
    setEditing(null);
    setForm({
      ...EMPTY_FORM,
      needsKitchen: defaultNeedsKitchen("Plats"),
    });
    setDialogOpen(true);
  }

  function openEdit(item: MenuItem) {
    setEditing(item);
    const category = (HOTEL_MENU_CATEGORIES as readonly string[]).includes(
      item.category,
    )
      ? (item.category as HotelMenuCategory)
      : item.isConsumable
        ? "Consommables"
        : "Divers";
    setForm({
      name: item.name,
      category,
      price:
        item.price > 0
          ? formatUsdPrimaryInputValue(item.price, props.rate)
          : "",
      stockQty: String(item.stockQty),
      barcode: item.barcode ?? "",
      needsKitchen: item.needsKitchen,
      active: item.active,
      imageUrl: item.imageUrl,
      provenance: item.provenance ?? "",
      supplierName: item.supplierName ?? "",
    });
    setDialogOpen(true);
  }

  function setCategory(category: HotelMenuCategory) {
    setForm((f) => ({
      ...f,
      category,
      needsKitchen: defaultNeedsKitchen(category),
    }));
  }

  function generateBarcode() {
    setForm((f) => ({
      ...f,
      barcode: generateInternalBarcode(props.branchId),
    }));
    toast.message("Code interne généré — enregistrez pour le conserver.");
  }

  async function onPickImage(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Choisissez une image (JPEG, PNG, WebP…).");
      return;
    }
    if (file.size > 512_000) {
      toast.error("Image trop volumineuse (max. 512 Ko).");
      return;
    }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("Lecture image impossible"));
      reader.readAsDataURL(file);
    });
    setForm((f) => ({ ...f, imageUrl: dataUrl }));
  }

  function save() {
    const name = form.name.trim();
    const isCons = isConsumableCategory(form.category);
    const priceRaw = form.price.trim();
    const pricePrimary = priceRaw === "" ? 0 : Number(priceRaw);
    const price =
      priceRaw === ""
        ? 0
        : primaryAmountToUsd(pricePrimary, props.rate);
    const stockQty = Math.round(Number(form.stockQty));
    if (!name) {
      toast.error("Nom du produit requis.");
      return;
    }
    if (!isCons && (!Number.isFinite(price) || price < 0)) {
      toast.error("Prix invalide.");
      return;
    }
    if (isCons && priceRaw !== "" && (!Number.isFinite(price) || price < 0)) {
      toast.error("Prix invalide.");
      return;
    }
    if (!Number.isFinite(stockQty) || stockQty < 0) {
      toast.error("Stock invalide.");
      return;
    }

    start(async () => {
      try {
        const payload = {
          organizationId: props.organizationId,
          branchId: props.branchId,
          name,
          category: form.category,
          price: isCons ? (priceRaw === "" ? 0 : price) : price,
          stockQty,
          needsKitchen: isCons ? false : form.needsKitchen,
          imageUrl: form.imageUrl,
          provenance: isCons ? form.provenance : null,
          supplierName: isCons ? form.supplierName : null,
          barcode: form.barcode.trim() || null,
        };
        if (editing) {
          await updateMenuItemAction({
            ...payload,
            itemId: editing.id,
            active: form.active,
          });
          toast.success("Produit mis à jour");
        } else {
          await createMenuItemAction(payload);
          toast.success("Produit enregistré");
        }
        setDialogOpen(false);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erreur");
      }
    });
  }

  function deactivate(item: MenuItem) {
    start(async () => {
      try {
        await updateMenuItemAction({
          organizationId: props.organizationId,
          branchId: props.branchId,
          itemId: item.id,
          name: item.name,
          category: (HOTEL_MENU_CATEGORIES as readonly string[]).includes(
            item.category,
          )
            ? item.category
            : item.isConsumable
              ? "Consommables"
              : "Divers",
          price: item.price,
          stockQty: item.stockQty,
          needsKitchen: item.needsKitchen,
          active: false,
          imageUrl: item.imageUrl,
          provenance: item.provenance,
          supplierName: item.supplierName,
        });
        toast.success("Produit désactivé");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erreur");
      }
    });
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-5 px-3 py-5 sm:px-5 lg:px-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-sky-500/15 text-sky-600">
            <Package className="size-6" />
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Produits</h1>
            <p className="text-sm text-muted-foreground">
              Catalogue de cette branche uniquement — lié aux membres qui y ont
              accès.
            </p>
          </div>
        </div>
        <Button type="button" onClick={openCreate} className="gap-1.5">
          <Plus className="size-4" />
          Nouveau produit
        </Button>
      </header>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un produit…"
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategoryFilter(cat)}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-medium transition",
                categoryFilter === cat
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80",
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border px-6 py-16 text-center">
          <p className="text-sm text-muted-foreground">
            Aucun produit dans ce filtre.
          </p>
          <Button type="button" className="mt-4" onClick={openCreate}>
            Ajouter un produit
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {filtered.map((item) => {
            const Icon = categoryIcon(item.category);
            const isCons =
              item.isConsumable || isConsumableCategory(item.category);
            return (
              <article
                key={item.id}
                className={cn(
                  "group flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition",
                  !item.active && "opacity-60",
                )}
              >
                <div className="relative aspect-[4/3] bg-muted">
                  {item.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="size-full object-cover"
                    />
                  ) : (
                    <div
                      className={cn(
                        "flex size-full items-center justify-center bg-gradient-to-br",
                        isCons
                          ? "from-amber-500/20 via-muted to-sky-500/15"
                          : "from-sky-500/20 via-muted to-violet-500/15",
                      )}
                    >
                      <Icon className="size-10 text-muted-foreground/70" />
                    </div>
                  )}
                  <div className="absolute top-2 left-2 flex flex-wrap gap-1">
                    <Badge
                      variant="secondary"
                      className="bg-black/55 text-white backdrop-blur-sm"
                    >
                      {item.category}
                    </Badge>
                  </div>
                  <div className="absolute top-2 right-2">
                    <Badge
                      variant="secondary"
                      className={cn("border-0", stockTone(item.stockQty))}
                    >
                      {stockLabel(item.stockQty)}
                    </Badge>
                  </div>
                </div>
                <div className="flex flex-1 flex-col gap-2 p-3">
                  <div>
                    <h2 className="line-clamp-2 text-sm font-semibold leading-snug">
                      {item.name}
                    </h2>
                    {isCons ? (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Non vendu
                        {item.supplierName
                          ? ` · ${item.supplierName}`
                          : item.provenance
                            ? ` · ${item.provenance}`
                            : ""}
                      </p>
                    ) : (
                      <p className="mt-0.5 text-sm font-medium tabular-nums text-primary">
                        {fmt(item.price)}
                      </p>
                    )}
                    {item.barcode ? (
                      <p className="mt-0.5 font-mono text-[10px] tracking-wide text-muted-foreground">
                        {item.barcode}
                      </p>
                    ) : null}
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {isCons
                        ? "Géré via Livraison"
                        : item.needsKitchen
                          ? "Passe en cuisine"
                          : "Service direct"}
                      {!item.active ? " · Inactif" : null}
                      {item.createdByName
                        ? ` · par ${item.createdByName}`
                        : null}
                    </p>
                  </div>
                  <div className="mt-auto flex gap-1.5">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="flex-1 gap-1"
                      disabled={pending}
                      onClick={() => openEdit(item)}
                    >
                      <Pencil className="size-3.5" />
                      Modifier
                    </Button>
                    {item.active ? (
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        disabled={pending}
                        aria-label="Désactiver"
                        onClick={() => deactivate(item)}
                      >
                        <Trash2 className="size-3.5 text-rose-600" />
                      </Button>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md" showCloseButton>
          <DialogHeader>
            <DialogTitle>
              {editing ? "Modifier le produit" : "Nouveau produit"}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-1">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="relative flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-dashed border-border bg-muted/40 transition hover:bg-muted/70"
              >
                {form.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={form.imageUrl}
                    alt=""
                    className="size-full object-cover"
                  />
                ) : (
                  <ImagePlus className="size-6 text-muted-foreground" />
                )}
              </button>
              <div className="min-w-0 flex-1 space-y-1.5">
                <Label>Photo</Label>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => fileRef.current?.click()}
                  >
                    Choisir
                  </Button>
                  {form.imageUrl ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        setForm((f) => ({ ...f, imageUrl: null }))
                      }
                    >
                      Retirer
                    </Button>
                  ) : null}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  JPEG / PNG / WebP · max. 512 Ko
                </p>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  void onPickImage(e.target.files?.[0] ?? null);
                  e.target.value = "";
                }}
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="product-name">Nom</Label>
              <Input
                id="product-name"
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                placeholder={
                  consumable ? "Ex. Savon liquide" : "Ex. Poulet grillé"
                }
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="product-category">Type</Label>
                <Select
                  id="product-category"
                  value={form.category}
                  onChange={(e) =>
                    setCategory(e.target.value as HotelMenuCategory)
                  }
                >
                  {HOTEL_MENU_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="product-price">
                  Prix ({priceCurrency}){consumable ? " · optionnel" : ""}
                </Label>
                <Input
                  id="product-price"
                  type="number"
                  min={0}
                  step={priceStep}
                  value={form.price}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, price: e.target.value }))
                  }
                  placeholder={consumable ? "Optionnel" : "0"}
                />
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="product-stock">Stock</Label>
              <Input
                id="product-stock"
                type="number"
                min={0}
                step={1}
                value={form.stockQty}
                onChange={(e) =>
                  setForm((f) => ({ ...f, stockQty: e.target.value }))
                }
              />
              <p className="text-[11px] text-muted-foreground">
                {consumable
                  ? "Géré via Livraison (entrées / décomptes)."
                  : "Décrémenté à chaque vente / commande."}
              </p>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="product-barcode">Code-barres</Label>
              <div className="flex gap-2">
                <Input
                  id="product-barcode"
                  value={form.barcode}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, barcode: e.target.value }))
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      e.currentTarget.blur();
                    }
                  }}
                  placeholder="Scanner ou saisir…"
                  className="font-mono uppercase"
                  autoComplete="off"
                />
                <Button
                  type="button"
                  variant="outline"
                  className="shrink-0 gap-1.5"
                  onClick={generateBarcode}
                  title={
                    form.barcode
                      ? "Régénérer un code interne"
                      : "Générer un code interne"
                  }
                >
                  <RefreshCw className="size-3.5" />
                  {form.barcode ? "Régénérer" : "Générer"}
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Scannez avec le lecteur USB, saisissez l’EAN fabricant, ou
                générez un code interne si le produit n’en a pas.
              </p>
            </div>

            {consumable ? (
              <>
                <div className="grid gap-1.5">
                  <Label htmlFor="product-provenance">
                    Provenance · optionnel
                  </Label>
                  <Input
                    id="product-provenance"
                    value={form.provenance}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, provenance: e.target.value }))
                    }
                    placeholder="Ex. Import, local…"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="product-supplier">
                    Fournisseur · optionnel
                  </Label>
                  <Input
                    id="product-supplier"
                    value={form.supplierName}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, supplierName: e.target.value }))
                    }
                    placeholder="Nom du fournisseur"
                  />
                </div>
                <p className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-100">
                  Les consommables ne s’affichent pas en resto ni en vente
                  rapide — uniquement dans Livraison.
                </p>
              </>
            ) : (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2.5">
                <div>
                  <p className="text-sm font-medium">Passe en cuisine</p>
                  <p className="text-xs text-muted-foreground">
                    Boissons : service direct · Plats / desserts : cuisine
                  </p>
                </div>
                <Switch
                  checked={form.needsKitchen}
                  onCheckedChange={(checked) =>
                    setForm((f) => ({ ...f, needsKitchen: Boolean(checked) }))
                  }
                />
              </div>
            )}

            {editing ? (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2.5">
                <div>
                  <p className="text-sm font-medium">Actif</p>
                  <p className="text-xs text-muted-foreground">
                    {consumable
                      ? "Invisible dans Livraison si désactivé"
                      : "Invisible en caisse / restauration si désactivé"}
                  </p>
                </div>
                <Switch
                  checked={form.active}
                  onCheckedChange={(checked) =>
                    setForm((f) => ({ ...f, active: Boolean(checked) }))
                  }
                />
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogOpen(false)}
            >
              Annuler
            </Button>
            <Button type="button" disabled={pending} onClick={save}>
              {editing ? "Enregistrer" : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
