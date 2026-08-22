import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Surfaces commerce + paie : mêmes couleurs de carte que Paramètres. */
export const BQ = {
  page: "relative min-h-svh bg-background text-foreground",
  wash:
    "pointer-events-none absolute inset-0 bg-[radial-gradient(1100px_480px_at_-8%_-12%,color-mix(in_oklab,var(--primary)_10%,transparent),transparent_58%),radial-gradient(720px_340px_at_108%_0%,color-mix(in_oklab,var(--primary)_6%,transparent),transparent_46%)]",
  ink: "text-foreground",
  muted: "text-muted-foreground",
  gold: "text-primary",
  line: "border-border",
  surface:
    "rounded-xl bg-card text-card-foreground shadow-sm ring-1 ring-foreground/10",
} as const;

export function BoutiquePage({
  children,
  wide,
  className,
}: {
  children: ReactNode;
  wide?: boolean;
  className?: string;
}) {
  return (
    <div className={cn(BQ.page, className)}>
      <div className={BQ.wash} />
      <div
        className={cn(
          "relative mx-auto flex w-full flex-col gap-5 px-3 py-6 sm:px-6 sm:py-8",
          wide ? "max-w-7xl" : "max-w-6xl",
        )}
      >
        {children}
      </div>
    </div>
  );
}

export function BoutiqueHero({
  kicker,
  title,
  subtitle,
  icon: Icon,
  backHref,
  backLabel = "Hub",
  actions,
  nav,
}: {
  kicker: string;
  title: string;
  subtitle?: ReactNode;
  icon?: LucideIcon;
  backHref?: string;
  backLabel?: string;
  actions?: ReactNode;
  nav?: ReactNode;
}) {
  return (
    <header className={cn(BQ.surface, "overflow-hidden")}>
      <div className="h-1 w-full bg-primary" />
      <div className="flex flex-col gap-5 px-4 py-5 sm:px-6 sm:py-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            {backHref ? (
              <Button
                variant="ghost"
                size="sm"
                className="-ml-2 mb-2 h-8 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                render={<Link href={backHref} />}
              >
                <ArrowLeft className="size-4" />
                {backLabel}
              </Button>
            ) : null}
            <div className="flex items-start gap-3">
              {Icon ? (
                <span className="mt-0.5 flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary shadow-sm">
                  <Icon className="size-5" />
                </span>
              ) : null}
              <div className="min-w-0">
                <p className="text-[11px] font-semibold tracking-[0.18em] text-primary uppercase">
                  {kicker}
                </p>
                <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-[1.85rem]">
                  {title}
                </h1>
                {subtitle ? (
                  <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                    {subtitle}
                  </p>
                ) : null}
              </div>
            </div>
          </div>
          {actions ? (
            <div className="flex flex-wrap items-center gap-2 lg:justify-end">
              {actions}
            </div>
          ) : null}
        </div>
        {nav}
      </div>
    </header>
  );
}

export function BoutiqueKpis({
  items,
}: {
  items: {
    label: string;
    value: ReactNode;
    hint?: string;
    tone?: "default" | "ok" | "warn" | "danger" | "money";
  }[];
}) {
  return (
    <div
      className={cn(
        "grid gap-3",
        items.length <= 3
          ? "sm:grid-cols-3"
          : items.length === 4
            ? "sm:grid-cols-2 lg:grid-cols-4"
            : "sm:grid-cols-2 lg:grid-cols-5",
      )}
    >
      {items.map((item) => (
        <div
          key={item.label}
          className={cn(
            BQ.surface,
            "px-4 py-3.5",
            item.tone === "money" &&
              "bg-primary text-primary-foreground ring-primary",
          )}
        >
          <p
            className={cn(
              "text-[10px] font-semibold tracking-[0.14em] uppercase",
              item.tone === "money"
                ? "text-primary-foreground/80"
                : "text-primary",
            )}
          >
            {item.label}
          </p>
          <p
            className={cn(
              "mt-1 text-2xl font-semibold tabular-nums tracking-tight",
              item.tone === "danger" && "text-destructive",
              item.tone === "warn" && "text-amber-800",
              item.tone === "ok" && "text-emerald-800",
              item.tone === "money" && "text-primary-foreground",
              !item.tone || item.tone === "default" ? "text-foreground" : null,
            )}
          >
            {item.value}
          </p>
          {item.hint ? (
            <p
              className={cn(
                "mt-0.5 text-[11px]",
                item.tone === "money"
                  ? "text-primary-foreground/70"
                  : "text-muted-foreground",
              )}
            >
              {item.hint}
            </p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export function BoutiqueTabs<T extends string>({
  items,
  value,
  onChange,
}: {
  items: { id: T; label: string; count?: number }[];
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1 rounded-xl bg-muted p-1">
      {items.map((item) => {
        const active = value === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            className={cn(
              "rounded-lg px-3.5 py-2 text-sm font-medium transition",
              active
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-background/80 hover:text-foreground",
            )}
          >
            {item.label}
            {item.count != null ? (
              <span
                className={cn(
                  "ml-1.5 rounded-md px-1.5 py-0.5 text-[10px] font-bold tabular-nums",
                  active
                    ? "bg-primary-foreground/15"
                    : "bg-background text-muted-foreground",
                )}
              >
                {item.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export function BoutiquePanel({
  title,
  eyebrow,
  icon: Icon,
  actions,
  children,
  className,
  bodyClassName,
  tint = "none",
}: {
  title?: ReactNode;
  eyebrow?: string;
  icon?: LucideIcon;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  tint?: "none" | "mint" | "amber" | "rose";
}) {
  const head =
    tint === "mint"
      ? "bg-primary/5"
      : tint === "amber"
        ? "bg-amber-500/10"
        : tint === "rose"
          ? "bg-destructive/5"
          : "bg-muted/30";
  return (
    <section className={cn(BQ.surface, "overflow-hidden", className)}>
      {title ? (
        <div
          className={cn(
            "flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3",
            head,
          )}
        >
          <div className="flex min-w-0 items-center gap-2">
            {Icon ? (
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                <Icon className="size-4" />
              </span>
            ) : null}
            <div>
              {eyebrow ? (
                <p className="text-[10px] font-semibold tracking-[0.14em] text-primary uppercase">
                  {eyebrow}
                </p>
              ) : null}
              <p className="text-sm font-semibold text-foreground">{title}</p>
            </div>
          </div>
          {actions}
        </div>
      ) : null}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

export function BoutiqueStatus({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "ok" | "warn" | "danger" | "info" | "gold";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide",
        tone === "ok" && "bg-emerald-700/12 text-emerald-900",
        tone === "warn" && "bg-amber-500/18 text-amber-950",
        tone === "danger" && "bg-destructive/10 text-destructive",
        tone === "info" && "bg-sky-500/12 text-sky-900",
        tone === "gold" && "bg-primary/15 text-primary",
        tone === "neutral" && "bg-primary/10 text-primary",
      )}
    >
      {children}
    </span>
  );
}

export function boutiquePrimaryBtn(className?: string) {
  return cn(
    "rounded-full bg-primary text-primary-foreground hover:bg-primary/90",
    className,
  );
}

export function boutiqueOutlineBtn(className?: string) {
  return cn(
    "rounded-full border-border bg-card text-foreground hover:bg-muted",
    className,
  );
}
