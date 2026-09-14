"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createAffiliateOrderRequestAction } from "@/lib/factory/portal-actions";

type Product = {
  id: string;
  name: string;
  price: number;
  finishedFamily: string | null;
  sku: string;
};

export function AffilieDemandeForm(props: {
  orgSlug: string;
  products: Product[];
  defaultAddress: string;
  defaultCity: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [qtyById, setQtyById] = useState<Record<string, number>>({});
  const [requestedDeliveryAt, setRequestedDeliveryAt] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState(props.defaultAddress);
  const [deliveryCity, setDeliveryCity] = useState(props.defaultCity);
  const [notes, setNotes] = useState("");

  const lines = useMemo(
    () =>
      Object.entries(qtyById)
        .filter(([, qty]) => qty > 0)
        .map(([shopProductId, qty]) => ({ shopProductId, qty })),
    [qtyById],
  );

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          try {
            await createAffiliateOrderRequestAction({
              orgSlug: props.orgSlug,
              lines,
              requestedDeliveryAt: requestedDeliveryAt || undefined,
              deliveryAddress,
              deliveryCity,
              notes,
            });
            toast.success("Demande envoyée — en attente du marketeur");
            router.push(`/${props.orgSlug}/usine-affilie`);
            router.refresh();
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Erreur");
          }
        });
      }}
    >
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Produits</h2>
        <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
          {props.products.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between gap-3 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="font-medium">{p.name}</p>
                <p className="text-xs text-muted-foreground">
                  {[p.finishedFamily, `${p.price.toFixed(2)} USD`]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <Input
                type="number"
                min={0}
                className="h-9 w-20 rounded-xl"
                value={qtyById[p.id] ?? 0}
                onChange={(e) =>
                  setQtyById((prev) => ({
                    ...prev,
                    [p.id]: Math.max(0, Math.floor(Number(e.target.value) || 0)),
                  }))
                }
              />
            </li>
          ))}
        </ul>
      </section>

      <div className="grid gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="delivery-at">Date de livraison souhaitée</Label>
          <Input
            id="delivery-at"
            type="date"
            className="h-10 rounded-xl"
            value={requestedDeliveryAt}
            onChange={(e) => setRequestedDeliveryAt(e.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="address">Adresse</Label>
          <Input
            id="address"
            className="h-10 rounded-xl"
            value={deliveryAddress}
            onChange={(e) => setDeliveryAddress(e.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="city">Ville</Label>
          <Input
            id="city"
            className="h-10 rounded-xl"
            value={deliveryCity}
            onChange={(e) => setDeliveryCity(e.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="notes">Notes</Label>
          <Input
            id="notes"
            className="h-10 rounded-xl"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optionnel"
          />
        </div>
      </div>

      <Button type="submit" disabled={pending || lines.length === 0} className="h-11">
        Envoyer la demande
      </Button>
    </form>
  );
}
