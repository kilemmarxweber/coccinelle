"use client";

import { useEffect, useMemo, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  CheckCircle2,
  ClipboardList,
  MapPin,
  Package,
  PackagePlus,
  Plus,
  Printer,
  RefreshCw,
  Search,
  Tags,
  Warehouse,
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
import {
  adjustShopStockAction,
  type ShopProductDto,
} from "@/lib/boutique/actions";
import { branchDashboardPath } from "@/lib/branch/paths";
import {
  adjustWarehouseStockAction,
  cancelWarehouseSlipAction,
  createWarehouseSlipAction,
  printWarehouseSlipAction,
  receiveWarehouseSlipAction,
  shipWarehouseToPosAction,
  upsertWarehouseCategoryAction,
  upsertWarehouseLocationAction,
  upsertWarehouseProductAction,
  validateWarehouseSlipAction,
} from "@/lib/warehouse/actions";
import { openPrintHtml } from "@/lib/warehouse/open-print-html";
import {
  BoutiqueHero,
  BoutiqueKpis,
  BoutiquePage,
  BoutiqueTabs,
  boutiqueOutlineBtn,
} from "@/components/boutique/boutique-shell";
import {
  WAREHOUSE_DESTINATIONS,
  WAREHOUSE_LOCATION_ZONES,
  WAREHOUSE_PRODUCT_TYPES,
  warehouseDestinationLabel,
  warehouseLocationZoneLabel,
  warehouseProductTypeLabel,
  type WarehouseDestinationCode,
  type WarehouseLocationZoneCode,
  type WarehouseProductTypeCode,
} from "@/lib/warehouse/labels";
import { cn } from "@/lib/utils";

type Dash = Awaited<
  ReturnType<typeof import("@/lib/warehouse/actions").getWarehouseDashboardAction>
>;

type ShopMovement = {
  id: string;
  kind: "ENTREE" | "SORTIE" | "AJUSTEMENT";
  quantity: number;
  note: string | null;
  createdAt: Date | string;
  product: { name: string; sku: string };
};

type Tab = "vue" | "principal" | "auxiliaire" | "bons" | "mouvements";

const S = {
  ink: "var(--foreground)",
  inkMid: "var(--primary)",
  accent: "var(--primary)",
  paper: "var(--muted)",
  line: "var(--border)",
  muted: "var(--muted-foreground)",
  brand: "var(--primary)",
} as const;

export function BoutiqueStockClient(props: {
  organizationId: string;
  branchId: string;
  branchName: string;
  warehouse: Dash;
  shopProducts: ShopProductDto[];
  shopMovements: ShopMovement[];
  initialTab?: Tab;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [tab, setTabState] = useState<Tab>(props.initialTab ?? "vue");

  useEffect(() => {
    if (props.initialTab) setTabState(props.initialTab);
  }, [props.initialTab]);

  function setTab(next: Tab) {
    setTabState(next);
    const url = new URL(window.location.href);
    if (next === "vue") url.searchParams.delete("tab");
    else url.searchParams.set("tab", next);
    router.replace(`${url.pathname}${url.search}`, { scroll: false });
  }
  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");

  const [productForm, setProductForm] = useState({
    name: "",
    type: "BOUTIQUE" as WarehouseProductTypeCode,
    categoryId: "",
    locationId: "",
    minQty: "5",
    unitCostUsd: "0",
    stockQty: "0",
  });

  const [catForm, setCatForm] = useState({
    productType: "BOUTIQUE" as WarehouseProductTypeCode,
    name: "",
  });
  const [locForm, setLocForm] = useState({
    zone: "STOCK" as WarehouseLocationZoneCode,
    floor: "RDC",
    code: "",
    label: "",
  });

  const [moveForm, setMoveForm] = useState({
    productId: "",
    kind: "ENTREE" as "ENTREE" | "SORTIE" | "AJUSTEMENT",
    quantity: "1",
    note: "",
  });

  const [slipKind, setSlipKind] = useState<"COMMANDE" | "SORTIE">("SORTIE");
  const [slipForm, setSlipForm] = useState({
    destination: "BOUTIQUE" as WarehouseDestinationCode,
    supplierName: "",
    note: "",
    managerUserId: props.warehouse.staff[0]?.id ?? "",
    recipientUserId:
      props.warehouse.staff[1]?.id ?? props.warehouse.staff[0]?.id ?? "",
  });
  const [slipLines, setSlipLines] = useState<
    {
      productId: string;
      name: string;
      productType: WarehouseProductTypeCode;
      quantity: string;
      unitCostUsd: string;
    }[]
  >([
    {
      productId: "",
      name: "",
      productType: "BOUTIQUE",
      quantity: "1",
      unitCostUsd: "0",
    },
  ]);

  const [auxDialog, setAuxDialog] = useState(false);
  const [auxProductId, setAuxProductId] = useState("");
  const [auxKind, setAuxKind] = useState<"ENTREE" | "AJUSTEMENT">("ENTREE");
  const [auxQty, setAuxQty] = useState("10");
  const [auxNote, setAuxNote] = useState("");

  const [receiveOpen, setReceiveOpen] = useState(false);
  const [receiveSlipId, setReceiveSlipId] = useState("");
  const [receiveSig, setReceiveSig] = useState("");
  const [receiveNote, setReceiveNote] = useState("");
  const [shipOpen, setShipOpen] = useState(false);
  const [shipQtys, setShipQtys] = useState<Record<string, string>>({});
  const [shipNote, setShipNote] = useState("");

  const categoriesForType = useMemo(
    () =>
      props.warehouse.categories.filter(
        (c) => c.productType === productForm.type,
      ),
    [props.warehouse.categories, productForm.type],
  );
  const stockLocations = useMemo(
    () => props.warehouse.locations.filter((l) => l.zone === "STOCK"),
    [props.warehouse.locations],
  );

  const products = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return props.warehouse.products.filter((p) => {
      if (typeFilter !== "ALL" && p.type !== typeFilter) return false;
      if (categoryFilter !== "ALL" && p.categoryId !== categoryFilter) {
        return false;
      }
      if (!needle) return true;
      return `${p.name} ${p.sku} ${p.categoryName ?? ""} ${p.locationLabel}`
        .toLowerCase()
        .includes(needle);
    });
  }, [props.warehouse.products, q, typeFilter, categoryFilter]);

  const filterCategories = useMemo(() => {
    if (typeFilter === "ALL") return props.warehouse.categories;
    return props.warehouse.categories.filter(
      (c) => c.productType === typeFilter,
    );
  }, [props.warehouse.categories, typeFilter]);

  const auxLow = useMemo(
    () => props.shopProducts.filter((p) => p.active && p.stockQty <= 5),
    [props.shopProducts],
  );

  const run = (fn: () => Promise<unknown>, ok?: string) => {
    start(async () => {
      try {
        await fn();
        toast.success(ok ?? "Enregistré");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erreur");
      }
    });
  };

  function printDoc(html: string) {
    try {
      openPrintHtml(html);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Impression impossible");
    }
  }

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: "vue", label: "Vue d’ensemble" },
    {
      id: "principal",
      label: "Stock principal",
      count: props.warehouse.kpis.products,
    },
    {
      id: "auxiliaire",
      label: "Stock auxiliaire",
      count: props.shopProducts.length,
    },
    {
      id: "bons",
      label: "Bons",
      count:
        props.warehouse.kpis.draftSlips +
        props.warehouse.kpis.awaitingReception,
    },
    {
      id: "mouvements",
      label: "Mouvements",
      count: props.warehouse.movements.length,
    },
  ];

  function saveAux() {
    const quantity = Number(auxQty);
    if (!auxProductId) {
      toast.error("Choisissez un produit");
      return;
    }
    if (!(quantity > 0) || Number.isNaN(quantity)) {
      toast.error("Quantité invalide");
      return;
    }
    run(async () => {
      await adjustShopStockAction({
        organizationId: props.organizationId,
        branchId: props.branchId,
        productId: auxProductId,
        kind: auxKind,
        quantity,
        note: auxNote || undefined,
      });
      setAuxDialog(false);
      setAuxNote("");
    }, auxKind === "ENTREE" ? "Entrée auxiliaire" : "Stock auxiliaire ajusté");
  }

  return (
    <BoutiquePage wide>
      <BoutiqueHero
        kicker={`${props.branchName} · entrepôt`}
        title="Stock commerce"
        subtitle="Le stock principal ravitaille le POS — document d’envoi, puis réception signée au point de vente."
        icon={Warehouse}
        backHref={branchDashboardPath(props.organizationId, props.branchId)}
        backLabel="Dashboard"
        actions={
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending}
            className={boutiqueOutlineBtn("gap-1.5")}
            onClick={() => router.refresh()}
          >
            <RefreshCw className="size-3.5" />
            Actualiser
          </Button>
        }
      />

      <BoutiqueKpis
        items={[
          {
            label: "Principal",
            value: String(props.warehouse.kpis.products),
            hint: "références",
          },
          {
            label: "Auxiliaire",
            value: String(props.shopProducts.length),
            hint: "POS",
          },
          {
            label: "Alertes",
            value: String(props.warehouse.kpis.alerts),
            hint: "seuil",
            tone: props.warehouse.kpis.alerts ? "warn" : "default",
          },
          {
            label: "À réceptionner",
            value: String(props.warehouse.kpis.awaitingReception),
            tone: props.warehouse.kpis.awaitingReception ? "warn" : "default",
          },
          {
            label: "Brouillons",
            value: String(props.warehouse.kpis.draftSlips),
          },
        ]}
      />

      <BoutiqueTabs items={tabs} value={tab} onChange={setTab} />

      {tab === "vue" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <section
            className="overflow-hidden rounded-xl border border-border bg-card shadow-sm"
            style={{ borderColor: S.line }}
          >
            <div
              className="flex items-center gap-2 border-b px-4 py-3"
              style={{ borderColor: S.line, background: "var(--muted)" }}
            >
              <AlertTriangle className="size-4 text-amber-600" />
              <p className="text-sm font-bold" style={{ color: S.ink }}>
                Alertes stock principal ({props.warehouse.alerts.length})
              </p>
            </div>
            {props.warehouse.alerts.length === 0 ? (
              <p
                className="px-4 py-10 text-center text-sm"
                style={{ color: S.muted }}
              >
                Aucune alerte — stocks au-dessus du seuil.
              </p>
            ) : (
              <ul className="divide-y" style={{ borderColor: S.line }}>
                {props.warehouse.alerts.map((a) => (
                  <li
                    key={a.id}
                    className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
                  >
                    <div>
                      <p
                        className="text-sm font-semibold"
                        style={{ color: S.ink }}
                      >
                        {a.name}
                      </p>
                      <p className="text-xs" style={{ color: S.muted }}>
                        {warehouseProductTypeLabel(a.type)}
                        {a.categoryName ? ` · ${a.categoryName}` : ""} · SKU{" "}
                        {a.sku}
                      </p>
                    </div>
                    <LevelBadge level={a.level} qty={a.stockQty} />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section
            className="overflow-hidden rounded-xl border border-border bg-card shadow-sm"
            style={{ borderColor: S.line }}
          >
            <div
              className="flex items-center gap-2 border-b px-4 py-3"
              style={{ borderColor: S.line, background: "var(--muted)" }}
            >
              <Package className="size-4 text-emerald-700" />
              <p className="text-sm font-bold" style={{ color: S.ink }}>
                Alertes stock auxiliaire ({auxLow.length})
              </p>
            </div>
            {auxLow.length === 0 ? (
              <p
                className="px-4 py-10 text-center text-sm"
                style={{ color: S.muted }}
              >
                POS OK — aucun produit ≤ 5.
              </p>
            ) : (
              <ul className="divide-y" style={{ borderColor: S.line }}>
                {auxLow.map((p) => (
                  <li
                    key={p.id}
                    className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
                  >
                    <div>
                      <p
                        className="text-sm font-semibold"
                        style={{ color: S.ink }}
                      >
                        {p.name}
                      </p>
                      <p className="text-xs" style={{ color: S.muted }}>
                        {p.categoryName} · {p.sku} · dispo POS {p.availableQty}
                      </p>
                    </div>
                    <LevelBadge
                      level={p.stockQty <= 0 ? "out" : "low"}
                      qty={p.stockQty}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      ) : null}

      {tab === "principal" ? (
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <section
            className="overflow-hidden rounded-xl border border-border bg-card shadow-sm"
            style={{ borderColor: S.line }}
          >
            <div
              className="flex flex-wrap items-center justify-between gap-2 border-b p-3"
              style={{ borderColor: S.line, background: "var(--muted)" }}
            >
              <div className="relative min-w-[200px] flex-1">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-emerald-700/50" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Rechercher produit / SKU"
                  className="h-10 rounded-xl border-emerald-100 bg-white pl-9"
                />
              </div>
              <select
                value={typeFilter}
                onChange={(e) => {
                  setTypeFilter(e.target.value);
                  setCategoryFilter("ALL");
                }}
                className="h-10 rounded-xl border border-emerald-100 bg-white px-3 text-sm"
              >
                <option value="ALL">Tous types</option>
                {WAREHOUSE_PRODUCT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {warehouseProductTypeLabel(t)}
                  </option>
                ))}
              </select>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="h-10 rounded-xl border border-emerald-100 bg-white px-3 text-sm"
              >
                <option value="ALL">Toutes catégories</option>
                {filterCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {typeFilter === "ALL" ? ` (${c.typeLabel})` : ""}
                  </option>
                ))}
              </select>
              <Button
                type="button"
                size="sm"
                className="h-10 rounded-xl text-white"
                style={{ background: S.brand }}
                onClick={() => {
                  setShipQtys({});
                  setShipNote("");
                  setShipOpen(true);
                }}
              >
                <ArrowUpFromLine className="size-3.5" />
                Ravitailler le POS
              </Button>
            </div>
            <ul className="divide-y" style={{ borderColor: S.line }}>
              {products.map((p) => (
                <li
                  key={p.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p
                      className="truncate text-sm font-semibold"
                      style={{ color: S.ink }}
                    >
                      {p.name}
                    </p>
                    <p className="text-xs" style={{ color: S.muted }}>
                      {p.typeLabel}
                      {p.categoryName ? ` · ${p.categoryName}` : ""} · {p.sku} ·
                      min {p.minQty} · {p.unitCostUsd.toFixed(2)} USD
                    </p>
                    <p className="mt-0.5 flex items-center gap-1 text-[11px] text-emerald-800/80">
                      <MapPin className="size-3 shrink-0" />
                      {p.deliveryPath}
                    </p>
                  </div>
                  <LevelBadge level={p.level} qty={p.stockQty} />
                </li>
              ))}
              {products.length === 0 ? (
                <li
                  className="px-4 py-12 text-center text-sm"
                  style={{ color: S.muted }}
                >
                  Aucun produit — créez-en un ou validez un bon commande.
                </li>
              ) : null}
            </ul>

            <div
              className="grid gap-4 border-t p-4 lg:grid-cols-2"
              style={{ borderColor: S.line }}
            >
              <div>
                <p
                  className="mb-2 flex items-center gap-2 text-sm font-bold"
                  style={{ color: S.ink }}
                >
                  <Tags className="size-4" /> Catégories
                </p>
                <div className="mb-2 grid grid-cols-2 gap-2">
                  <select
                    className="h-9 rounded-md border border-input bg-card px-2 text-sm"
                    value={catForm.productType}
                    onChange={(e) =>
                      setCatForm((f) => ({
                        ...f,
                        productType: e.target
                          .value as WarehouseProductTypeCode,
                      }))
                    }
                  >
                    {WAREHOUSE_PRODUCT_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {warehouseProductTypeLabel(t)}
                      </option>
                    ))}
                  </select>
                  <Input
                    value={catForm.name}
                    onChange={(e) =>
                      setCatForm((f) => ({ ...f, name: e.target.value }))
                    }
                    placeholder="Nom catégorie"
                  />
                </div>
                <Button
                  type="button"
                  size="sm"
                  disabled={pending || !catForm.name.trim()}
                  className="rounded-xl text-white"
                  style={{ background: S.brand }}
                  onClick={() =>
                    run(
                      () =>
                        upsertWarehouseCategoryAction({
                          organizationId: props.organizationId,
                          branchId: props.branchId,
                          productType: catForm.productType,
                          name: catForm.name,
                        }),
                      "Catégorie ajoutée",
                    )
                  }
                >
                  <Plus className="size-3.5" /> Ajouter
                </Button>
              </div>
              <div>
                <p
                  className="mb-2 flex items-center gap-2 text-sm font-bold"
                  style={{ color: S.ink }}
                >
                  <MapPin className="size-4" /> Emplacements
                </p>
                <div className="mb-2 grid grid-cols-2 gap-2">
                  <select
                    className="h-9 rounded-md border border-input bg-card px-2 text-sm"
                    value={locForm.zone}
                    onChange={(e) =>
                      setLocForm((f) => ({
                        ...f,
                        zone: e.target.value as WarehouseLocationZoneCode,
                      }))
                    }
                  >
                    {WAREHOUSE_LOCATION_ZONES.map((z) => (
                      <option key={z} value={z}>
                        {warehouseLocationZoneLabel(z)}
                      </option>
                    ))}
                  </select>
                  <Input
                    value={locForm.floor}
                    onChange={(e) =>
                      setLocForm((f) => ({ ...f, floor: e.target.value }))
                    }
                    placeholder="Étage"
                  />
                  <Input
                    value={locForm.code}
                    onChange={(e) =>
                      setLocForm((f) => ({ ...f, code: e.target.value }))
                    }
                    placeholder="Code"
                  />
                  <Input
                    value={locForm.label}
                    onChange={(e) =>
                      setLocForm((f) => ({ ...f, label: e.target.value }))
                    }
                    placeholder="Libellé"
                  />
                </div>
                <Button
                  type="button"
                  size="sm"
                  disabled={pending || !locForm.code.trim()}
                  className="rounded-xl text-white"
                  style={{ background: S.brand }}
                  onClick={() =>
                    run(
                      () =>
                        upsertWarehouseLocationAction({
                          organizationId: props.organizationId,
                          branchId: props.branchId,
                          zone: locForm.zone,
                          floor: locForm.floor,
                          code: locForm.code,
                          label: locForm.label,
                        }),
                      "Emplacement ajouté",
                    )
                  }
                >
                  <Plus className="size-3.5" /> Ajouter
                </Button>
              </div>
            </div>
          </section>

          <aside
            className="rounded-xl border border-border bg-card p-4 shadow-sm"
            style={{ borderColor: S.line }}
          >
            <p
              className="mb-3 flex items-center gap-2 text-sm font-bold"
              style={{ color: S.ink }}
            >
              <Plus className="size-4" /> Nouveau produit principal
            </p>
            <p className="mb-3 text-[11px]" style={{ color: S.muted }}>
              Deux produits peuvent porter le même nom — ils sont distingués par
              le SKU (généré automatiquement si vide).
            </p>
            <div className="space-y-2.5">
              <Field label="Nom">
                <Input
                  value={productForm.name}
                  onChange={(e) =>
                    setProductForm((f) => ({ ...f, name: e.target.value }))
                  }
                />
              </Field>
              <Field label="Type">
                <select
                  className="h-10 w-full rounded-md border border-input bg-card px-2 text-sm"
                  value={productForm.type}
                  onChange={(e) =>
                    setProductForm((f) => ({
                      ...f,
                      type: e.target.value as WarehouseProductTypeCode,
                      categoryId: "",
                    }))
                  }
                >
                  {WAREHOUSE_PRODUCT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {warehouseProductTypeLabel(t)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Catégorie">
                <select
                  className="h-10 w-full rounded-md border border-input bg-card px-2 text-sm"
                  value={productForm.categoryId}
                  onChange={(e) =>
                    setProductForm((f) => ({
                      ...f,
                      categoryId: e.target.value,
                    }))
                  }
                >
                  <option value="">—</option>
                  {categoriesForType.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Emplacement stock">
                <select
                  className="h-10 w-full rounded-md border border-input bg-card px-2 text-sm"
                  value={productForm.locationId}
                  onChange={(e) =>
                    setProductForm((f) => ({
                      ...f,
                      locationId: e.target.value,
                    }))
                  }
                >
                  <option value="">—</option>
                  {stockLocations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.fullLabel}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="grid grid-cols-3 gap-2">
                <Field label="Min">
                  <Input
                    value={productForm.minQty}
                    onChange={(e) =>
                      setProductForm((f) => ({ ...f, minQty: e.target.value }))
                    }
                  />
                </Field>
                <Field label="Coût">
                  <Input
                    value={productForm.unitCostUsd}
                    onChange={(e) =>
                      setProductForm((f) => ({
                        ...f,
                        unitCostUsd: e.target.value,
                      }))
                    }
                  />
                </Field>
                <Field label="Stock">
                  <Input
                    value={productForm.stockQty}
                    onChange={(e) =>
                      setProductForm((f) => ({
                        ...f,
                        stockQty: e.target.value,
                      }))
                    }
                  />
                </Field>
              </div>
              <Button
                type="button"
                disabled={pending || !productForm.name.trim()}
                className="w-full rounded-xl text-white"
                style={{ background: S.brand }}
                onClick={() =>
                  run(
                    () =>
                      upsertWarehouseProductAction({
                        organizationId: props.organizationId,
                        branchId: props.branchId,
                        name: productForm.name,
                        type: productForm.type,
                        categoryId: productForm.categoryId || null,
                        locationId: productForm.locationId || null,
                        minQty: Number(productForm.minQty) || 5,
                        unitCostUsd: Number(productForm.unitCostUsd) || 0,
                        stockQty: Number(productForm.stockQty) || 0,
                      }),
                    "Produit créé",
                  )
                }
              >
                Enregistrer
              </Button>
            </div>

            <div className="mt-6 border-t pt-4" style={{ borderColor: S.line }}>
              <p className="mb-3 text-sm font-bold" style={{ color: S.ink }}>
                Opération rapide
              </p>
              <div className="space-y-2">
                <select
                  className="h-10 w-full rounded-md border border-input bg-card px-2 text-sm"
                  value={moveForm.productId}
                  onChange={(e) =>
                    setMoveForm((f) => ({ ...f, productId: e.target.value }))
                  }
                >
                  <option value="">Produit…</option>
                  {props.warehouse.products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.stockQty})
                    </option>
                  ))}
                </select>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    className="h-10 rounded-md border border-input bg-card px-2 text-sm"
                    value={moveForm.kind}
                    onChange={(e) =>
                      setMoveForm((f) => ({
                        ...f,
                        kind: e.target.value as typeof f.kind,
                      }))
                    }
                  >
                    <option value="ENTREE">Entrée</option>
                    <option value="SORTIE">Sortie</option>
                    <option value="AJUSTEMENT">Ajustement</option>
                  </select>
                  <Input
                    value={moveForm.quantity}
                    onChange={(e) =>
                      setMoveForm((f) => ({ ...f, quantity: e.target.value }))
                    }
                    placeholder="Qté"
                  />
                </div>
                <Input
                  value={moveForm.note}
                  onChange={(e) =>
                    setMoveForm((f) => ({ ...f, note: e.target.value }))
                  }
                  placeholder="Note"
                />
                <Button
                  type="button"
                  disabled={pending || !moveForm.productId}
                  variant="outline"
                  className="w-full gap-1.5 rounded-xl border-emerald-200"
                  onClick={() =>
                    run(
                      () =>
                        adjustWarehouseStockAction({
                          organizationId: props.organizationId,
                          branchId: props.branchId,
                          productId: moveForm.productId,
                          kind: moveForm.kind,
                          quantity: Number(moveForm.quantity) || 0,
                          note: moveForm.note,
                        }),
                      "Mouvement enregistré",
                    )
                  }
                >
                  {moveForm.kind === "ENTREE" ? (
                    <ArrowDownToLine className="size-3.5" />
                  ) : (
                    <ArrowUpFromLine className="size-3.5" />
                  )}
                  Appliquer
                </Button>
              </div>
            </div>
          </aside>
        </div>
      ) : null}

      {tab === "auxiliaire" ? (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button
              onClick={() => setAuxDialog(true)}
              className="rounded-xl text-white"
              style={{ background: S.brand }}
            >
              <PackagePlus className="size-4" />
              Entrée / ajustement POS
            </Button>
          </div>
          <div
            className="overflow-hidden rounded-xl border border-border bg-card shadow-sm"
            style={{ borderColor: S.line }}
          >
            <table className="w-full text-sm">
              <thead
                className="text-left text-xs"
                style={{ background: "var(--muted)", color: S.muted }}
              >
                <tr>
                  <th className="px-3 py-2 font-medium">Produit</th>
                  <th className="px-3 py-2 font-medium">Type</th>
                  <th className="px-3 py-2 font-medium">Stock</th>
                  <th className="px-3 py-2 font-medium">Dispo POS</th>
                </tr>
              </thead>
              <tbody>
                {props.shopProducts.map((p) => (
                  <tr key={p.id} className="border-t" style={{ borderColor: S.line }}>
                    <td className="px-3 py-2">
                      <p className="font-medium" style={{ color: S.ink }}>
                        {p.name}
                      </p>
                      <p className="text-xs" style={{ color: S.muted }}>
                        {p.categoryName} · {p.sku}
                      </p>
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant="secondary">
                        {p.kind === "PLAT" ? "Plat" : "Article"}
                      </Badge>
                    </td>
                    <td
                      className={cn(
                        "px-3 py-2 tabular-nums",
                        p.stockQty <= 0
                          ? "font-semibold text-rose-600"
                          : p.stockQty <= 5
                            ? "font-semibold text-amber-700"
                            : "",
                      )}
                    >
                      {p.stockQty}
                    </td>
                    <td className="px-3 py-2 tabular-nums text-muted-foreground">
                      {p.availableQty}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {props.shopProducts.length === 0 ? (
              <p
                className="px-4 py-10 text-center text-sm"
                style={{ color: S.muted }}
              >
                Aucun stock POS. Le stock principal doit envoyer un ravitaillement
                (« Ravitailler le POS »), puis le caissier signe la réception.
              </p>
            ) : null}
          </div>
          <div>
            <h2
              className="mb-2 text-sm font-semibold"
              style={{ color: S.ink }}
            >
              Mouvements auxiliaires récents
            </h2>
            <div className="space-y-2">
              {props.shopMovements.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between rounded-xl border bg-white px-3 py-2 text-sm"
                  style={{ borderColor: S.line }}
                >
                  <div>
                    <p className="font-medium" style={{ color: S.ink }}>
                      {m.product.name}
                    </p>
                    <p className="text-xs" style={{ color: S.muted }}>
                      {m.kind} · {m.note || "—"}
                    </p>
                  </div>
                  <p className="tabular-nums font-semibold">
                    {m.kind === "SORTIE" ? "−" : "+"}
                    {m.quantity}
                  </p>
                </div>
              ))}
              {props.shopMovements.length === 0 ? (
                <p className="text-sm" style={{ color: S.muted }}>
                  Aucun mouvement auxiliaire.
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {tab === "mouvements" ? (
        <section
          className="overflow-hidden rounded-xl border border-border bg-card shadow-sm"
          style={{ borderColor: S.line }}
        >
          <ul className="divide-y" style={{ borderColor: S.line }}>
            {props.warehouse.movements.map((m) => (
              <li
                key={m.id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-semibold" style={{ color: S.ink }}>
                    {m.kind} · {m.productName}
                  </p>
                  <p className="text-xs" style={{ color: S.muted }}>
                    {new Date(m.createdAt).toLocaleString("fr-FR")} ·{" "}
                    {m.createdByName}
                    {m.note ? ` · ${m.note}` : ""}
                  </p>
                </div>
                <p
                  className="font-bold tabular-nums"
                  style={{ color: S.inkMid }}
                >
                  {m.stockBefore} → {m.stockAfter}{" "}
                  <span className="text-xs font-medium text-muted-foreground">
                    ({m.kind === "SORTIE" ? "−" : "+"}\u200a{m.quantity})
                  </span>
                </p>
              </li>
            ))}
            {props.warehouse.movements.length === 0 ? (
              <li
                className="px-4 py-12 text-center text-sm"
                style={{ color: S.muted }}
              >
                Aucun mouvement principal.
              </li>
            ) : null}
          </ul>
        </section>
      ) : null}

      {tab === "bons" ? (
        <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <section
            className="rounded-xl border border-border bg-card p-4 shadow-sm"
            style={{ borderColor: S.line }}
          >
            <div className="mb-3 flex flex-wrap gap-2">
              <button
                type="button"
                className={cn(
                  "rounded-xl px-3 py-1.5 text-xs font-bold",
                  slipKind === "SORTIE"
                    ? "text-white"
                    : "bg-emerald-50 text-emerald-900",
                )}
                style={slipKind === "SORTIE" ? { background: S.brand } : undefined}
                onClick={() => setSlipKind("SORTIE")}
              >
                Bon de sortie → POS
              </button>
              <button
                type="button"
                className={cn(
                  "rounded-xl px-3 py-1.5 text-xs font-bold",
                  slipKind === "COMMANDE"
                    ? "text-white"
                    : "bg-emerald-50 text-emerald-900",
                )}
                style={
                  slipKind === "COMMANDE" ? { background: S.brand } : undefined
                }
                onClick={() => setSlipKind("COMMANDE")}
              >
                Bon de commande
              </button>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              {slipKind === "SORTIE" ? (
                <Field label="Destination">
                  <select
                    className="h-10 w-full rounded-md border border-input bg-card px-2 text-sm"
                    value={slipForm.destination}
                    onChange={(e) =>
                      setSlipForm((f) => ({
                        ...f,
                        destination: e.target
                          .value as WarehouseDestinationCode,
                      }))
                    }
                  >
                    {WAREHOUSE_DESTINATIONS.map((d) => (
                      <option key={d} value={d}>
                        {warehouseDestinationLabel(d)}
                      </option>
                    ))}
                  </select>
                </Field>
              ) : (
                <Field label="Fournisseur">
                  <Input
                    value={slipForm.supplierName}
                    onChange={(e) =>
                      setSlipForm((f) => ({
                        ...f,
                        supplierName: e.target.value,
                      }))
                    }
                  />
                </Field>
              )}
              <Field label="Gestionnaire stock">
                <select
                  className="h-10 w-full rounded-md border border-input bg-card px-2 text-sm"
                  value={slipForm.managerUserId}
                  onChange={(e) =>
                    setSlipForm((f) => ({
                      ...f,
                      managerUserId: e.target.value,
                    }))
                  }
                >
                  {props.warehouse.staff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Réceptionnaire">
                <select
                  className="h-10 w-full rounded-md border border-input bg-card px-2 text-sm"
                  value={slipForm.recipientUserId}
                  onChange={(e) =>
                    setSlipForm((f) => ({
                      ...f,
                      recipientUserId: e.target.value,
                    }))
                  }
                >
                  {props.warehouse.staff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Note">
                <Input
                  value={slipForm.note}
                  onChange={(e) =>
                    setSlipForm((f) => ({ ...f, note: e.target.value }))
                  }
                />
              </Field>
            </div>

            <div className="mt-4 space-y-2">
              <p
                className="text-xs font-bold tracking-wide uppercase"
                style={{ color: S.muted }}
              >
                Lignes
              </p>
              {slipLines.map((line, idx) => (
                <div
                  key={idx}
                  className="grid gap-2 rounded-2xl border p-2.5 sm:grid-cols-[1fr_auto_auto_auto]"
                  style={{ borderColor: S.line }}
                >
                  {slipKind === "SORTIE" ? (
                    <select
                      className="h-9 w-full rounded-md border border-input bg-card px-2 text-sm"
                      value={line.productId}
                      onChange={(e) => {
                        const match = props.warehouse.products.find(
                          (p) => p.id === e.target.value,
                        );
                        setSlipLines((rows) =>
                          rows.map((r, i) =>
                            i === idx
                              ? {
                                  ...r,
                                  productId: match?.id ?? "",
                                  name: match?.name ?? "",
                                  productType:
                                    (match?.type as WarehouseProductTypeCode) ??
                                    r.productType,
                                  unitCostUsd: match
                                    ? String(match.unitCostUsd)
                                    : r.unitCostUsd,
                                }
                              : r,
                          ),
                        );
                      }}
                    >
                      <option value="">Produit · SKU · stock</option>
                      {props.warehouse.products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} · {p.sku} · stock {p.stockQty}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Input
                      placeholder="Nom (nouveau produit même si homonyme)"
                      value={line.name}
                      onChange={(e) => {
                        const name = e.target.value;
                        setSlipLines((rows) =>
                          rows.map((r, i) =>
                            i === idx
                              ? { ...r, name, productId: "" }
                              : r,
                          ),
                        );
                      }}
                    />
                  )}
                  <select
                    className="h-9 rounded-md border border-input bg-card px-2 text-xs"
                    value={line.productType}
                    onChange={(e) =>
                      setSlipLines((rows) =>
                        rows.map((r, i) =>
                          i === idx
                            ? {
                                ...r,
                                productType: e.target
                                  .value as WarehouseProductTypeCode,
                              }
                            : r,
                        ),
                      )
                    }
                  >
                    {WAREHOUSE_PRODUCT_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {warehouseProductTypeLabel(t)}
                      </option>
                    ))}
                  </select>
                  <Input
                    className="w-20"
                    value={line.quantity}
                    onChange={(e) =>
                      setSlipLines((rows) =>
                        rows.map((r, i) =>
                          i === idx ? { ...r, quantity: e.target.value } : r,
                        ),
                      )
                    }
                    placeholder="Qté"
                  />
                  <Input
                    className="w-24"
                    value={line.unitCostUsd}
                    onChange={(e) =>
                      setSlipLines((rows) =>
                        rows.map((r, i) =>
                          i === idx
                            ? { ...r, unitCostUsd: e.target.value }
                            : r,
                        ),
                      )
                    }
                    placeholder="P.U."
                  />
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-xl"
                onClick={() =>
                  setSlipLines((rows) => [
                    ...rows,
                    {
                      productId: "",
                      name: "",
                      productType: "BOUTIQUE",
                      quantity: "1",
                      unitCostUsd: "0",
                    },
                  ])
                }
              >
                <Plus className="size-3.5" /> Ligne
              </Button>
            </div>

            <Button
              type="button"
              disabled={pending}
              className="mt-4 w-full rounded-xl text-white"
              style={{ background: S.brand }}
              onClick={() =>
                run(async () => {
                  await createWarehouseSlipAction({
                    organizationId: props.organizationId,
                    branchId: props.branchId,
                    kind: slipKind,
                    destination:
                      slipKind === "SORTIE" ? slipForm.destination : null,
                    supplierName: slipForm.supplierName,
                    note: slipForm.note,
                    managerUserId: slipForm.managerUserId,
                    recipientUserId: slipForm.recipientUserId,
                    items: slipLines
                      .filter((l) =>
                        slipKind === "SORTIE"
                          ? Boolean(l.productId)
                          : l.name.trim(),
                      )
                      .map((l) => ({
                        productId: l.productId || null,
                        name: l.name,
                        productType: l.productType,
                        quantity: Number(l.quantity) || 1,
                        unitCostUsd: Number(l.unitCostUsd) || 0,
                        createProduct: slipKind === "COMMANDE",
                      })),
                  });
                }, "Brouillon créé")
              }
            >
              <ClipboardList className="mr-1.5 size-4" />
              Créer le brouillon
            </Button>
          </section>

          <section
            className="overflow-hidden rounded-xl border border-border bg-card shadow-sm"
            style={{ borderColor: S.line }}
          >
            <div
              className="border-b px-4 py-3"
              style={{ borderColor: S.line, background: "var(--muted)" }}
            >
              <p className="text-sm font-bold" style={{ color: S.ink }}>
                Documents récents
              </p>
            </div>
            <ul
              className="max-h-[70vh] divide-y overflow-y-auto"
              style={{ borderColor: S.line }}
            >
              {props.warehouse.slips.map((s) => (
                <li key={s.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p
                        className="text-sm font-bold"
                        style={{ color: S.ink }}
                      >
                        {s.number} · {s.kindLabel}
                      </p>
                      <p className="text-xs" style={{ color: S.muted }}>
                        {s.destinationLabel}
                        {s.supplierName ? ` · ${s.supplierName}` : ""} ·{" "}
                        {s.statusLabel ?? s.status}
                      </p>
                      <p className="mt-1 text-[11px]" style={{ color: S.muted }}>
                        Gestionnaire {s.managerName} · Reçoit {s.recipientName}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {s.status === "BROUILLON" ? (
                        <>
                          <Button
                            type="button"
                            size="sm"
                            disabled={pending}
                            className="h-8 rounded-lg text-white"
                            style={{ background: S.accent }}
                            onClick={() =>
                              start(async () => {
                                try {
                                  const res = await validateWarehouseSlipAction({
                                    organizationId: props.organizationId,
                                    branchId: props.branchId,
                                    slipId: s.id,
                                  });
                                  toast.success(
                                    res.status === "ENVOYE"
                                      ? "Bon envoyé — le POS doit signer la réception"
                                      : "Bon validé — stock mis à jour",
                                  );
                                  if (res.printHtml) printDoc(res.printHtml);
                                  router.refresh();
                                } catch (e) {
                                  toast.error(
                                    e instanceof Error ? e.message : "Erreur",
                                  );
                                }
                              })
                            }
                          >
                            <CheckCircle2 className="size-3.5" />{" "}
                            {s.kind === "SORTIE" &&
                            s.destination === "BOUTIQUE"
                              ? "Envoyer"
                              : "Valider"}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={pending}
                            className="h-8 rounded-lg"
                            onClick={() =>
                              run(
                                () =>
                                  cancelWarehouseSlipAction({
                                    organizationId: props.organizationId,
                                    branchId: props.branchId,
                                    slipId: s.id,
                                  }),
                                "Brouillon annulé",
                              )
                            }
                          >
                            Annuler
                          </Button>
                        </>
                      ) : null}
                      {s.status === "ENVOYE" &&
                      s.destination === "BOUTIQUE" ? (
                        <Button
                          type="button"
                          size="sm"
                          disabled={pending}
                          className="h-8 rounded-lg text-white"
                          style={{ background: S.accent }}
                          onClick={() => {
                            setReceiveSlipId(s.id);
                            setReceiveSig("");
                            setReceiveNote("");
                            setReceiveOpen(true);
                          }}
                        >
                          Réceptionner
                        </Button>
                      ) : null}
                      {s.status === "ENVOYE" || s.status === "RECU" ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={pending}
                          className="h-8 gap-1 rounded-lg border-emerald-200"
                          onClick={() =>
                            start(async () => {
                              try {
                                const html = await printWarehouseSlipAction({
                                  organizationId: props.organizationId,
                                  branchId: props.branchId,
                                  slipId: s.id,
                                  document: "envoi",
                                });
                                printDoc(html);
                              } catch (e) {
                                toast.error(
                                  e instanceof Error ? e.message : "Erreur",
                                );
                              }
                            })
                          }
                        >
                          <Printer className="size-3.5" /> Envoi
                        </Button>
                      ) : null}
                      {s.status === "RECU" ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={pending}
                          className="h-8 gap-1 rounded-lg border-emerald-200"
                          onClick={() =>
                            start(async () => {
                              try {
                                const html = await printWarehouseSlipAction({
                                  organizationId: props.organizationId,
                                  branchId: props.branchId,
                                  slipId: s.id,
                                  document: "reception",
                                });
                                printDoc(html);
                              } catch (e) {
                                toast.error(
                                  e instanceof Error ? e.message : "Erreur",
                                );
                              }
                            })
                          }
                        >
                          <Printer className="size-3.5" /> Réception
                        </Button>
                      ) : null}
                      {s.status === "VALIDE" ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={pending}
                          className="h-8 gap-1 rounded-lg border-emerald-200"
                          onClick={() =>
                            start(async () => {
                              try {
                                const html = await printWarehouseSlipAction({
                                  organizationId: props.organizationId,
                                  branchId: props.branchId,
                                  slipId: s.id,
                                  document: "envoi",
                                });
                                printDoc(html);
                              } catch (e) {
                                toast.error(
                                  e instanceof Error ? e.message : "Erreur",
                                );
                              }
                            })
                          }
                        >
                          <Printer className="size-3.5" /> PDF
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {s.items
                      .map((i) => `${i.name} ×${i.quantity}`)
                      .join(" · ")}
                  </p>
                </li>
              ))}
              {props.warehouse.slips.length === 0 ? (
                <li
                  className="px-4 py-12 text-center text-sm"
                  style={{ color: S.muted }}
                >
                  Aucun bon pour l’instant.
                </li>
              ) : null}
            </ul>
          </section>
        </div>
      ) : null}

      <Dialog open={auxDialog} onOpenChange={setAuxDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mouvement stock auxiliaire</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label>Produit</Label>
              <select
                className="h-9 rounded-lg border border-input bg-background px-3 text-sm"
                value={auxProductId}
                onChange={(e) => setAuxProductId(e.target.value)}
              >
                <option value="">—</option>
                {props.shopProducts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} (stock {p.stockQty})
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label>Type</Label>
              <select
                className="h-9 rounded-lg border border-input bg-background px-3 text-sm"
                value={auxKind}
                onChange={(e) =>
                  setAuxKind(e.target.value as "ENTREE" | "AJUSTEMENT")
                }
              >
                <option value="ENTREE">Entrée (+qty)</option>
                <option value="AJUSTEMENT">Ajustement (= nouveau stock)</option>
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label>
                {auxKind === "ENTREE" ? "Quantité à ajouter" : "Nouveau stock"}
              </Label>
              <Input
                type="number"
                min={0}
                value={auxQty}
                onChange={(e) => setAuxQty(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Note</Label>
              <Input
                value={auxNote}
                onChange={(e) => setAuxNote(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAuxDialog(false)}>
              Annuler
            </Button>
            <Button disabled={pending} onClick={saveAux}>
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={receiveOpen} onOpenChange={setReceiveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Réception bon de sortie</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <p className="text-sm text-muted-foreground">
              Contrôlez physiquement les produits, puis signez pour créditer le
              stock auxiliaire (POS).
            </p>
            <div className="grid gap-1.5">
              <Label>Signature (nom complet)</Label>
              <Input
                value={receiveSig}
                onChange={(e) => setReceiveSig(e.target.value)}
                placeholder="Prénom Nom"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Note (optionnel)</Label>
              <Input
                value={receiveNote}
                onChange={(e) => setReceiveNote(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReceiveOpen(false)}>
              Annuler
            </Button>
            <Button
              disabled={pending}
              onClick={() =>
                run(async () => {
                  await receiveWarehouseSlipAction({
                    organizationId: props.organizationId,
                    branchId: props.branchId,
                    slipId: receiveSlipId,
                    signature: receiveSig,
                    receiveNote: receiveNote || undefined,
                  }).then((res) => {
                    if (res.printHtml) printDoc(res.printHtml);
                  });
                  setReceiveOpen(false);
                }, "Réception enregistrée — stock auxiliaire crédité")
              }
            >
              Signer & recevoir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={shipOpen} onOpenChange={setShipOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Ravitailler le POS</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Envoi depuis le stock principal, sans demande du point de vente. Le
            caissier signe la réception au POS pour créditer l’auxiliaire.
          </p>
          <div className="max-h-64 space-y-2 overflow-y-auto">
            {props.warehouse.products.filter((p) => p.stockQty > 0).length ===
            0 ? (
              <p className="text-sm text-muted-foreground">
                Aucun stock principal disponible. Enregistrez d’abord une entrée
                ou un bon de commande.
              </p>
            ) : (
              props.warehouse.products
                .filter((p) => p.stockQty > 0)
                .map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-2 rounded-xl border px-3 py-2"
                    style={{ borderColor: S.line }}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{p.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {p.sku} · dispo {p.stockQty}
                      </p>
                    </div>
                    <Input
                      className="h-8 w-20"
                      inputMode="numeric"
                      placeholder="Qté"
                      value={shipQtys[p.id] ?? ""}
                      onChange={(e) =>
                        setShipQtys((q) => ({ ...q, [p.id]: e.target.value }))
                      }
                    />
                  </div>
                ))
            )}
          </div>
          <Field label="Note (optionnel)">
            <Input
              value={shipNote}
              onChange={(e) => setShipNote(e.target.value)}
            />
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShipOpen(false)}>
              Annuler
            </Button>
            <Button
              disabled={pending}
              onClick={() =>
                start(async () => {
                  try {
                    const items = Object.entries(shipQtys)
                      .map(([productId, q]) => ({
                        productId,
                        quantity: Number(q) || 0,
                      }))
                      .filter((i) => i.quantity > 0);
                    const res = await shipWarehouseToPosAction({
                      organizationId: props.organizationId,
                      branchId: props.branchId,
                      managerUserId:
                        slipForm.managerUserId ||
                        props.warehouse.staff[0]?.id ||
                        "",
                      recipientUserId:
                        slipForm.recipientUserId ||
                        props.warehouse.staff[0]?.id ||
                        "",
                      note: shipNote || undefined,
                      items,
                    });
                    toast.success(
                      `${res.number} envoyé — le POS doit signer la réception`,
                    );
                    if (res.printHtml) printDoc(res.printHtml);
                    setShipOpen(false);
                    router.refresh();
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Erreur");
                  }
                })
              }
            >
              Envoyer & imprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </BoutiquePage>
  );
}

function Kpi(props: { label: string; value: string; hot?: boolean }) {
  return (
    <div
      className="rounded-2xl border bg-white px-4 py-3 shadow-sm"
      style={{ borderColor: props.hot ? "#fcd34d" : S.line }}
    >
      <p
        className="text-[10px] font-bold tracking-wide uppercase"
        style={{ color: S.muted }}
      >
        {props.label}
      </p>
      <p
        className="mt-1 text-xl font-black tabular-nums"
        style={{ color: S.ink }}
      >
        {props.value}
      </p>
    </div>
  );
}

function Field(props: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px] text-muted-foreground">{props.label}</Label>
      {props.children}
    </div>
  );
}

function LevelBadge(props: { level: "ok" | "low" | "out"; qty: number }) {
  const map = {
    ok: "bg-emerald-600 text-white",
    low: "bg-amber-500 text-white",
    out: "bg-red-600 text-white",
  } as const;
  const label = { ok: "OK", low: "Bas", out: "Rupture" } as const;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-bold",
        map[props.level],
      )}
    >
      <Package className="size-3" />
      {label[props.level]} · {props.qty}
    </span>
  );
}
