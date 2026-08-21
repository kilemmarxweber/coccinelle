"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Settings } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { branchDashboardPath } from "@/lib/branch/paths";
import { savePayrollSettingsAction } from "@/lib/payroll/actions";
import { WEEKDAYS, WEEKDAY_LABEL_FR, type WeekdayCode } from "@/lib/payroll/constants";
import type { PayrollCapabilities, PayrollSettingsDto } from "@/lib/payroll/types";
import { PaieSectionNav } from "../paie-nav";
import {
  BoutiqueHero,
  BoutiquePage,
  BoutiquePanel,
  boutiquePrimaryBtn,
} from "@/components/boutique/boutique-shell";
import { cn } from "@/lib/utils";

type Props = {
  organizationId: string;
  branchId: string;
  branchName: string;
  settings: PayrollSettingsDto;
  caps: PayrollCapabilities;
};

export function PaieSettingsClient({
  organizationId,
  branchId,
  branchName,
  settings,
  caps,
}: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [rate, setRate] = useState(String(settings.defaultDailyRateUsd));
  const [hour, setHour] = useState(String(settings.notifyBeforeHour));
  const [cap, setCap] = useState(String(Math.round(settings.advanceCapPct * 100)));
  const [days, setDays] = useState(String(settings.justificationDays));
  const [week, setWeek] = useState<string[]>(settings.workWeek);

  function toggle(day: WeekdayCode) {
    setWeek((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    );
  }

  function save() {
    start(async () => {
      try {
        await savePayrollSettingsAction({
          organizationId,
          branchId,
          defaultDailyRateUsd: Number(rate),
          workWeek: week,
          notifyBeforeHour: Number(hour),
          advanceCapPct: Number(cap) / 100,
          justificationDays: Number(days),
        });
        toast.success("Paramètres paie enregistrés.");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Enregistrement impossible.");
      }
    });
  }

  return (
    <BoutiquePage>
      <BoutiqueHero
        kicker={`${branchName} · règles`}
        title="Paramètres paie"
        subtitle="Taux journalier, semaine ouvrée, cutoff préavis et plafond d’avance."
        icon={Settings}
        backHref={branchDashboardPath(organizationId, branchId)}
        nav={
          <PaieSectionNav
            organizationId={organizationId}
            branchId={branchId}
            active="parametres"
            showManage={caps.canManage}
            showPoint={caps.canPoint}
          />
        }
      />

      <BoutiquePanel title="Règles de la branche" eyebrow="Commerce">
        <div className="flex flex-col gap-5 p-4 sm:p-5">
        <div className="grid gap-1.5">
          <Label htmlFor="rate">Taux journalier par défaut (USD)</Label>
          <Input
            id="rate"
            type="number"
            min="1"
            step="0.5"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            className="h-11"
          />
        </div>
        <div>
          <p className="mb-2 text-sm font-medium">Semaine ouvrée</p>
          <div className="flex flex-wrap gap-2">
            {WEEKDAYS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => toggle(d)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-sm",
                  week.includes(d)
                    ? "border-[#0f3d2e] bg-[#0f3d2e] text-[#f4efe4]"
                    : "border-[#d9d0c3] text-[#6f675c] bg-white",
                )}
              >
                {WEEKDAY_LABEL_FR[d]}
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="hour">Cutoff préavis (heure la veille)</Label>
          <Input
            id="hour"
            type="number"
            min="0"
            max="23"
            value={hour}
            onChange={(e) => setHour(e.target.value)}
            className="h-11"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="cap">Plafond avance (%)</Label>
          <Input
            id="cap"
            type="number"
            min="1"
            max="100"
            value={cap}
            onChange={(e) => setCap(e.target.value)}
            className="h-11"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="just">Délai de justification (jours)</Label>
          <Input
            id="just"
            type="number"
            min="1"
            value={days}
            onChange={(e) => setDays(e.target.value)}
            className="h-11"
          />
        </div>
        <Button className={boutiquePrimaryBtn("h-11 w-fit")} disabled={pending} onClick={save}>
          Enregistrer
        </Button>
        </div>
      </BoutiquePanel>
    </BoutiquePage>
  );
}
