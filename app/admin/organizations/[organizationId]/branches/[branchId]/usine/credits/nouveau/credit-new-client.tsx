"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FileSignature,
  Minus,
  Package,
  Plus,
  Search,
  UserRound,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BoutiqueHero,
  BoutiquePage,
  BoutiquePanel,
  boutiqueOutlineBtn,
  boutiquePrimaryBtn,
} from "@/components/boutique/boutique-shell";
import { usineRoutes } from "@/lib/branch/paths";
import { createFactoryCreditAction } from "@/lib/factory/actions";
import { cn } from "@/lib/utils";

type Customer = {
  id: string;
  name: string;
  phone: string | null;
  companyName: string | null;
  active: boolean;
};

type Product = {
  id: string;
  name: string;
  price: number;
  free: number;
  finishedFamily?: "EAU" | "VIN" | null;
};

function parseLines(raw?: string): Record<string, number> {
  if (!raw?.trim()) return {};
  const out: Record<string, number> = {};
  for (const part of raw.split(",")) {
    const [id, qtyRaw] = part.split(":");
    if (!id) continue;
    const qty = Number(qtyRaw);
    if (qty > 0) out[id] = qty;
  }
  return out;
}

function defaultDueDate() {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function familyLabel(family?: "EAU" | "VIN" | null) {
  if (family === "EAU") return "Eau";
  if (family === "VIN") return "Vins";
  return "—";
}

function QtyStepper(props: {
  quantity: number;
  max: number;
  onChange: (qty: number) => void;
}) {
  const { quantity, max, onChange } = props;
  return (
    <div
      className="flex items-center gap-1"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        className="flex size-8 items-center justify-center rounded-lg border border-border bg-white hover:bg-muted disabled:opacity-40"
        disabled={quantity <= 0}
        onClick={(e) => {
          e.stopPropagation();
          onChange(quantity - 1);
        }}
        aria-label="Diminuer"
      >
        <Minus className="size-3.5" />
      </button>
      <span className="min-w-7 text-center text-sm font-semibold tabular-nums">
        {quantity}
      </span>
      <button
        type="button"
        className="flex size-8 items-center justify-center rounded-lg border border-border bg-white hover:bg-muted disabled:opacity-40"
        disabled={quantity >= max}
        onClick={(e) => {
          e.stopPropagation();
          onChange(quantity + 1);
        }}
        aria-label="Augmenter"
      >
        <Plus className="size-3.5" />
      </button>
    </div>
  );
}

export function UsineCreditNewClient(props: {
  organizationId: string;
  branchId: string;
  branchName: string;
  customers: Customer[];
  products: Product[];
  hasEau?: boolean;
  hasVin?: boolean;
  initialLines?: string;
  initialFamily?: string;
}) {
  const router = useRouter();
  const fromPos = Boolean(props.initialLines?.trim());
  const [pending, start] = useTransition();
  const [clientMode, setClientMode] = useState<"EXISTING" | "NEW">("NEW");
  const [customerId, setCustomerId] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [dueAt, setDueAt] = useState(defaultDueDate);
  const [signed, setSigned] = useState(false);
  const [search, setSearch] = useState("");
  const [qtys, setQtys] = useState<Record<string, number>>(() =>
    parseLines(props.initialLines),
  );
  const [familyFilter, setFamilyFilter] = useState<"ALL" | "EAU" | "VIN">(
    props.initialFamily === "EAU" || props.initialFamily === "VIN"
      ? props.initialFamily
      : props.hasEau && !props.hasVin
        ? "EAU"
        : !props.hasEau && props.hasVin
          ? "VIN"
          : "ALL",
  );

  const productById = useMemo(
    () => new Map(props.products.map((p) => [p.id, p])),
    [props.products],
  );

  const visibleProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return props.products.filter((p) => {
      if (familyFilter === "EAU" && p.finishedFamily !== "EAU") return false;
      if (familyFilter === "VIN" && p.finishedFamily !== "VIN") return false;
      const inCart = (qtys[p.id] ?? 0) > 0;
      if (p.free <= 0 && !inCart) return false;
      if (!q) return true;
      return p.name.toLowerCase().includes(q);
    });
  }, [props.products, familyFilter, search, qtys]);

  const lines = useMemo(
    () =>
      Object.entries(qtys)
        .filter(([, qty]) => qty > 0)
        .map(([id, qty]) => {
          const p = productById.get(id);
          if (!p) return null;
          return {
            shopProductId: p.id,
            qty,
            unitPriceUsd: p.price,
            name: p.name,
            family: p.finishedFamily,
            free: p.free,
            lineTotal: qty * p.price,
          };
        })
        .filter((l): l is NonNullable<typeof l> => l != null),
    [productById, qtys],
  );
  const total = lines.reduce((s, l) => s + l.lineTotal, 0);

  function setQty(id: string, qty: number, max: number) {
    const next = Math.max(0, Math.min(max, Math.floor(qty)));
    setQtys((prev) => {
      if (next === 0) {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      }
      return { ...prev, [id]: next };
    });
  }

  function addOne(id: string, max: number) {
    setQtys((prev) => {
      const current = prev[id] ?? 0;
      if (current >= max) return prev;
      return { ...prev, [id]: current + 1 };
    });
  }

  const backHref = fromPos
    ? usineRoutes.pos(props.organizationId, props.branchId)
    : usineRoutes.credits(props.organizationId, props.branchId);

  return (
    <BoutiquePage wide>
      <BoutiqueHero
        kicker="Usine"
        title="Vente à crédit"
        subtitle={`${props.branchName}${fromPos ? " · panier repris de la caisse" : " · client, échéance et document à signer"}`}
        icon={FileSignature}
        backHref={backHref}
        backLabel={fromPos ? "Caisse" : "Crédits"}
        actions={
          <p className="rounded-xl bg-primary/10 px-3 py-2 text-sm font-semibold tabular-nums text-foreground">
            {lines.length} ligne{lines.length === 1 ? "" : "s"} · {total.toFixed(2)}{" "}
            $
          </p>
        }
      />

      {!props.products.length ? (
        <p className="rounded-2xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm">
          Ouvrez d’abord le float marketeur — le crédit sort du stock auxiliaire.
        </p>
      ) : null}

      <form
        className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(300px,400px)]"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            try {
              const credit = await createFactoryCreditAction({
                organizationId: props.organizationId,
                branchId: props.branchId,
                customerId:
                  clientMode === "EXISTING" ? customerId || undefined : undefined,
                customer:
                  clientMode === "NEW"
                    ? { name, phone, companyName }
                    : undefined,
                dueAt,
                lines: lines.map((l) => ({
                  shopProductId: l.shopProductId,
                  qty: l.qty,
                  unitPriceUsd: l.unitPriceUsd,
                })),
                signedOnPaper: signed,
              });
              toast.success(`Crédit ${credit.number} créé`);
              router.push(
                `${usineRoutes.credit(props.organizationId, props.branchId, credit.id)}/document`,
              );
              router.refresh();
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Erreur");
            }
          });
        }}
      >
        <BoutiquePanel
          className="order-3 lg:order-1 lg:row-span-2"
          title="Catalogue"
          eyebrow="Float"
          icon={Package}
          bodyClassName="p-0"
          actions={
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
                      : "border-border bg-white text-muted-foreground hover:bg-muted",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          }
        >
          <div className="border-b border-border px-3 py-2">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher un produit…"
                className="h-10 rounded-xl border-border bg-white pl-8"
              />
            </div>
          </div>

          {visibleProducts.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">
              Aucun produit disponible sur le float.
            </p>
          ) : (
            <>
              <ul className="divide-y divide-border lg:hidden">
                {visibleProducts.map((p) => {
                  const qty = qtys[p.id] ?? 0;
                  const soldOut = p.free <= 0 || qty >= p.free;
                  return (
                    <li
                      key={p.id}
                      className={cn(
                        "flex items-start gap-3 px-3 py-3 transition",
                        soldOut && qty === 0
                          ? "opacity-50"
                          : "cursor-pointer hover:bg-muted",
                      )}
                      onClick={() => addOne(p.id, p.free)}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-foreground">
                          {p.name}
                        </p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {familyLabel(p.finishedFamily)} · libre {p.free} ·{" "}
                          {p.price.toFixed(2)} $
                        </p>
                      </div>
                      {qty > 0 ? (
                        <QtyStepper
                          quantity={qty}
                          max={p.free}
                          onChange={(n) => setQty(p.id, n, p.free)}
                        />
                      ) : (
                        <button
                          type="button"
                          disabled={p.free <= 0}
                          onClick={(e) => {
                            e.stopPropagation();
                            addOne(p.id, p.free);
                          }}
                          className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-border bg-white hover:bg-muted disabled:opacity-40"
                          aria-label="Ajouter"
                        >
                          <Plus className="size-4" />
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
              <div className="hidden lg:block">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Produit</TableHead>
                      <TableHead>Famille</TableHead>
                      <TableHead className="text-right">Libre</TableHead>
                      <TableHead className="text-right">Prix</TableHead>
                      <TableHead className="w-[130px] text-right">
                        Qté
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleProducts.map((p) => {
                      const qty = qtys[p.id] ?? 0;
                      const soldOut = p.free <= 0 || qty >= p.free;
                      return (
                        <TableRow
                          key={p.id}
                          className={cn(
                            soldOut && qty === 0
                              ? "opacity-50"
                              : "cursor-pointer",
                          )}
                          onClick={() => addOne(p.id, p.free)}
                        >
                          <TableCell className="max-w-[240px] font-medium whitespace-normal">
                            {p.name}
                          </TableCell>
                          <TableCell>
                            <span
                              className={cn(
                                "inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold",
                                p.finishedFamily === "VIN"
                                  ? "bg-rose-950/10 text-rose-800"
                                  : p.finishedFamily === "EAU"
                                    ? "bg-sky-950/10 text-sky-800"
                                    : "bg-muted text-muted-foreground",
                              )}
                            >
                              {familyLabel(p.finishedFamily)}
                            </span>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {p.free}
                          </TableCell>
                          <TableCell className="text-right font-semibold tabular-nums">
                            {p.price.toFixed(2)} $
                          </TableCell>
                          <TableCell
                            className="text-right"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {qty > 0 ? (
                              <div className="flex justify-end">
                                <QtyStepper
                                  quantity={qty}
                                  max={p.free}
                                  onChange={(n) => setQty(p.id, n, p.free)}
                                />
                              </div>
                            ) : (
                              <button
                                type="button"
                                disabled={p.free <= 0}
                                onClick={() => addOne(p.id, p.free)}
                                className="inline-flex size-8 items-center justify-center rounded-lg border border-border bg-white hover:bg-muted disabled:opacity-40"
                                aria-label="Ajouter"
                              >
                                <Plus className="size-4" />
                              </button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </BoutiquePanel>

        <BoutiquePanel
          className="order-1 lg:order-2"
          title="Client & échéance"
          icon={UserRound}
          bodyClassName="space-y-3 p-4"
        >
          <div className="grid grid-cols-2 gap-1.5">
            {(
              [
                ["EXISTING", "Client connu"],
                ["NEW", "Nouveau"],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setClientMode(k)}
                className={cn(
                  "h-10 rounded-xl border text-sm font-semibold",
                  clientMode === k
                    ? "border-emerald-800 bg-emerald-800 text-white"
                    : "border-border bg-white text-muted-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {clientMode === "EXISTING" ? (
            <div className="grid gap-1.5">
              <Label htmlFor="credit-customer">Client</Label>
              <Select
                id="credit-customer"
                className="h-10 rounded-xl border-border bg-white"
                value={customerId}
                required
                onChange={(e) => setCustomerId(e.target.value)}
              >
                <option value="">Choisir un client…</option>
                {props.customers
                  .filter((c) => c.active)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.companyName ? ` · ${c.companyName}` : ""}
                      {c.phone ? ` · ${c.phone}` : ""}
                    </option>
                  ))}
              </Select>
              {props.customers.filter((c) => c.active).length === 0 ? (
                <p className="text-[11px] text-amber-800">
                  Aucun client enregistré — passez sur Nouveau.
                </p>
              ) : null}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5 sm:col-span-2">
                <Label htmlFor="credit-name">Nom</Label>
                <Input
                  id="credit-name"
                  className="h-10 rounded-xl border-border bg-white"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required={clientMode === "NEW"}
                  autoComplete="name"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="credit-phone">Téléphone</Label>
                <Input
                  id="credit-phone"
                  className="h-10 rounded-xl border-border bg-white"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required={clientMode === "NEW"}
                  inputMode="tel"
                  autoComplete="tel"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="credit-company">Société</Label>
                <Input
                  id="credit-company"
                  className="h-10 rounded-xl border-border bg-white"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Optionnel"
                />
              </div>
            </div>
          )}

          <div className="grid gap-1.5">
            <Label htmlFor="credit-due">Échéance</Label>
            <Input
              id="credit-due"
              type="date"
              className="h-10 rounded-xl border-border bg-white"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
              required
            />
          </div>
        </BoutiquePanel>

        <BoutiquePanel
          className="order-2 lg:sticky lg:top-4 lg:order-3"
          title="Panier crédit"
          icon={FileSignature}
          bodyClassName="p-0"
        >
          {lines.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              Ajoutez des produits du catalogue.
            </p>
          ) : (
            <>
              <ul className="divide-y divide-border lg:hidden">
                {lines.map((l) => (
                  <li
                    key={l.shopProductId}
                    className="flex items-start justify-between gap-2 px-3 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{l.name}</p>
                      <p className="text-[11px] text-muted-foreground tabular-nums">
                        {l.qty} × {l.unitPriceUsd.toFixed(2)} $
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <p className="text-sm font-semibold tabular-nums">
                        {l.lineTotal.toFixed(2)} $
                      </p>
                      <button
                        type="button"
                        className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-rose-500/10 hover:text-rose-700"
                        onClick={() => setQty(l.shopProductId, 0, l.free)}
                        aria-label="Retirer"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="hidden lg:block">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Produit</TableHead>
                      <TableHead className="text-right">Qté</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="w-8" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lines.map((l) => (
                      <TableRow key={l.shopProductId}>
                        <TableCell className="max-w-[140px] whitespace-normal">
                          <p className="truncate font-medium">{l.name}</p>
                          <p className="text-[11px] text-muted-foreground tabular-nums">
                            {l.unitPriceUsd.toFixed(2)} $ / u.
                          </p>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {l.qty}
                        </TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">
                          {l.lineTotal.toFixed(2)} $
                        </TableCell>
                        <TableCell>
                          <button
                            type="button"
                            className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-rose-500/10 hover:text-rose-700"
                            onClick={() => setQty(l.shopProductId, 0, l.free)}
                            aria-label="Retirer"
                          >
                            <X className="size-3.5" />
                          </button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}

          <div className="space-y-3 border-t border-border bg-muted/30 px-4 py-4">
            <div className="flex items-end justify-between gap-3">
              <span className="text-sm text-muted-foreground">Total crédit</span>
              <span className="text-2xl font-bold tracking-tight tabular-nums text-foreground">
                {total.toFixed(2)} $
              </span>
            </div>
            <label className="flex items-center gap-2.5 text-sm text-foreground">
              <Checkbox
                checked={signed}
                onCheckedChange={(v) => setSigned(v === true)}
              />
              Signé sur papier
            </label>
            <Button
              type="submit"
              disabled={pending || !lines.length}
              className={cn(
                boutiquePrimaryBtn(),
                "h-12 w-full rounded-2xl text-base",
              )}
            >
              {pending ? "Création…" : "Créer le crédit"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className={cn(boutiqueOutlineBtn(), "h-10 w-full")}
              render={<Link href={backHref} />}
            >
              Annuler
            </Button>
          </div>
        </BoutiquePanel>
      </form>
    </BoutiquePage>
  );
}
