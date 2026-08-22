"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Factory, FlaskConical, Layers } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/ui/empty-state";
import {
  BoutiqueHero,
  BoutiqueKpis,
  BoutiquePage,
  BoutiquePanel,
  BoutiqueStatus,
} from "@/components/boutique/boutique-shell";
import { branchDashboardPath } from "@/lib/branch/paths";
import {
  upsertFactoryRecipeAction,
  validateFactoryBatchAction,
} from "@/lib/factory/actions";

type Product = {
  id: string;
  name: string;
  productKind: "FINISHED" | "CONSUMABLE";
  stockQty: number;
};

type Recipe = {
  id: string;
  outputQty: number;
  shopProduct: { id: string; name: string };
  lines: {
    consumableProductId: string;
    qtyPerBatch: number;
    consumable: { name: string; stockQty: number };
  }[];
};

type Batch = {
  id: string;
  number: string;
  status: string;
  outputQty: number;
  outputProduct: { name: string };
  producedAt: Date | null;
};

const selectClass =
  "h-10 w-full rounded-xl border border-border bg-background px-3 text-sm";

function batchTone(status: string): "ok" | "warn" | "neutral" | "info" {
  if (status === "VALIDATED" || status === "DONE") return "ok";
  if (status === "DRAFT") return "info";
  if (status === "CANCELLED") return "neutral";
  return "warn";
}

export function UsineProductionClient(props: {
  organizationId: string;
  branchId: string;
  recipes: Recipe[];
  batches: Batch[];
  products: Product[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const finished = props.products.filter((p) => p.productKind === "FINISHED");
  const consumables = props.products.filter((p) => p.productKind === "CONSUMABLE");
  const [shopProductId, setShopProductId] = useState(finished[0]?.id ?? "");
  const [outputQty, setOutputQty] = useState(20);
  const [consos, setConsos] = useState<Record<string, number>>({});
  const [recipeId, setRecipeId] = useState(props.recipes[0]?.id ?? "");
  const [multiplier, setMultiplier] = useState(1);

  const selectedRecipe = props.recipes.find((r) => r.id === recipeId);
  const producedQty = selectedRecipe
    ? selectedRecipe.outputQty * multiplier
    : 0;

  return (
    <BoutiquePage>
      <BoutiqueHero
        kicker="Usine"
        title="Production"
        subtitle="Définissez la recette (consommables → fini), puis validez un lot pour alimenter le dépôt."
        icon={Factory}
        backHref={branchDashboardPath(props.organizationId, props.branchId)}
      />
      <BoutiqueKpis
        items={[
          {
            label: "Recettes",
            value: props.recipes.length,
            hint: "BOM enregistrées",
          },
          {
            label: "Lots",
            value: props.batches.length,
            hint: "Historique de production",
          },
          {
            label: "Consommables",
            value: consumables.length,
            hint: "Références disponibles",
          },
        ]}
      />

      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <BoutiquePanel
          title="Nouvelle recette"
          eyebrow="Nomenclature"
          icon={FlaskConical}
          bodyClassName="space-y-3 p-4"
        >
          {finished.length === 0 ? (
            <EmptyState
              icon={FlaskConical}
              title="Pas de produit fini"
              description="Créez d’abord un article eau ou vins dans Produits."
            />
          ) : (
            <>
              <div className="grid gap-1.5">
                <Label htmlFor="prod-finished">Produit fini</Label>
                <select
                  id="prod-finished"
                  className={selectClass}
                  value={shopProductId}
                  onChange={(e) => setShopProductId(e.target.value)}
                >
                  {finished.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="prod-qty">Quantité produite (1× recette)</Label>
                <Input
                  id="prod-qty"
                  type="number"
                  min={1}
                  className="h-10 rounded-xl"
                  value={outputQty}
                  onChange={(e) => setOutputQty(Number(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label>Consommables par batch</Label>
                {consumables.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-border px-3 py-4 text-center text-sm text-muted-foreground">
                    Aucun consommable au catalogue.
                  </p>
                ) : (
                  <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
                    {consumables.map((c) => (
                      <li
                        key={c.id}
                        className="flex items-center gap-3 px-3 py-2.5 text-sm"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">
                            {c.name}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            Stock {c.stockQty}
                          </span>
                        </span>
                        <Input
                          className="h-9 w-24 rounded-lg"
                          type="number"
                          min={0}
                          step="0.1"
                          value={consos[c.id] ?? 0}
                          onChange={(e) =>
                            setConsos((q) => ({
                              ...q,
                              [c.id]: Number(e.target.value),
                            }))
                          }
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <Button
                className="h-10 w-full"
                disabled={pending || !shopProductId}
                onClick={() =>
                  start(async () => {
                    try {
                      await upsertFactoryRecipeAction({
                        organizationId: props.organizationId,
                        branchId: props.branchId,
                        shopProductId,
                        outputQty,
                        lines: Object.entries(consos)
                          .filter(([, q]) => q > 0)
                          .map(([consumableProductId, qtyPerBatch]) => ({
                            consumableProductId,
                            qtyPerBatch,
                          })),
                      });
                      toast.success("Recette enregistrée");
                      router.refresh();
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : "Erreur");
                    }
                  })
                }
              >
                Enregistrer la recette
              </Button>
            </>
          )}
        </BoutiquePanel>

        <BoutiquePanel
          title="Valider un lot"
          eyebrow="Production"
          icon={Layers}
          bodyClassName="space-y-3 p-4"
        >
          {props.recipes.length === 0 ? (
            <EmptyState
              icon={Layers}
              title="Aucune recette"
              description="Enregistrez une nomenclature à gauche avant de produire."
            />
          ) : (
            <>
              <div className="grid gap-1.5">
                <Label htmlFor="prod-recipe">Recette</Label>
                <select
                  id="prod-recipe"
                  className={selectClass}
                  value={recipeId}
                  onChange={(e) => setRecipeId(e.target.value)}
                >
                  {props.recipes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.shopProduct.name} × {r.outputQty}
                    </option>
                  ))}
                </select>
              </div>
              {selectedRecipe?.lines.length ? (
                <ul className="rounded-xl bg-muted/40 px-3 py-2 text-[12px] text-muted-foreground">
                  {selectedRecipe.lines.map((l) => (
                    <li key={l.consumableProductId} className="flex justify-between gap-2 py-0.5">
                      <span className="truncate">{l.consumable.name}</span>
                      <span className="tabular-nums">
                        {(l.qtyPerBatch * multiplier).toLocaleString("fr-FR")}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
              <div className="grid gap-1.5">
                <Label htmlFor="prod-mult">Multiplicateur</Label>
                <Input
                  id="prod-mult"
                  type="number"
                  min={1}
                  className="h-10 rounded-xl"
                  value={multiplier}
                  onChange={(e) => setMultiplier(Number(e.target.value))}
                />
                <p className="text-xs text-muted-foreground">
                  Sortie prévue :{" "}
                  <span className="font-semibold text-foreground">
                    {producedQty.toLocaleString("fr-FR")}
                  </span>{" "}
                  {selectedRecipe?.shopProduct.name ?? "unités"}
                </p>
              </div>
              <Button
                className="h-10 w-full"
                disabled={pending || !recipeId}
                onClick={() =>
                  start(async () => {
                    try {
                      const b = await validateFactoryBatchAction({
                        organizationId: props.organizationId,
                        branchId: props.branchId,
                        recipeId,
                        multiplier,
                      });
                      toast.success(`Lot ${b.number} validé`);
                      router.refresh();
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : "Erreur");
                    }
                  })
                }
              >
                Produire
              </Button>
            </>
          )}
        </BoutiquePanel>
      </div>

      <BoutiquePanel title="Lots" eyebrow="Historique" bodyClassName="p-0">
        {props.batches.length === 0 ? (
          <EmptyState
            icon={Factory}
            title="Aucun lot"
            description="Les lots validés apparaîtront ici."
          />
        ) : (
          <ul className="divide-y divide-border">
            {props.batches.map((b) => (
              <li
                key={b.id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="font-medium">
                    {b.number}{" "}
                    <span className="text-muted-foreground">
                      · {b.outputQty} {b.outputProduct.name}
                    </span>
                  </p>
                  {b.producedAt ? (
                    <p className="text-[11px] text-muted-foreground">
                      {new Date(b.producedAt).toLocaleString("fr-FR")}
                    </p>
                  ) : null}
                </div>
                <BoutiqueStatus tone={batchTone(b.status)}>
                  {b.status}
                </BoutiqueStatus>
              </li>
            ))}
          </ul>
        )}
      </BoutiquePanel>
    </BoutiquePage>
  );
}
