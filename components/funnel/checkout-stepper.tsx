"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export const FUNNEL_STEPS = [
  { id: "recherche", label: "Recherche" },
  { id: "passagers", label: "Passagers" },
  { id: "options", label: "Options" },
  { id: "paiement", label: "Paiement" },
] as const;

export type FunnelStepId = (typeof FUNNEL_STEPS)[number]["id"];

export type CheckoutStepperProps = {
  steps?: ReadonlyArray<{ id: string; label: string }>;
  currentStep: string;
  className?: string;
  onStepClick?: (stepId: string) => void;
};

export function CheckoutStepper({
  steps = FUNNEL_STEPS,
  currentStep,
  className,
  onStepClick,
}: CheckoutStepperProps) {
  const currentIndex = Math.max(
    0,
    steps.findIndex((s) => s.id === currentStep),
  );

  return (
    <nav aria-label="Étapes du parcours" className={cn("w-full", className)}>
      <ol className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-0">
        {steps.map((step, index) => {
          const done = index < currentIndex;
          const active = index === currentIndex;
          const clickable = Boolean(onStepClick) && (done || active);

          return (
            <li
              key={step.id}
              className={cn(
                "flex flex-1 items-center gap-2",
                index < steps.length - 1 && "sm:pr-2",
              )}
            >
              <button
                type="button"
                disabled={!clickable}
                onClick={() => onStepClick?.(step.id)}
                className={cn(
                  "flex min-h-11 items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors",
                  clickable && "hover:bg-muted/60",
                  !clickable && "cursor-default",
                )}
                aria-current={active ? "step" : undefined}
              >
                <span
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                    done && "bg-primary text-primary-foreground",
                    active &&
                      "bg-primary text-primary-foreground ring-2 ring-primary/30",
                    !done && !active && "bg-muted text-muted-foreground",
                  )}
                  aria-hidden
                >
                  {done ? <Check className="size-4" /> : index + 1}
                </span>
                <span
                  className={cn(
                    "text-sm font-medium",
                    active ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {step.label}
                </span>
              </button>
              {index < steps.length - 1 && (
                <div
                  className={cn(
                    "mx-1 hidden h-px flex-1 sm:block",
                    done ? "bg-primary/40" : "bg-border",
                  )}
                  aria-hidden
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
