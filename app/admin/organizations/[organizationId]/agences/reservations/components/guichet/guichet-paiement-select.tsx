"use client";

import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { ModePaiement } from "./types";

const OPTIONS: { value: ModePaiement; label: string }[] = [
  { value: "CASH", label: "Espèces" },
  { value: "MOBILE", label: "Mobile Money" },
  { value: "CARD", label: "Carte" },
];

const OPTIONS_DESKTOP: { value: ModePaiement; label: string }[] = [
  { value: "CASH", label: "Espèces (payé au guichet)" },
  { value: "MOBILE", label: "Mobile Money" },
  { value: "CARD", label: "Carte" },
];

type Props = {
  value: ModePaiement;
  onChange: (mode: ModePaiement) => void;
  variant?: "mobile" | "desktop";
};

export function GuichetPaiementSelect({ value, onChange, variant = "mobile" }: Props) {
  const list = variant === "desktop" ? OPTIONS_DESKTOP : OPTIONS;

  return (
    <div className={variant === "desktop" ? "hidden space-y-1.5 md:block" : undefined}>
      {variant === "desktop" && <Label>Mode de paiement</Label>}
      <Select
        className="h-11 w-full"
        value={value}
        onChange={(e) => onChange(e.target.value as ModePaiement)}
      >
        {list.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
    </div>
  );
}
