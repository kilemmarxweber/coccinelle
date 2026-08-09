"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { ArrowLeftRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setExchangeRateAction } from "@/lib/cash/actions";
import { cn } from "@/lib/utils";

type Rate = {
  id: string;
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  validFrom: string | Date;
};

type Direction = "USD_CDF" | "CDF_USD";

function directionFromPair(from: string, to: string): Direction {
  if (from.toUpperCase() === "CDF" && to.toUpperCase() === "USD") {
    return "CDF_USD";
  }
  return "USD_CDF";
}

function pairFromDirection(dir: Direction) {
  return dir === "CDF_USD"
    ? { from: "CDF", to: "USD" }
    : { from: "USD", to: "CDF" };
}

export function TauxChangeClient(props: {
  organizationId: string;
  branchId: string;
  rates: Rate[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const latest = props.rates[0];
  const [direction, setDirection] = useState<Direction>(
    latest
      ? directionFromPair(latest.fromCurrency, latest.toCurrency)
      : "USD_CDF",
  );
  const [rate, setRate] = useState(String(latest?.rate ?? 2850));

  const { from, to } = pairFromDirection(direction);

  const inversePreview = useMemo(() => {
    const n = Number(rate);
    if (!(n > 0)) return null;
    const inv = 1 / n;
    if (direction === "USD_CDF") {
      return `1 CDF ≈ ${inv.toLocaleString("fr-FR", {
        maximumFractionDigits: 6,
      })} USD`;
    }
    return `1 USD ≈ ${inv.toLocaleString("fr-FR", {
      maximumFractionDigits: 2,
    })} CDF`;
  }, [rate, direction]);

  function selectDirection(next: Direction) {
    if (next === direction) return;
    const n = Number(rate);
    setDirection(next);
    if (n > 0) {
      setRate(String(Number((1 / n).toPrecision(8))));
    }
  }

  function swap() {
    selectDirection(direction === "USD_CDF" ? "CDF_USD" : "USD_CDF");
  }

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
            Configurez USD → CDF ou l’inverse CDF → USD. Le taux actif est figé
            sur chaque reçu.
          </p>
        </div>
      </div>

      <section className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div>
          <Label className="mb-2 block">Sens du taux</Label>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ["USD_CDF", "USD → CDF"],
                ["CDF_USD", "CDF → USD"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => selectDirection(id)}
                className={cn(
                  "rounded-xl border px-3 py-2.5 text-sm font-medium transition",
                  direction === id
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-background text-muted-foreground hover:bg-muted/40",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-end gap-2">
          <div className="grid flex-1 gap-1.5">
            <Label>De</Label>
            <Input value={from} readOnly className="bg-muted/40" />
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="mb-0.5 shrink-0"
            onClick={swap}
            aria-label="Inverser le sens"
          >
            <ArrowLeftRight className="size-4" />
          </Button>
          <div className="grid flex-1 gap-1.5">
            <Label>Vers</Label>
            <Input value={to} readOnly className="bg-muted/40" />
          </div>
        </div>

        <div className="grid gap-1.5">
          <Label>
            Taux (1 {from} = ? {to})
          </Label>
          <Input
            type="number"
            min={0}
            step="any"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
          />
          {inversePreview ? (
            <p className="text-xs text-muted-foreground">
              Inverse : {inversePreview}
            </p>
          ) : null}
        </div>
        <Button disabled={pending || !(Number(rate) > 0)} onClick={save}>
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
            const inv =
              r.rate > 0
                ? (1 / r.rate).toLocaleString("fr-FR", {
                    maximumFractionDigits: 6,
                  })
                : null;
            return (
              <div
                key={r.id}
                className="rounded-xl border border-border bg-card px-4 py-3 text-sm"
              >
                <p>
                  1 {r.fromCurrency} = <strong>{r.rate}</strong> {r.toCurrency}
                  <span className="ml-2 text-muted-foreground">
                    · {new Date(r.validFrom).toLocaleString("fr-FR")}
                  </span>
                </p>
                {inv ? (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    soit 1 {r.toCurrency} ≈ {inv} {r.fromCurrency}
                  </p>
                ) : null}
              </div>
            );
          })
        )}
      </section>
    </div>
  );
}
