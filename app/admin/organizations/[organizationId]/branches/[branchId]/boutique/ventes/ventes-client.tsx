"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { correctEncaissedSaleAction } from "@/lib/boutique/actions";
import {
  BoutiqueHero,
  BoutiquePage,
} from "@/components/boutique/boutique-shell";

type Sale = {
  id: string;
  ticketNumber: string;
  status: string;
  totalAmount: number;
  cashierName: string | null;
  paidAt: string | null;
  correctionReason: string | null;
};

export function VentesClient(props: {
  organizationId: string;
  branchId: string;
  sales: Sale[];
  /** Dans l’onglet POS : pas de page ni de bandeau. */
  embedded?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [reasons, setReasons] = useState<Record<string, string>>({});

  function correct(id: string) {
    const reason = (reasons[id] ?? "").trim();
    start(async () => {
      try {
        await correctEncaissedSaleAction({
          organizationId: props.organizationId,
          branchId: props.branchId,
          saleId: id,
          reason,
        });
        toast.success("Vente corrigée — stock rétabli, piste d’audit écrite.");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erreur");
      }
    });
  }

  const encaissed = props.sales.filter((s) => s.status === "ENCAISSEE");
  const ca = encaissed.reduce((sum, s) => sum + s.totalAmount, 0);
  const list = (
      <div className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground">Tickets</p>
            <p className="text-xl font-semibold tabular-nums">{props.sales.length}</p>
          </div>
          <div className="rounded-xl border border-border bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground">CA encaissé</p>
            <p className="text-xl font-semibold tabular-nums text-[#16a34a]">
              {ca.toFixed(2)} $
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground">Corrigés</p>
            <p className="text-xl font-semibold tabular-nums">
              {props.sales.length - encaissed.length}
            </p>
          </div>
        </div>
        {props.sales.map((s) => (
          <div
            key={s.id}
            className="rounded-2xl border border-border bg-card p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-medium">
                  {s.ticketNumber} · {s.totalAmount.toFixed(2)} $
                </p>
                <p className="text-sm text-muted-foreground">
                  Vendeur {s.cashierName || "—"}
                  {s.paidAt
                    ? ` · ${new Date(s.paidAt).toLocaleTimeString("fr-FR")}`
                    : ""}
                </p>
              </div>
              <Badge variant={s.status === "CORRIGEE" ? "secondary" : "default"}>
                {s.status}
              </Badge>
            </div>
            {s.status === "ENCAISSEE" ? (
              <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
                <div className="grid gap-1">
                  <Label className="text-xs">Motif de correction</Label>
                  <Input
                    className="h-11"
                    value={reasons[s.id] ?? ""}
                    onChange={(e) =>
                      setReasons((m) => ({ ...m, [s.id]: e.target.value }))
                    }
                    placeholder="Erreur caisse, retour client…"
                  />
                </div>
                <Button
                  className="h-11 self-end"
                  variant="outline"
                  disabled={pending}
                  onClick={() => correct(s.id)}
                >
                  Corriger
                </Button>
              </div>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">
                Motif : {s.correctionReason}
              </p>
            )}
          </div>
        ))}
        {props.sales.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border bg-card px-4 py-16 text-center text-sm text-muted-foreground">
            Aucun ticket aujourd’hui.
          </p>
        ) : null}
      </div>
  );

  if (props.embedded) return list;

  return (
    <BoutiquePage>
      <BoutiqueHero
        kicker="Ventes"
        title="Tickets du jour"
        subtitle="Une vente encaissée n’est jamais effacée. Correction = motif + autorisation."
      />
      {list}
    </BoutiquePage>
  );
}
