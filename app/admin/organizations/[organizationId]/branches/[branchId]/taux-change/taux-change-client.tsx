"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { ArrowLeftRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setExchangeRateAction } from "@/lib/cash/actions";
import { resolveUsdToCdfInteger } from "@/lib/cash/exchange";
import { cn } from "@/lib/utils";

type Rate = {
  id: string;
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  validFrom: string | Date;
};

/** Devise de saisie UI — le taux stocké reste toujours N FC entiers = 1 $. */
type PrimaryUi = "USD" | "CDF";

function primaryFromPair(from: string, to: string): PrimaryUi {
  if (from.toUpperCase() === "CDF" && to.toUpperCase() === "USD") {
    return "CDF";
  }
  return "USD";
}

export function TauxChangeClient(props: {
  organizationId: string;
  branchId: string;
  rates: Rate[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const latest = props.rates[0];
  const [primaryUi, setPrimaryUi] = useState<PrimaryUi>(
    latest
      ? primaryFromPair(latest.fromCurrency, latest.toCurrency)
      : "CDF",
  );
  const initialFc =
    latest != null && Number.isFinite(latest.rate)
      ? String(resolveUsdToCdfInteger(latest))
      : "2250";
  const [fcPerUsd, setFcPerUsd] = useState(initialFc);

  const n = Math.round(Number(fcPerUsd) || 0);
  const preview = useMemo(() => {
    if (!(n >= 1)) return null;
    return {
      usd: `1 USD = ${n.toLocaleString("fr-FR")} CDF`,
      cdf: `${n.toLocaleString("fr-FR")} CDF = 1 USD`,
    };
  }, [n]);

  function save() {
    start(async () => {
      try {
        if (!(n >= 1)) {
          toast.error("Indiquez un taux entier (ex. 2250).");
          return;
        }
        await setExchangeRateAction({
          organizationId: props.organizationId,
          branchId: props.branchId,
          fromCurrency: primaryUi === "CDF" ? "CDF" : "USD",
          toCurrency: primaryUi === "CDF" ? "USD" : "CDF",
          rate: n,
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
            Taux entier uniquement : 1&nbsp;$ = N&nbsp;FC (ex. 2250). Pas de
            décimales.
          </p>
        </div>
      </div>

      <section className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div>
          <Label className="mb-2 block">Devise de saisie (formulaires)</Label>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ["CDF", "Saisie en CDF"],
                ["USD", "Saisie en USD"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setPrimaryUi(id)}
                className={cn(
                  "rounded-xl border px-3 py-2.5 text-sm font-medium transition",
                  primaryUi === id
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-background text-muted-foreground hover:bg-muted/40",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-1.5">
          <Label>1 USD = combien de CDF ?</Label>
          <Input
            type="number"
            min={1}
            step={1}
            inputMode="numeric"
            value={fcPerUsd}
            onChange={(e) =>
              setFcPerUsd(e.target.value.replace(/[^\d]/g, ""))
            }
            placeholder="2250"
          />
          {preview ? (
            <div className="rounded-lg bg-muted/40 px-3 py-2 text-sm">
              <p className="font-medium">{preview.usd}</p>
              <p className="text-muted-foreground">{preview.cdf}</p>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Exemple : 2250 → 1&nbsp;$ = 2 250&nbsp;FC et 2 250&nbsp;FC = 1&nbsp;$
            </p>
          )}
        </div>
        <Button disabled={pending || !(n >= 1)} onClick={save}>
          Enregistrer le taux
        </Button>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          Historique
        </h2>
        {props.rates.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun taux enregistré.</p>
        ) : (
          props.rates.map((r) => {
            const fc = resolveUsdToCdfInteger(r);
            const primary = primaryFromPair(r.fromCurrency, r.toCurrency);
            return (
              <div
                key={r.id}
                className="rounded-xl border border-border bg-card px-4 py-3 text-sm"
              >
                <p>
                  1 USD = <strong>{fc.toLocaleString("fr-FR")}</strong> CDF
                  <span className="text-muted-foreground">
                    {" "}
                    · {fc.toLocaleString("fr-FR")} CDF = 1 USD
                  </span>
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Saisie {primary}
                  {" · "}
                  {new Date(r.validFrom).toLocaleString("fr-FR")}
                </p>
              </div>
            );
          })
        )}
      </section>
    </div>
  );
}
