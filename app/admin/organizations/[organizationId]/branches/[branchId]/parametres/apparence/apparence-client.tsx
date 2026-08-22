"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Palette, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  choiceBtnClass,
  ParametresPanel,
} from "../parametres-section-nav";
import {
  CUSTOMER_UI_PRESETS,
  DEFAULT_CUSTOMER_UI_THEME,
  isHexColor,
  matchingCustomerUiPresetId,
  normalizeHexColor,
  type CustomerUiTheme,
} from "@/lib/branch/customer-ui-theme";
import {
  resetCustomerUiThemeAction,
  saveCustomerUiThemeAction,
} from "@/lib/branch/customer-ui-actions";
import { cn } from "@/lib/utils";

type Props = {
  organizationId: string;
  branchId: string;
  initialTheme: CustomerUiTheme;
};

function ColorField({
  label,
  hint,
  value,
  fallback,
  onChange,
}: {
  label: string;
  hint: string;
  value: string;
  fallback: string;
  onChange: (hex: string) => void;
}) {
  const pickerValue = isHexColor(value) ? value : fallback;
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={pickerValue}
          onChange={(e) => onChange(normalizeHexColor(e.target.value, fallback))}
          className="size-10 shrink-0 cursor-pointer rounded-lg border border-border bg-background p-0.5"
          aria-label={label}
        />
        <Input
          value={value}
          onChange={(e) => {
            const next = e.target.value.trim();
            onChange(next.startsWith("#") ? next.toUpperCase() : `#${next}`);
          }}
          onBlur={() => {
            if (!isHexColor(value)) onChange(fallback);
          }}
          spellCheck={false}
          className="font-mono uppercase"
        />
      </div>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

export function CustomerUiApparenceClient({
  organizationId,
  branchId,
  initialTheme,
}: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [theme, setTheme] = useState<CustomerUiTheme>(initialTheme);
  const presetId = matchingCustomerUiPresetId(theme);

  const previewStyle = useMemo(
    () =>
      ({
        background: theme.background,
        color: "#1A1612",
      }) as const,
    [theme.background],
  );

  function patch(partial: Partial<CustomerUiTheme>) {
    setTheme((prev) => ({ ...prev, ...partial }));
  }

  function save() {
    start(async () => {
      try {
        if (
          !isHexColor(theme.primary) ||
          !isHexColor(theme.background) ||
          !isHexColor(theme.card)
        ) {
          toast.error("Indiquez des couleurs #RRGGBB valides.");
          return;
        }
        await saveCustomerUiThemeAction({
          organizationId,
          branchId,
          theme: {
            primary: normalizeHexColor(theme.primary, DEFAULT_CUSTOMER_UI_THEME.primary),
            background: normalizeHexColor(
              theme.background,
              DEFAULT_CUSTOMER_UI_THEME.background,
            ),
            card: normalizeHexColor(theme.card, DEFAULT_CUSTOMER_UI_THEME.card),
          },
        });
        toast.success("Couleurs enregistrées pour cette branche");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erreur");
      }
    });
  }

  function reset() {
    start(async () => {
      try {
        const result = await resetCustomerUiThemeAction({
          organizationId,
          branchId,
        });
        setTheme(result.theme);
        toast.success("Thème Coccinelle rétabli");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erreur");
      }
    });
  }

  return (
    <div className="space-y-6">
      <ParametresPanel
        title="Couleurs de base"
        description="Accent, fond et cartes de l’interface client publique, aussi appliquées à l’espace de cette branche."
        icon={Palette}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={pending}
              onClick={reset}
            >
              <RotateCcw className="size-3.5" />
              Défaut
            </Button>
            <Button type="button" size="sm" disabled={pending} onClick={save}>
              Enregistrer
            </Button>
          </div>
        }
      >
        <div className="space-y-5">
          <div>
            <p className="mb-2 text-sm font-medium">Palettes</p>
            <div className="flex flex-wrap gap-2">
              {CUSTOMER_UI_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className={cn(choiceBtnClass(presetId === preset.id), "gap-2")}
                  onClick={() => setTheme(preset.theme)}
                >
                  <span
                    className="size-3.5 rounded-full ring-1 ring-black/10"
                    style={{ backgroundColor: preset.theme.primary }}
                    aria-hidden
                  />
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-3">
            <ColorField
              label="Accent"
              hint="Boutons, liens, barre latérale."
              value={theme.primary}
              fallback={DEFAULT_CUSTOMER_UI_THEME.primary}
              onChange={(primary) => patch({ primary })}
            />
            <ColorField
              label="Fond"
              hint="Arrière-plan des pages."
              value={theme.background}
              fallback={DEFAULT_CUSTOMER_UI_THEME.background}
              onChange={(background) => patch({ background })}
            />
            <ColorField
              label="Cartes"
              hint="Panneaux et formulaires."
              value={theme.card}
              fallback={DEFAULT_CUSTOMER_UI_THEME.card}
              onChange={(card) => patch({ card })}
            />
          </div>
        </div>
      </ParametresPanel>

      <ParametresPanel
        title="Aperçu"
        description="Rendu approximatif avec les couleurs choisies."
      >
        <div
          className="overflow-hidden rounded-xl ring-1 ring-foreground/10"
          style={previewStyle}
        >
          <div className="h-1.5 w-full" style={{ background: theme.primary }} />
          <div className="p-4">
            <div
              className="rounded-xl p-4 shadow-sm ring-1 ring-black/10"
              style={{ background: theme.card }}
            >
              <p
                className="text-[11px] font-semibold tracking-[0.16em] uppercase"
                style={{ color: theme.primary }}
              >
                Interface client
              </p>
              <p className="mt-1 text-base font-semibold">Réservation</p>
              <p className="mt-1 text-sm text-black/55">
                Recherchez un trajet et confirmez en quelques étapes.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <span
                  className="inline-flex h-9 items-center rounded-lg px-3 text-sm font-medium text-white"
                  style={{ background: theme.primary }}
                >
                  Continuer
                </span>
                <span className="inline-flex h-9 items-center rounded-lg bg-black/5 px-3 text-sm font-medium text-black/70">
                  Annuler
                </span>
              </div>
            </div>
          </div>
        </div>
      </ParametresPanel>
    </div>
  );
}
