"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChefHat } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { advanceHotelOrderAction } from "@/lib/hotel/actions";

type Order = {
  id: string;
  tableLabel: string | null;
  status: string;
  items: {
    name: string;
    quantity: number;
    needsKitchen: boolean;
  }[];
};

export function CuisineClient(props: {
  organizationId: string;
  branchId: string;
  orders: Order[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function advance(
    orderId: string,
    to: "EN_PREPARATION" | "PRETE",
  ) {
    start(async () => {
      try {
        await advanceHotelOrderAction({
          organizationId: props.organizationId,
          branchId: props.branchId,
          orderId,
          to,
        });
        toast.success(to === "PRETE" ? "Prêt — notifié caisse" : "En préparation");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erreur");
      }
    });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
      <div className="flex items-start gap-3">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-orange-500/15 text-orange-500">
          <ChefHat className="size-6" />
        </span>
        <div>
          <h1 className="text-2xl font-bold">Cuisine</h1>
          <p className="text-sm text-muted-foreground">
            File de préparation — marquez « Prêt » pour la caisse.
          </p>
        </div>
      </div>

      {props.orders.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucune commande en cuisine.</p>
      ) : (
        <div className="space-y-3">
          {props.orders.map((o) => (
            <div
              key={o.id}
              className="rounded-2xl border border-border bg-card p-5 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold">
                    {o.tableLabel ?? "Salle"} · {o.status}
                  </p>
                  <ul className="mt-2 space-y-1 text-sm">
                    {o.items
                      .filter((i) => i.needsKitchen)
                      .map((i, idx) => (
                        <li key={idx}>
                          {i.quantity}× {i.name}
                        </li>
                      ))}
                  </ul>
                </div>
                <div className="flex flex-col gap-2">
                  {o.status === "ENVOYEE" ? (
                    <Button
                      disabled={pending}
                      onClick={() => advance(o.id, "EN_PREPARATION")}
                    >
                      Préparer
                    </Button>
                  ) : null}
                  {(o.status === "ENVOYEE" ||
                    o.status === "EN_PREPARATION") && (
                    <Button
                      variant="secondary"
                      disabled={pending}
                      onClick={() => advance(o.id, "PRETE")}
                    >
                      Marquer prêt
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
