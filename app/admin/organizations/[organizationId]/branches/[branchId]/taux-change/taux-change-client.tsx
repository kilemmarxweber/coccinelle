"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowLeftRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setExchangeRateAction } from "@/lib/cash/actions";

type Rate = {
  id: string;
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  validFrom: string | Date;
};

export function TauxChangeClient(props: {
  organizationId: string;
  branchId: string;
  rates: Rate[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [rate, setRate] = useState(
    String(props.rates[0]?.rate ?? 2850),
  );
  const [from, setFrom] = useState(props.rates[0]?.fromCurrency ?? "USD");
  const [to, setTo] = useState(props.rates[0]?.toCurrency ?? "CDF");

  function save() {
    start(async () => {
      try {
        await setExchangeRateAction({
          organizationId: props.organizationId,
          branchId: props.branchId,
          fromCurrency: from,
          toCurrency: to,
          rate: Number(rate),
        });
        toast.success("Taux enregistré");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erreur");
      }
    });
  }

  return (
    <div className="mx-auto max-w-xl space-y-6 px-4 py-6">
      <div className="flex items-start gap-3">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <ArrowLeftRight className="size-6" />
        </span>
        <div>
          <h1 className="text-2xl font-bold">Taux de Change</h1>
          <p className="text-sm text-muted-foreground">
            Le taux actif est figé sur chaque reçu de paiement.
          </p>
        </div>
      </div>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <Label>De</Label>
            <Input value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>Vers</Label>
            <Input value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>
        <div className="grid gap-1.5">
          <Label>Taux (1 {from} = ? {to})</Label>
          <Input
            type="number"
            min={0}
            step="0.01"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
          />
        </div>
        <Button disabled={pending} onClick={save}>
          Enregistrer le taux
        </Button>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase">
          Historique
        </h2>
        {props.rates.map((r) => (
          <div
            key={r.id}
            className="rounded-xl border border-border bg-card px-4 py-3 text-sm"
          >
            1 {r.fromCurrency} = <strong>{r.rate}</strong> {r.toCurrency}
            <span className="ml-2 text-muted-foreground">
              · {new Date(r.validFrom).toLocaleString("fr-FR")}
            </span>
          </div>
        ))}
      </section>
    </div>
  );
}
