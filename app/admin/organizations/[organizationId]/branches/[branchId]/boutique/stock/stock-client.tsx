"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, PackagePlus } from "lucide-react";
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
import { cn } from "@/lib/utils";

type Movement = {
  id: string;
  kind: "ENTREE" | "SORTIE" | "AJUSTEMENT";
  quantity: number;
  note: string | null;
  createdAt: Date | string;
  product: { name: string; sku: string };
};

type Props = {
  organizationId: string;
  branchId: string;
  branchName: string;
  products: ShopProductDto[];
  movements: Movement[];
};

export function BoutiqueStockClient(props: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [productId, setProductId] = useState("");
  const [kind, setKind] = useState<"ENTREE" | "AJUSTEMENT">("ENTREE");
  const [qty, setQty] = useState("10");
  const [note, setNote] = useState("");

  const low = useMemo(
    () => props.products.filter((p) => p.active && p.stockQty <= 5),
    [props.products],
  );

  function save() {
    const quantity = Number(qty);
    if (!productId) {
      toast.error("Choisissez un produit");
      return;
    }
    if (!(quantity > 0) || Number.isNaN(quantity)) {
      toast.error("Quantité invalide");
      return;
    }
    start(async () => {
      try {
        await adjustShopStockAction({
          organizationId: props.organizationId,
          branchId: props.branchId,
          productId,
          kind,
          quantity,
          note: note || undefined,
        });
        toast.success(kind === "ENTREE" ? "Entrée enregistrée" : "Stock ajusté");
        setDialogOpen(false);
        setNote("");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erreur");
      }
    });
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5 px-4 py-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2 mb-1"
            render={
              <Link
                href={branchDashboardPath(
                  props.organizationId,
                  props.branchId,
                )}
              />
            }
          >
            <ArrowLeft className="size-4" />
            Retour
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">Stock</h1>
          <p className="text-sm text-muted-foreground">{props.branchName}</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <PackagePlus className="size-4" />
          Entrée / ajustement
        </Button>
      </div>

      {low.length > 0 ? (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
          <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
            Alertes stock bas ({low.length})
          </p>
          <p className="mt-1 text-xs text-amber-800/80 dark:text-amber-200/80">
            {low.map((p) => `${p.name} (${p.stockQty})`).join(" · ")}
          </p>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Produit</th>
              <th className="px-3 py-2 font-medium">Type</th>
              <th className="px-3 py-2 font-medium">Stock</th>
              <th className="px-3 py-2 font-medium">Dispo POS</th>
            </tr>
          </thead>
          <tbody>
            {props.products.map((p) => (
              <tr key={p.id} className="border-t border-border">
                <td className="px-3 py-2">
                  <p className="font-medium">{p.name}</p>
                  <p className="text-xs text-muted-foreground">
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
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold">Mouvements récents</h2>
        <div className="space-y-2">
          {props.movements.map((m) => (
            <div
              key={m.id}
              className="flex items-center justify-between rounded-xl border border-border px-3 py-2 text-sm"
            >
              <div>
                <p className="font-medium">{m.product.name}</p>
                <p className="text-xs text-muted-foreground">
                  {m.kind} · {m.note || "—"}
                </p>
              </div>
              <p className="tabular-nums font-semibold">
                {m.kind === "SORTIE" ? "−" : "+"}
                {m.quantity}
              </p>
            </div>
          ))}
          {props.movements.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun mouvement.</p>
          ) : null}
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mouvement stock</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label>Produit</Label>
              <select
                className="h-9 rounded-lg border border-input bg-background px-3 text-sm"
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
              >
                <option value="">—</option>
                {props.products.map((p) => (
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
                value={kind}
                onChange={(e) =>
                  setKind(e.target.value as "ENTREE" | "AJUSTEMENT")
                }
              >
                <option value="ENTREE">Entrée (+qty)</option>
                <option value="AJUSTEMENT">Ajustement (= nouveau stock)</option>
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label>
                {kind === "ENTREE" ? "Quantité à ajouter" : "Nouveau stock"}
              </Label>
              <Input
                type="number"
                min={0}
                value={qty}
                onChange={(e) => setQty(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Note</Label>
              <Input
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Annuler
            </Button>
            <Button disabled={pending} onClick={save}>
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
