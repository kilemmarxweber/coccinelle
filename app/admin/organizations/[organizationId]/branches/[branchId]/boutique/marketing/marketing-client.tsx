"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { importShopCatalogCsvAction } from "@/lib/boutique/import-catalog";
import {
  BoutiqueHero,
  BoutiquePage,
} from "@/components/boutique/boutique-shell";

export function MarketingClient(props: {
  organizationId: string;
  branchId: string;
  top: { name: string; qty: number }[];
  promos: {
    id: string;
    name: string;
    price: number;
    promoPrice: number | null;
    promoLabel: string | null;
  }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [csv, setCsv] = useState("");

  function importCsv() {
    start(async () => {
      try {
        const res = await importShopCatalogCsvAction({
          organizationId: props.organizationId,
          branchId: props.branchId,
          csv,
        });
        toast.success(`${res.created} produit(s) importé(s)`);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erreur");
      }
    });
  }

  return (
    <BoutiquePage>
      <BoutiqueHero
        kicker="Marketing"
        title="Promos, top produits, import"
        subtitle="La fidélisation avancée reste en phase 3. Import CSV/Excel : nom, sku, prix, stock, categorie."
      />
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-4">
          <h2 className="font-semibold">Produits les plus demandés</h2>
          <ul className="mt-3 space-y-1 text-sm">
            {props.top.map((t) => (
              <li key={t.name} className="flex justify-between">
                <span>{t.name}</span>
                <span className="tabular-nums">{t.qty}</span>
              </li>
            ))}
            {props.top.length === 0 ? (
              <li className="text-muted-foreground">Pas encore de ventes.</li>
            ) : null}
          </ul>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <h2 className="font-semibold">Promotions actives</h2>
          <ul className="mt-3 space-y-1 text-sm">
            {props.promos.map((p) => (
              <li key={p.id}>
                {p.name} · {p.promoPrice?.toFixed(2)} $ ({p.promoLabel || "promo"})
              </li>
            ))}
            {props.promos.length === 0 ? (
              <li className="text-muted-foreground">
                Activez une promo sur la fiche produit.
              </li>
            ) : null}
          </ul>
        </div>
      </section>
      <section className="space-y-2 rounded-2xl border border-border p-4">
        <h2 className="font-semibold">Import catalogue (CSV)</h2>
        <textarea
          className="min-h-36 w-full rounded-xl border border-border bg-background p-3 font-mono text-xs"
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
          placeholder={"nom;sku;prix;stock;categorie"}
        />
        <Button className="h-11" disabled={pending} onClick={importCsv}>
          Importer
        </Button>
      </section>
    </BoutiquePage>
  );
}
