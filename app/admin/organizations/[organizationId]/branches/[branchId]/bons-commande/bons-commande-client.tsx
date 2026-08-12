"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ClipboardList, Plus, Printer, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ModulePageChrome } from "@/components/layout/module-page-chrome";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge, type StatusBadgeTone } from "@/components/ui/status-badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  formatBothAmounts,
  formatPrimaryAmount,
  formatUsdLineTotal,
  formatUsdPrimaryInputValue,
  isCdfPrimary,
  primaryAmountToUsd,
  primaryCurrencyLabel,
  primaryLineTotal,
  primaryPriceInputStep,
  primaryTotalToUsd,
  type NormalizedUsdCdfRate,
} from "@/lib/cash/exchange";
import {
  branchCaissePath,
  boutiqueRoutes,
  hotelRoutes,
} from "@/lib/branch/paths";
import {
  cancelPurchaseOrderAction,
  createPurchaseOrderAction,
  releasePurchaseOrderFundsAction,
  syncPurchaseOrderCatalogAction,
  validatePurchaseOrderAction,
} from "@/lib/purchases/actions";

type CatalogItem = {
  id: string;
  name: string;
  priceUsd: number;
  stockQty: number;
  category?: string;
  kind: "shop" | "menu";
};

type PoItem = {
  id: string;
  name: string;
  category?: string;
  quantity: number;
  receivedQty: number | null;
  unitPriceUsd: number;
  lineTotalUsd: number;
  shopProductId: string | null;
  menuItemId: string | null;
  createProduct: boolean;
};

type PurchaseOrder = {
  id: string;
  number: string;
  status: string;
  supplierName: string | null;
  note: string | null;
  totalAmountUsd: number;
  fundsReleasedUsd: number;
  validatedAmountUsd: number | null;
  createdAt: string | Date;
  items: PoItem[];
};

type DraftLine = {
  key: string;
  name: string;
  quantity: string;
  unitPrice: string;
  category: string;
  catalogId: string;
  kind: "shop" | "menu" | "";
};

const NEW_CATEGORY = "__new__";

function money(n: number, rate: NormalizedUsdCdfRate | null) {
  return formatPrimaryAmount(n, rate);
}

function statusLabel(s: string) {
  if (s === "EN_ATTENTE") return "En attente";
  if (s === "FONDS_SORTIS") return "Fonds sortis";
  if (s === "VALIDE") return "Validé";
  if (s === "ANNULE") return "Annulé";
  return s;
}

function statusTone(s: string): StatusBadgeTone {
  if (s === "EN_ATTENTE") return "pending";
  if (s === "FONDS_SORTIS") return "info";
  if (s === "VALIDE") return "success";
  if (s === "ANNULE") return "muted";
  return "muted";
}

function buildPurchaseOrderHtml(
  po: PurchaseOrder,
  branchName: string,
  rate: NormalizedUsdCdfRate | null,
) {
  const rows = po.items
    .map(
      (i) =>
        `<tr>
          <td style="padding:8px;border-bottom:1px solid #ddd">${i.name}</td>
          <td style="padding:8px;border-bottom:1px solid #ddd">${i.category?.trim() || "Divers"}</td>
          <td style="padding:8px;border-bottom:1px solid #ddd;text-align:right">${i.quantity}</td>
          <td style="padding:8px;border-bottom:1px solid #ddd;text-align:right">${money(i.unitPriceUsd, rate)}</td>
          <td style="padding:8px;border-bottom:1px solid #ddd;text-align:right">${formatUsdLineTotal(i.quantity, i.unitPriceUsd, rate)}</td>
        </tr>`,
    )
    .join("");
  const grand = po.items.reduce((s, i) => {
    // Recompute from PU for display consistency
    if (rate && rate.configuredFrom?.toUpperCase() === "CDF" && rate.rate > 0) {
      return s + Math.round(i.quantity) * Math.round(i.unitPriceUsd * rate.rate);
    }
    return s + i.lineTotalUsd;
  }, 0);
  const grandLabel =
    rate && rate.configuredFrom?.toUpperCase() === "CDF"
      ? `${grand.toLocaleString("fr-FR")} CDF`
      : money(po.totalAmountUsd, rate);
  return `<!doctype html><html><head><meta charset="utf-8"/><title>${po.number}</title>
    <style>
      @page { margin: 16mm; }
      body{font-family:system-ui,sans-serif;padding:24px;color:#111;margin:0}
      h1{margin:0 0 4px;font-size:22px}
      table{width:100%;border-collapse:collapse;margin-top:16px}
      .muted{color:#666;font-size:13px}
      .total{margin-top:20px;font-size:18px;font-weight:700;text-align:right}
    </style></head><body>
    <h1>Bon de commande ${po.number}</h1>
    <p class="muted">${branchName}${po.supplierName ? ` · Fournisseur : ${po.supplierName}` : ""}</p>
    <p class="muted">Statut : ${statusLabel(po.status)}</p>
    <table>
      <thead><tr>
        <th style="text-align:left;padding:8px;border-bottom:2px solid #111">Produit</th>
        <th style="text-align:left;padding:8px;border-bottom:2px solid #111">Catégorie</th>
        <th style="text-align:right;padding:8px;border-bottom:2px solid #111">Qté</th>
        <th style="text-align:right;padding:8px;border-bottom:2px solid #111">P.U.</th>
        <th style="text-align:right;padding:8px;border-bottom:2px solid #111">Total</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p class="total">Total général : ${grandLabel}</p>
    ${po.note ? `<p class="muted">Note : ${po.note}</p>` : ""}
    </body></html>`;
}

/** Impression via iframe (pas de pop-up bloquée). */
function printHtmlDocument(html: string) {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.style.opacity = "0";
  iframe.style.pointerEvents = "none";
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument ?? iframe.contentWindow?.document;
  if (!doc) {
    iframe.remove();
    toast.error("Impossible de préparer l’impression.");
    return;
  }
  doc.open();
  doc.write(html);
  doc.close();
  const win = iframe.contentWindow;
  window.setTimeout(() => {
    try {
      win?.focus();
      win?.print();
    } catch {
      toast.error("Impression impossible.");
    } finally {
      window.setTimeout(() => iframe.remove(), 1000);
    }
  }, 200);
}

export function BonsCommandeClient(props: {
  organizationId: string;
  branchId: string;
  branchName: string;
  branchType: string;
  orders: PurchaseOrder[];
  catalog: CatalogItem[];
  categories: string[];
  rate: NormalizedUsdCdfRate | null;
  hasOpenCashSession: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [createOpen, setCreateOpen] = useState(false);
  const [previewPo, setPreviewPo] = useState<PurchaseOrder | null>(null);
  const [validateTarget, setValidateTarget] = useState<PurchaseOrder | null>(null);
  const [supplierName, setSupplierName] = useState("");
  const [note, setNote] = useState("");
  const defaultCategory = props.categories[0] ?? "Divers";
  const [categoryOptions, setCategoryOptions] = useState<string[]>(
    props.categories.length ? props.categories : ["Divers"],
  );
  const [lines, setLines] = useState<DraftLine[]>([
    {
      key: "1",
      name: "",
      quantity: "1",
      unitPrice: "",
      category: defaultCategory,
      catalogId: "",
      kind: "",
    },
  ]);
  const [newCategoryForKey, setNewCategoryForKey] = useState<string | null>(
    null,
  );
  const [newCategoryName, setNewCategoryName] = useState("");
  const [recv, setRecv] = useState<
    Record<string, { qty: string; price: string }>
  >({});

  const currency = primaryCurrencyLabel(props.rate);
  const step = primaryPriceInputStep(props.rate);
  const productsHref =
    props.branchType === "BOUTIQUE"
      ? boutiqueRoutes.produits(props.organizationId, props.branchId)
      : hotelRoutes.produits(props.organizationId, props.branchId);

  const draftTotal = useMemo(() => {
    return lines.reduce((s, l) => {
      const q = Number(l.quantity) || 0;
      const p = Number(l.unitPrice) || 0;
      return s + primaryTotalToUsd(q, p, props.rate);
    }, 0);
  }, [lines, props.rate]);

  function addLine() {
    setLines((prev) => [
      ...prev,
      {
        key: String(Date.now()),
        name: "",
        quantity: "1",
        unitPrice: "",
        category: defaultCategory,
        catalogId: "",
        kind: "",
      },
    ]);
  }

  function confirmNewCategory(lineKey: string) {
    const name = newCategoryName.trim();
    if (!name) {
      toast.error("Nom de catégorie requis.");
      return;
    }
    setCategoryOptions((prev) =>
      prev.includes(name) ? prev : [...prev, name].sort((a, b) => a.localeCompare(b, "fr")),
    );
    setLines((prev) =>
      prev.map((x) => (x.key === lineKey ? { ...x, category: name } : x)),
    );
    setNewCategoryForKey(null);
    setNewCategoryName("");
  }

  function create() {
    if (newCategoryForKey) {
      toast.error("Confirmez la nouvelle catégorie (OK) avant de créer.");
      return;
    }
    start(async () => {
      try {
        const payload = lines
          .map((l) => {
            const name = l.name.trim();
            const quantity = Math.round(Number(l.quantity) || 0);
            const unitPrimary = Number(l.unitPrice) || 0;
            const unitPriceUsd = primaryAmountToUsd(unitPrimary, props.rate);
            const lineTotalUsd = primaryTotalToUsd(
              quantity,
              unitPrimary,
              props.rate,
            );
            return {
              name,
              quantity,
              unitPriceUsd,
              lineTotalUsd,
              category: l.category.trim() || "Divers",
              shopProductId: l.kind === "shop" ? l.catalogId || null : null,
              menuItemId: l.kind === "menu" ? l.catalogId || null : null,
              createProduct: !l.catalogId,
            };
          })
          .filter((l) => l.name && l.quantity > 0);
        await createPurchaseOrderAction({
          organizationId: props.organizationId,
          branchId: props.branchId,
          supplierName: supplierName || null,
          note: note || null,
          lines: payload,
        });
        toast.success("Bon de commande créé · en attente");
        setCreateOpen(false);
        setSupplierName("");
        setNote("");
        setNewCategoryForKey(null);
        setNewCategoryName("");
        setLines([
          {
            key: "1",
            name: "",
            quantity: "1",
            unitPrice: "",
            category: defaultCategory,
            catalogId: "",
            kind: "",
          },
        ]);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erreur");
      }
    });
  }

  function releaseFunds(po: PurchaseOrder) {
    start(async () => {
      try {
        await releasePurchaseOrderFundsAction({
          organizationId: props.organizationId,
          branchId: props.branchId,
          purchaseOrderId: po.id,
        });
        toast.success(`Fonds sortis · ${po.number}`);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erreur");
      }
    });
  }

  function openValidate(po: PurchaseOrder) {
    const map: Record<string, { qty: string; price: string }> = {};
    for (const i of po.items) {
      map[i.id] = {
        qty: String(i.receivedQty ?? i.quantity),
        price: formatUsdPrimaryInputValue(i.unitPriceUsd, props.rate),
      };
    }
    setRecv(map);
    setValidateTarget(po);
  }

  function validate() {
    if (!validateTarget) return;
    start(async () => {
      try {
        const res = await validatePurchaseOrderAction({
          organizationId: props.organizationId,
          branchId: props.branchId,
          purchaseOrderId: validateTarget.id,
          lines: validateTarget.items.map((i) => {
            const receivedQty = Math.round(Number(recv[i.id]?.qty) || 0);
            const unitPrimary = Number(recv[i.id]?.price) || 0;
            return {
              id: i.id,
              receivedQty,
              unitPriceUsd: primaryAmountToUsd(unitPrimary, props.rate),
              lineTotalUsd: primaryTotalToUsd(
                receivedQty,
                unitPrimary,
                props.rate,
              ),
            };
          }),
        });
        toast.success(
          `Bon validé · ${res.productsCreated} créé(s) · ${res.productsStocked} entrée(s) stock sur ${props.branchName}`,
          {
            action: {
              label: "Voir produits",
              onClick: () => router.push(productsHref),
            },
          },
        );
        setValidateTarget(null);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erreur");
      }
    });
  }

  function cancel(po: PurchaseOrder) {
    start(async () => {
      try {
        await cancelPurchaseOrderAction({
          organizationId: props.organizationId,
          branchId: props.branchId,
          purchaseOrderId: po.id,
        });
        toast.success("Bon annulé");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erreur");
      }
    });
  }

  function syncCatalog(po: PurchaseOrder) {
    start(async () => {
      try {
        const res = await syncPurchaseOrderCatalogAction({
          organizationId: props.organizationId,
          branchId: props.branchId,
          purchaseOrderId: po.id,
        });
        toast.success(
          `Catalogue : ${res.created} créé(s) · ${res.stocked} entrée(s) stock`,
        );
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erreur");
      }
    });
  }

  const validateTotal = useMemo(() => {
    if (!validateTarget) return 0;
    return validateTarget.items.reduce((s, i) => {
      const q = Number(recv[i.id]?.qty) || 0;
      const p = Number(recv[i.id]?.price) || 0;
      return s + primaryTotalToUsd(q, p, props.rate);
    }, 0);
  }, [validateTarget, recv, props.rate]);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-6">
      <ModulePageChrome
        organizationId={props.organizationId}
        branchId={props.branchId}
        title="Bons de commande"
        subtitle={`${props.branchName} · commandes fournisseurs de cet établissement · stock mis à jour à la validation`}
        actions={
          <>
            <Button variant="outline" render={<Link href={productsHref} />}>
              Produits branche
            </Button>
            {!props.hasOpenCashSession ? (
              <Button
                variant="outline"
                render={
                  <Link
                    href={branchCaissePath(
                      props.organizationId,
                      props.branchId,
                    )}
                  />
                }
              >
                Ouvrir la caisse
              </Button>
            ) : null}
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="mr-1.5 size-4" /> Nouveau bon
            </Button>
          </>
        }
      />

      <ul className="flex flex-col gap-3">
        {props.orders.length === 0 ? (
          <li>
            <EmptyState
              icon={ClipboardList}
              title="Aucun bon de commande"
              description="Créez un bon pour commander auprès d’un fournisseur."
              action={
                <Button onClick={() => setCreateOpen(true)}>
                  <Plus className="mr-1.5 size-4" /> Nouveau bon
                </Button>
              }
            />
          </li>
        ) : (
          props.orders.map((po) => (
            <li
              key={po.id}
              className="rounded-xl border border-border bg-card p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{po.number}</p>
                    <StatusBadge tone={statusTone(po.status)}>
                      {statusLabel(po.status)}
                    </StatusBadge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {po.supplierName ? `${po.supplierName} · ` : ""}
                    {po.items.length} ligne(s) · total{" "}
                    {props.rate?.configuredFrom?.toUpperCase() === "CDF" &&
                    props.rate.rate > 0
                      ? `${po.items
                          .reduce(
                            (s, i) =>
                              s +
                              Math.round(i.quantity) *
                                Math.round(i.unitPriceUsd * props.rate!.rate),
                            0,
                          )
                          .toLocaleString("fr-FR")} CDF`
                      : money(po.totalAmountUsd, props.rate)}
                    {po.fundsReleasedUsd > 0
                      ? ` · fonds sortis ${money(po.fundsReleasedUsd, props.rate)}`
                      : ""}
                    {po.validatedAmountUsd != null
                      ? ` · validé ${money(po.validatedAmountUsd, props.rate)}`
                      : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setPreviewPo(po)}
                  >
                    <Printer className="mr-1 size-3.5" /> Aperçu
                  </Button>
                  {(po.status === "EN_ATTENTE" ||
                    po.status === "FONDS_SORTIS") && (
                    <>
                      {po.status === "EN_ATTENTE" ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={pending || !props.hasOpenCashSession}
                          onClick={() => releaseFunds(po)}
                        >
                          Sortir fonds
                        </Button>
                      ) : null}
                      <Button
                        size="sm"
                        disabled={pending || !props.hasOpenCashSession}
                        onClick={() => openValidate(po)}
                      >
                        Valider
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={pending}
                        onClick={() => cancel(po)}
                      >
                        Annuler
                      </Button>
                    </>
                  )}
                  {po.status === "VALIDE" &&
                  po.items.some(
                    (i) => (i.receivedQty ?? i.quantity) > 0,
                  ) ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={pending}
                      onClick={() => syncCatalog(po)}
                    >
                      Sync catalogue
                    </Button>
                  ) : null}
                </div>
              </div>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[520px] text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground">
                      <th className="pb-1 font-medium">Produit</th>
                      <th className="pb-1 font-medium">Catégorie</th>
                      <th className="pb-1 text-right font-medium">Qté</th>
                      <th className="pb-1 text-right font-medium">P.U.</th>
                      <th className="pb-1 text-right font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {po.items.map((i) => (
                      <tr key={i.id} className="border-t border-border/60">
                        <td className="py-1.5">
                          {i.name}
                          {i.createProduct ? (
                            <StatusBadge
                              tone="pending"
                              className="ml-1 text-[10px]"
                            >
                              Nouveau
                            </StatusBadge>
                          ) : null}
                        </td>
                        <td className="py-1.5 text-muted-foreground">
                          {i.category?.trim() || "Divers"}
                        </td>
                        <td className="py-1.5 text-right">
                          {i.receivedQty != null
                            ? `${i.receivedQty}/${i.quantity}`
                            : i.quantity}
                        </td>
                        <td className="py-1.5 text-right">
                          {money(i.unitPriceUsd, props.rate)}
                        </td>
                        <td className="py-1.5 text-right font-medium">
                          {formatUsdLineTotal(
                            i.quantity,
                            i.unitPriceUsd,
                            props.rate,
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </li>
          ))
        )}
      </ul>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Nouveau bon de commande</DialogTitle>
            <DialogDescription>
              Choisissez une catégorie existante ou créez-en une. À la
              validation, le produit est créé dans cette catégorie (+ entrée
              stock).
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>Fournisseur</Label>
              <Input
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                placeholder="Optionnel"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Note</Label>
              <Input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Optionnel"
              />
            </div>
          </div>
          <div className="space-y-2">
            {lines.map((l) => {
              const q = Number(l.quantity) || 0;
              const unitPrimary = Number(l.unitPrice) || 0;
              const linePrimary = primaryLineTotal(q, unitPrimary, props.rate);
              const lineTotalUsd = primaryAmountToUsd(linePrimary, props.rate);
              return (
                <div
                  key={l.key}
                  className="grid gap-2 rounded-lg border border-border/70 p-2 sm:grid-cols-[1.2fr_1fr_0.45fr_0.65fr_0.7fr_auto]"
                >
                  <div className="grid gap-1">
                    <Label className="text-xs">Produit</Label>
                    <Input
                      list={`catalog-${l.key}`}
                      value={l.name}
                      onChange={(e) => {
                        const name = e.target.value;
                        const hit = props.catalog.find(
                          (c) => c.name.toLowerCase() === name.toLowerCase(),
                        );
                        setLines((prev) =>
                          prev.map((x) =>
                            x.key === l.key
                              ? {
                                  ...x,
                                  name,
                                  catalogId: hit?.id ?? "",
                                  kind: hit?.kind ?? "",
                                  category:
                                    hit?.category?.trim() || x.category,
                                  unitPrice: hit
                                    ? formatUsdPrimaryInputValue(
                                        hit.priceUsd,
                                        props.rate,
                                      )
                                    : x.unitPrice,
                                }
                              : x,
                          ),
                        );
                      }}
                      placeholder="Nom ou catalogue…"
                    />
                    <datalist id={`catalog-${l.key}`}>
                      {props.catalog.map((c) => (
                        <option key={c.id} value={c.name} />
                      ))}
                    </datalist>
                  </div>
                  <div className="grid gap-1">
                    <Label className="text-xs">Catégorie</Label>
                    <select
                      className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                      value={
                        newCategoryForKey === l.key
                          ? NEW_CATEGORY
                          : l.category
                      }
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === NEW_CATEGORY) {
                          setNewCategoryForKey(l.key);
                          setNewCategoryName("");
                          return;
                        }
                        setNewCategoryForKey(null);
                        setLines((prev) =>
                          prev.map((x) =>
                            x.key === l.key ? { ...x, category: v } : x,
                          ),
                        );
                      }}
                    >
                      {categoryOptions.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                      <option value={NEW_CATEGORY}>+ Nouvelle catégorie…</option>
                    </select>
                    {newCategoryForKey === l.key ? (
                      <div className="flex gap-1">
                        <Input
                          className="h-8"
                          value={newCategoryName}
                          onChange={(e) => setNewCategoryName(e.target.value)}
                          placeholder="Ex. Boissons"
                          autoFocus
                        />
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => confirmNewCategory(l.key)}
                        >
                          OK
                        </Button>
                      </div>
                    ) : null}
                  </div>
                  <div className="grid gap-1">
                    <Label className="text-xs">Qté</Label>
                    <Input
                      type="number"
                      min={1}
                      step={1}
                      value={l.quantity}
                      onChange={(e) =>
                        setLines((prev) =>
                          prev.map((x) =>
                            x.key === l.key
                              ? { ...x, quantity: e.target.value }
                              : x,
                          ),
                        )
                      }
                    />
                  </div>
                  <div className="grid gap-1">
                    <Label className="text-xs">Prix ({currency})</Label>
                    <Input
                      type="number"
                      min={0}
                      step={step}
                      value={l.unitPrice}
                      onChange={(e) =>
                        setLines((prev) =>
                          prev.map((x) =>
                            x.key === l.key
                              ? { ...x, unitPrice: e.target.value }
                              : x,
                          ),
                        )
                      }
                    />
                  </div>
                  <div className="grid gap-1">
                    <Label className="text-xs">Total ligne</Label>
                    <p className="flex h-9 items-center text-sm font-semibold">
                      {isCdfPrimary(props.rate)
                        ? `${linePrimary.toLocaleString("fr-FR")} CDF`
                        : money(lineTotalUsd, props.rate)}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    className="mt-5"
                    disabled={lines.length <= 1}
                    onClick={() =>
                      setLines((prev) => prev.filter((x) => x.key !== l.key))
                    }
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button type="button" variant="outline" onClick={addLine}>
              <Plus className="mr-1 size-4" /> Ligne
            </Button>
            <p className="text-sm font-semibold">
              Total général : {money(draftTotal, props.rate)}
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                {formatBothAmounts(draftTotal, props.rate)}
              </span>
            </p>
          </div>
          <Button
            disabled={pending || draftTotal <= 0}
            onClick={create}
            className="w-full"
          >
            Créer · mettre en attente
          </Button>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!previewPo}
        onOpenChange={(open) => {
          if (!open) setPreviewPo(null);
        }}
      >
        <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Aperçu {previewPo?.number ?? "bon de commande"}
            </DialogTitle>
            <DialogDescription>
              Vérifiez le document puis imprimez.
            </DialogDescription>
          </DialogHeader>
          {previewPo ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-border bg-background p-5 text-foreground shadow-sm">
                <h2 className="text-lg font-semibold">
                  Bon de commande {previewPo.number}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {props.branchName}
                  {previewPo.supplierName
                    ? ` · Fournisseur : ${previewPo.supplierName}`
                    : ""}
                </p>
                <p className="text-sm text-muted-foreground">
                  Statut : {statusLabel(previewPo.status)}
                </p>
                <table className="mt-4 w-full text-sm">
                  <thead>
                    <tr className="border-b-2 border-foreground/80 text-left text-xs">
                      <th className="pb-2 font-semibold">Produit</th>
                      <th className="pb-2 font-semibold">Catégorie</th>
                      <th className="pb-2 text-right font-semibold">Qté</th>
                      <th className="pb-2 text-right font-semibold">P.U.</th>
                      <th className="pb-2 text-right font-semibold">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewPo.items.map((i) => (
                      <tr key={i.id} className="border-b border-border/70">
                        <td className="py-2">{i.name}</td>
                        <td className="py-2 text-muted-foreground">
                          {i.category?.trim() || "Divers"}
                        </td>
                        <td className="py-2 text-right">{i.quantity}</td>
                        <td className="py-2 text-right">
                          {money(i.unitPriceUsd, props.rate)}
                        </td>
                        <td className="py-2 text-right font-medium">
                          {formatUsdLineTotal(
                            i.quantity,
                            i.unitPriceUsd,
                            props.rate,
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-4 text-right text-base font-bold">
                  Total général :{" "}
                  {(() => {
                    if (
                      props.rate?.configuredFrom?.toUpperCase() === "CDF" &&
                      props.rate.rate > 0
                    ) {
                      const t = previewPo.items.reduce(
                        (s, i) =>
                          s +
                          Math.round(i.quantity) *
                            Math.round(i.unitPriceUsd * props.rate!.rate),
                        0,
                      );
                      return `${t.toLocaleString("fr-FR")} CDF`;
                    }
                    return money(previewPo.totalAmountUsd, props.rate);
                  })()}
                </p>
                {previewPo.note ? (
                  <p className="mt-2 text-sm text-muted-foreground">
                    Note : {previewPo.note}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="outline" onClick={() => setPreviewPo(null)}>
                  Fermer
                </Button>
                <Button
                  onClick={() =>
                    printHtmlDocument(
                      buildPurchaseOrderHtml(
                        previewPo,
                        props.branchName,
                        props.rate,
                      ),
                    )
                  }
                >
                  <Printer className="mr-1.5 size-4" />
                  Imprimer
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!validateTarget}
        onOpenChange={(open) => {
          if (!open) setValidateTarget(null);
        }}
      >
        <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Valider {validateTarget?.number}
            </DialogTitle>
            <DialogDescription>
              Fonds déjà sortis inchangés (sauf delta). Produits créés ou
              stockés uniquement sur le catalogue de {props.branchName} — pas
              partagés avec les autres branches.
            </DialogDescription>
          </DialogHeader>
          {validateTarget ? (
            <div className="space-y-3">
              {validateTarget.items.map((i) => (
                <div
                  key={i.id}
                  className="grid gap-2 rounded-lg border border-border/70 p-2 sm:grid-cols-[1.4fr_0.6fr_0.7fr]"
                >
                  <div>
                    <p className="text-sm font-medium">{i.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {i.category?.trim() || "Divers"} · Demandé : {i.quantity}
                    </p>
                  </div>
                  <div className="grid gap-1">
                    <Label className="text-xs">Reçu</Label>
                    <Input
                      type="number"
                      min={0}
                      step={1}
                      value={recv[i.id]?.qty ?? "0"}
                      onChange={(e) =>
                        setRecv((m) => ({
                          ...m,
                          [i.id]: {
                            qty: e.target.value,
                            price: m[i.id]?.price ?? "0",
                          },
                        }))
                      }
                    />
                  </div>
                  <div className="grid gap-1">
                    <Label className="text-xs">P.U. ({currency})</Label>
                    <Input
                      type="number"
                      min={0}
                      step={step}
                      value={recv[i.id]?.price ?? "0"}
                      onChange={(e) =>
                        setRecv((m) => ({
                          ...m,
                          [i.id]: {
                            qty: m[i.id]?.qty ?? "0",
                            price: e.target.value,
                          },
                        }))
                      }
                    />
                  </div>
                </div>
              ))}
              <p className="text-sm">
                Total validé :{" "}
                <span className="font-semibold">
                  {money(validateTotal, props.rate)}
                </span>
                {validateTarget.fundsReleasedUsd > 0 ? (
                  <span className="text-muted-foreground">
                    {" "}
                    · fonds sortis{" "}
                    {money(validateTarget.fundsReleasedUsd, props.rate)}
                    {validateTotal < validateTarget.fundsReleasedUsd - 0.01
                      ? ` · à rembourser ${money(
                          validateTarget.fundsReleasedUsd - validateTotal,
                          props.rate,
                        )}`
                      : validateTotal > validateTarget.fundsReleasedUsd + 0.01
                        ? ` · complément ${money(
                            validateTotal - validateTarget.fundsReleasedUsd,
                            props.rate,
                          )}`
                        : ""}
                  </span>
                ) : (
                  <span className="text-muted-foreground">
                    {" "}
                    · sortie caisse à la validation
                  </span>
                )}
              </p>
              <Button
                className="w-full"
                disabled={pending || !props.hasOpenCashSession}
                onClick={validate}
              >
                Valider le bon
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
