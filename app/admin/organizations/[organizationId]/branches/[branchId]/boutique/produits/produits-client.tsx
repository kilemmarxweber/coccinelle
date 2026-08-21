"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  BadgePercent,
  ChevronLeft,
  ChevronRight,
  ImagePlus,
  Package,
  Pencil,
  Plus,
  Search,
  UtensilsCrossed,
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
import { Switch } from "@/components/ui/switch";
import {
  createShopCategoryAction,
  createShopProductAction,
  generateShopBarcodeAction,
  notifyShopProductPromoWhatsAppAction,
  updateShopProductAction,
  type ShopProductDto,
} from "@/lib/boutique/actions";
import { branchDashboardPath, boutiqueRoutes } from "@/lib/branch/paths";
import {
  BoutiqueHero,
  BoutiquePage,
  boutiqueOutlineBtn,
  boutiquePrimaryBtn,
} from "@/components/boutique/boutique-shell";
import { cn } from "@/lib/utils";

/** 2 lignes × 3 colonnes (grille lg). */
const PAGE_SIZE = 6;

type Category = { id: string; name: string };

type FormState = {
  name: string;
  sku: string;
  categoryId: string;
  kind: "ARTICLE" | "PLAT";
  price: string;
  stockQty: string;
  barcode: string;
  imageUrl: string | null;
  active: boolean;
  promoActive: boolean;
  promoPrice: string;
  promoLabel: string;
};

const EMPTY: FormState = {
  name: "",
  sku: "",
  categoryId: "",
  kind: "ARTICLE",
  price: "",
  stockQty: "0",
  barcode: "",
  imageUrl: null,
  active: true,
  promoActive: false,
  promoPrice: "",
  promoLabel: "",
};

type Props = {
  organizationId: string;
  branchId: string;
  branchName: string;
  products: ShopProductDto[];
  categories: Category[];
};

export function BoutiqueProduitsClient(props: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [q, setQ] = useState("");
  const [kindFilter, setKindFilter] = useState<"ALL" | "ARTICLE" | "PLAT">(
    "ALL",
  );
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ShopProductDto | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [newCat, setNewCat] = useState("");
  const [page, setPage] = useState(1);
  const fileRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return props.products.filter((p) => {
      if (kindFilter !== "ALL" && p.kind !== kindFilter) return false;
      if (!query) return true;
      return (
        p.name.toLowerCase().includes(query) ||
        p.sku.toLowerCase().includes(query) ||
        p.categoryName.toLowerCase().includes(query) ||
        (p.barcode?.toLowerCase().includes(query) ?? false)
      );
    });
  }, [props.products, q, kindFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);

  const pageItems = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, safePage]);

  useEffect(() => {
    setPage(1);
  }, [q, kindFilter]);

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  function openCreate() {
    setEditing(null);
    setForm({
      ...EMPTY,
      categoryId: props.categories[0]?.id ?? "",
    });
    setDialogOpen(true);
  }

  function openEdit(p: ShopProductDto) {
    setEditing(p);
    setForm({
      name: p.name,
      sku: p.sku,
      categoryId: p.categoryId,
      kind: p.kind,
      price: String(p.price),
      stockQty: String(p.stockQty),
      barcode: p.barcode ?? "",
      imageUrl: p.imageUrl,
      active: p.active,
      promoActive: p.promoActive,
      promoPrice: p.promoPrice != null ? String(p.promoPrice) : "",
      promoLabel: p.promoLabel ?? "",
    });
    setDialogOpen(true);
  }

  function onPickImage(file: File | undefined) {
    if (!file) return;
    if (file.size > 512_000) {
      toast.error("Image trop volumineuse (max. 512 Ko).");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : null;
      setForm((f) => ({ ...f, imageUrl: dataUrl }));
    };
    reader.readAsDataURL(file);
  }

  function save() {
    const price = Number(form.price);
    const stockQty = Number(form.stockQty);
    if (!form.name.trim()) {
      toast.error("Nom requis");
      return;
    }
    if (!form.sku.trim()) {
      toast.error("SKU requis");
      return;
    }
    if (!form.categoryId) {
      toast.error("Catégorie requise");
      return;
    }
    if (!(price >= 0) || Number.isNaN(price)) {
      toast.error("Prix invalide");
      return;
    }
    start(async () => {
      try {
        const payload = {
          organizationId: props.organizationId,
          branchId: props.branchId,
          categoryId: form.categoryId,
          name: form.name,
          sku: form.sku,
          kind: form.kind,
          price,
          stockQty: Number.isFinite(stockQty) ? stockQty : 0,
          barcode: form.barcode || null,
          imageUrl: form.imageUrl,
          promoActive: form.promoActive,
          promoPrice: form.promoActive
            ? Number(form.promoPrice)
            : form.promoPrice
              ? Number(form.promoPrice)
              : null,
          promoLabel: form.promoLabel || null,
        };
        if (editing) {
          await updateShopProductAction({
            ...payload,
            productId: editing.id,
            active: form.active,
          });
          toast.success("Produit mis à jour");
        } else {
          await createShopProductAction(payload);
          toast.success("Produit créé");
        }
        setDialogOpen(false);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erreur");
      }
    });
  }

  function createCategory() {
    const name = newCat.trim();
    if (!name) return;
    start(async () => {
      try {
        const cat = await createShopCategoryAction({
          organizationId: props.organizationId,
          branchId: props.branchId,
          name,
        });
        setNewCat("");
        setForm((f) => ({ ...f, categoryId: cat.id }));
        toast.success("Catégorie créée");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erreur");
      }
    });
  }

  function genBarcode() {
    start(async () => {
      try {
        const code = await generateShopBarcodeAction(
          props.organizationId,
          props.branchId,
        );
        setForm((f) => ({ ...f, barcode: code }));
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erreur");
      }
    });
  }

  return (
    <BoutiquePage>
      <BoutiqueHero
        kicker={`${props.branchName} · catalogue`}
        title="Produits"
        subtitle="Fiches POS — le stock se remplit par réception depuis l’entrepôt."
        icon={Package}
        backHref={branchDashboardPath(props.organizationId, props.branchId)}
        actions={
          <>
            <Button
              variant="outline"
              className={boutiqueOutlineBtn()}
              render={
                <Link
                  href={boutiqueRoutes.stock(
                    props.organizationId,
                    props.branchId,
                  )}
                />
              }
            >
              Stock
            </Button>
            <Button
              variant="outline"
              className={boutiqueOutlineBtn()}
              render={
                <Link
                  href={boutiqueRoutes.pos(props.organizationId, props.branchId)}
                />
              }
            >
              POS
            </Button>
            <Button className={boutiquePrimaryBtn()} onClick={openCreate}>
              <Plus className="size-4" />
              Nouveau produit
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Rechercher nom, SKU, code-barres…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        {(["ALL", "ARTICLE", "PLAT"] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKindFilter(k)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-semibold",
              kindFilter === k
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground",
            )}
          >
            {k === "ALL" ? "Tous" : k === "ARTICLE" ? "Articles" : "Plats"}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {pageItems.map((p) => (
          <div
            key={p.id}
            role="button"
            tabIndex={0}
            onClick={() => openEdit(p)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                openEdit(p);
              }
            }}
            className="cursor-pointer rounded-[1.35rem] border border-[#e4ddd0] bg-white/90 p-4 text-left shadow-[0_18px_40px_-24px_rgba(15,61,46,0.22)] transition hover:-translate-y-0.5 hover:border-[#c4a574]/50"
          >
            <div className="flex items-start gap-3">
              <div className="relative size-16 shrink-0 overflow-hidden rounded-2xl border border-[#eee8dc] bg-[#faf8f4]">
                {p.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.imageUrl}
                    alt=""
                    className="size-full object-cover"
                  />
                ) : (
                  <span className="flex size-full items-center justify-center text-muted-foreground">
                    <ImagePlus className="size-5 opacity-50" />
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold">{p.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.categoryName} · {p.sku}
                    </p>
                  </div>
                  <Pencil className="size-4 shrink-0 text-muted-foreground" />
                </div>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <Badge variant="secondary">
                {p.kind === "PLAT" ? (
                  <>
                    <UtensilsCrossed className="mr-1 size-3" />
                    Plat
                  </>
                ) : (
                  "Article"
                )}
              </Badge>
              {p.promoLive ? (
                <Badge className="bg-amber-500/15 text-amber-800 dark:text-amber-200">
                  <BadgePercent className="mr-1 size-3" />
                  Promo
                </Badge>
              ) : null}
              {!p.active ? <Badge variant="outline">Inactif</Badge> : null}
              {p.promoLive ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  disabled={pending}
                  onClick={(e) => {
                    e.stopPropagation();
                    start(async () => {
                      try {
                        const res = await notifyShopProductPromoWhatsAppAction({
                          organizationId: props.organizationId,
                          branchId: props.branchId,
                          productId: p.id,
                        });
                        toast.success(
                          `WhatsApp promo : ${res.sent}/${res.total} envoyé(s)`,
                        );
                      } catch (err) {
                        toast.error(
                          err instanceof Error
                            ? err.message
                            : "Envoi impossible",
                        );
                      }
                    });
                  }}
                >
                  Notifier WhatsApp
                </Button>
              ) : null}
            </div>
            <div className="mt-3 flex items-end justify-between">
              <div>
                {p.promoLive ? (
                  <p className="text-sm">
                    <span className="font-bold text-emerald-600">
                      {p.effectivePrice.toFixed(2)} $
                    </span>{" "}
                    <span className="text-muted-foreground line-through">
                      {p.price.toFixed(2)} $
                    </span>
                  </p>
                ) : (
                  <p className="font-bold">{p.price.toFixed(2)} $</p>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Stock {p.stockQty}
              </p>
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          Aucun produit.
        </p>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card/60 px-3 py-2.5 shadow-sm">
          <p className="text-xs text-muted-foreground tabular-nums">
            {(safePage - 1) * PAGE_SIZE + 1}–
            {Math.min(safePage * PAGE_SIZE, filtered.length)} sur{" "}
            {filtered.length}
          </p>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label="Page précédente"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className={cn(
                "rounded-full",
                safePage <= 1 && "pointer-events-none opacity-40",
              )}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <div className="flex items-center gap-1 px-1">
              {Array.from({ length: pageCount }, (_, i) => i + 1).map(
                (n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setPage(n)}
                    aria-label={`Page ${n}`}
                    aria-current={n === safePage ? "page" : undefined}
                    className={cn(
                      "flex size-8 items-center justify-center rounded-full text-xs font-semibold transition",
                      n === safePage
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    {n}
                  </button>
                ),
              )}
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label="Page suivante"
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              className={cn(
                "rounded-full",
                safePage >= pageCount && "pointer-events-none opacity-40",
              )}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Modifier le produit" : "Nouveau produit"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
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
                <Label>Photo (optionnel)</Label>
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
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  onPickImage(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Nom</Label>
              <Input
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>SKU</Label>
                <Input
                  value={form.sku}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, sku: e.target.value }))
                  }
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Type</Label>
                <select
                  className="h-9 rounded-lg border border-input bg-background px-3 text-sm"
                  value={form.kind}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      kind: e.target.value as "ARTICLE" | "PLAT",
                    }))
                  }
                >
                  <option value="ARTICLE">Article</option>
                  <option value="PLAT">Plat</option>
                </select>
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>Catégorie</Label>
              <select
                className="h-9 rounded-lg border border-input bg-background px-3 text-sm"
                value={form.categoryId}
                onChange={(e) =>
                  setForm((f) => ({ ...f, categoryId: e.target.value }))
                }
              >
                <option value="">—</option>
                {props.categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <div className="flex gap-2">
                <Input
                  placeholder="Nouvelle catégorie"
                  value={newCat}
                  onChange={(e) => setNewCat(e.target.value)}
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending}
                  onClick={createCategory}
                >
                  Ajouter
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Prix catalogue ($)</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.price}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, price: e.target.value }))
                  }
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Stock</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.stockQty}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, stockQty: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>Code-barres</Label>
              <div className="flex gap-2">
                <Input
                  value={form.barcode}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, barcode: e.target.value }))
                  }
                />
                <Button type="button" variant="outline" onClick={genBarcode}>
                  Générer
                </Button>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-muted/30 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">Promotion</p>
                  <p className="text-xs text-muted-foreground">
                    Prix réduit activable pour ce produit
                  </p>
                </div>
                <Switch
                  checked={form.promoActive}
                  onCheckedChange={(v) =>
                    setForm((f) => ({ ...f, promoActive: v }))
                  }
                />
              </div>
              {form.promoActive ? (
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div className="grid gap-1.5">
                    <Label>Prix promo ($)</Label>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={form.promoPrice}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          promoPrice: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Libellé</Label>
                    <Input
                      placeholder="ex. −20 %"
                      value={form.promoLabel}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          promoLabel: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
              ) : null}
            </div>

            {editing ? (
              <div className="flex items-center justify-between">
                <Label>Actif</Label>
                <Switch
                  checked={form.active}
                  onCheckedChange={(v) =>
                    setForm((f) => ({ ...f, active: v }))
                  }
                />
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={pending}
            >
              Annuler
            </Button>
            <Button onClick={save} disabled={pending}>
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </BoutiquePage>
  );
}
