"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { ArrowLeftRight, History } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setExchangeRateAction } from "@/lib/cash/actions";
import { resolveUsdToCdfInteger } from "@/lib/cash/exchange";
import {
  choiceBtnClass,
  ParametresPanel,
} from "../parametres/parametres-section-nav";

type Rate = {
  id: string;
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  validFrom: string | Date;
};

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
    latest ? primaryFromPair(latest.fromCurrency, latest.toCurrency) : "CDF",
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
    <div className="space-y-5">
      <ParametresPanel
        title="Nouveau taux"
        description="Saisissez le cours entier 1 USD = N CDF."
        icon={ArrowLeftRight}
      >
        <div className="space-y-4">
          <div>
            <Label className="mb-2 block">Devise de saisie</Label>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  ["CDF", "CDF"],
                  ["USD", "USD"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setPrimaryUi(id)}
                  className={choiceBtnClass(primaryUi === id)}
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
              onChange={(e) => setFcPerUsd(e.target.value.replace(/[^\d]/g, ""))}
              placeholder="2250"
            />
            {preview ? (
              <p className="rounded-lg bg-primary/10 px-3 py-2 text-sm font-medium text-foreground">
                {preview.usd} · {preview.cdf}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">Exemple : 2250</p>
            )}
          </div>
          <Button disabled={pending || !(n >= 1)} onClick={save}>
            Enregistrer
          </Button>
        </div>
      </ParametresPanel>

      <ParametresPanel
        title="Historique"
        description="Derniers cours enregistrés."
        icon={History}
      >
        {props.rates.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Aucun taux enregistré.
          </p>
        ) : (
          <ul className="divide-y divide-border text-sm">
            {props.rates.map((r) => {
              const fc = resolveUsdToCdfInteger(r);
              return (
                <li
                  key={r.id}
                  className="flex items-baseline justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                >
                  <span className="font-medium">
                    1 USD = {fc.toLocaleString("fr-FR")} CDF
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(r.validFrom).toLocaleString("fr-FR")}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </ParametresPanel>
    </div>
  );
}
