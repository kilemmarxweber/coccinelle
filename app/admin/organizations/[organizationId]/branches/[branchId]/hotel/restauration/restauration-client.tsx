"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChefHat, UtensilsCrossed } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  advanceHotelOrderAction,
  createHotelOrderAction,
} from "@/lib/hotel/actions";

type MenuItem = {
  id: string;
  name: string;
  category: string;
  price: number;
  needsKitchen: boolean;
};

type Order = {
  id: string;
  tableLabel: string | null;
  status: string;
  items: { name: string; quantity: number; amount: number }[];
};

export function RestaurationClient(props: {
  organizationId: string;
  branchId: string;
  menuItems: MenuItem[];
  orders: Order[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [tableLabel, setTableLabel] = useState("T1");
  const [qty, setQty] = useState<Record<string, number>>({});

  const grouped = useMemo(() => {
    const map = new Map<string, MenuItem[]>();
    for (const m of props.menuItems) {
      const list = map.get(m.category) ?? [];
      list.push(m);
      map.set(m.category, list);
    }
    return [...map.entries()];
  }, [props.menuItems]);

  function send() {
    const items = Object.entries(qty)
      .filter(([, q]) => q > 0)
      .map(([menuItemId, quantity]) => ({ menuItemId, quantity }));
    if (!items.length) {
      toast.message("Ajoutez des articles");
      return;
    }
    start(async () => {
      try {
        await createHotelOrderAction({
          organizationId: props.organizationId,
          branchId: props.branchId,
          tableLabel,
          items,
        });
        toast.success("Commande envoyée");
        setQty({});
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erreur");
      }
    });
  }

  function markDelivered(orderId: string) {
    start(async () => {
      try {
        await advanceHotelOrderAction({
          organizationId: props.organizationId,
          branchId: props.branchId,
          orderId,
          to: "LIVREE",
        });
        toast.success("Livrée");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erreur");
      }
    });
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-6">
      <div className="flex items-start gap-3">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-violet-500/15 text-violet-500">
          <UtensilsCrossed className="size-6" />
        </span>
        <div>
          <h1 className="text-2xl font-bold">Restauration</h1>
          <p className="text-sm text-muted-foreground">
            Serveur — prendre commande, suivre livraison.
          </p>
        </div>
      </div>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-4">
        <div className="grid gap-1.5 max-w-xs">
          <Label>Table / chambre</Label>
          <Input
            value={tableLabel}
            onChange={(e) => setTableLabel(e.target.value)}
          />
        </div>
        {grouped.map(([cat, items]) => (
          <div key={cat} className="space-y-2">
            <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {cat}
            </h3>
            {items.map((m) => (
              <label
                key={m.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm"
              >
                <span>
                  {m.name}
                  {m.needsKitchen ? (
                    <ChefHat className="ml-1 inline size-3.5 text-orange-500" />
                  ) : null}
                  <span className="text-muted-foreground"> · {m.price}</span>
                </span>
                <Input
                  type="number"
                  min={0}
                  className="h-8 w-16"
                  value={qty[m.id] ?? 0}
                  onChange={(e) =>
                    setQty((q) => ({
                      ...q,
                      [m.id]: Number(e.target.value) || 0,
                    }))
                  }
                />
              </label>
            ))}
          </div>
        ))}
        <Button disabled={pending} onClick={send}>
          Envoyer la commande
        </Button>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          Suivi
        </h2>
        {props.orders.map((o) => (
          <div
            key={o.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4"
          >
            <div>
              <p className="font-medium">
                {o.tableLabel ?? "Salle"} · {o.status}
              </p>
              <p className="text-sm text-muted-foreground">
                {o.items.map((i) => `${i.quantity}× ${i.name}`).join(", ")}
              </p>
            </div>
            {o.status === "PAYEE" ? (
              <Button
                size="sm"
                disabled={pending}
                onClick={() => markDelivered(o.id)}
              >
                Marquer livrée
              </Button>
            ) : null}
          </div>
        ))}
      </section>
    </div>
  );
}
