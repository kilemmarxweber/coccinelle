import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Surfaces commerce + paie : fond Windows (#F3F3F3), encre forêt, filet or. */
export const BQ = {
  page: "relative min-h-svh bg-background text-[#1c1917]",
  wash:
    "pointer-events-none absolute inset-0 bg-[radial-gradient(1100px_480px_at_-8%_-12%,rgba(15,61,46,0.06),transparent_58%),radial-gradient(720px_340px_at_108%_0%,rgba(180,122,46,0.04),transparent_46%)]",
  ink: "text-[#0f3d2e]",
  muted: "text-[#6f675c]",
  gold: "text-[#9a7040]",
  line: "border-[#e4ddd0]",
  surface:
    "rounded-[1.35rem] border border-[#e4ddd0] bg-white/90 shadow-[0_1px_0_rgba(15,61,46,0.04),0_18px_40px_-24px_rgba(15,61,46,0.28)]",
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
      <div className="h-1 w-full bg-gradient-to-r from-[#0f3d2e] via-[#c4a574] to-[#0f3d2e]" />
      <div className="flex flex-col gap-5 px-4 py-5 sm:px-6 sm:py-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            {backHref ? (
              <Button
                variant="ghost"
                size="sm"
                className="-ml-2 mb-2 h-8 rounded-full text-[#6f675c] hover:bg-[#0f3d2e]/6 hover:text-[#0f3d2e]"
                render={<Link href={backHref} />}
              >
                <ArrowLeft className="size-4" />
                {backLabel}
              </Button>
            ) : null}
            <div className="flex items-start gap-3">
              {Icon ? (
                <span className="mt-0.5 flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[#0f3d2e] text-[#f4efe4] shadow-sm">
                  <Icon className="size-5" />
                </span>
              ) : null}
              <div className="min-w-0">
                <p className="text-[11px] font-semibold tracking-[0.18em] text-[#9a7040] uppercase">
                  {kicker}
                </p>
                <h1 className="font-serif text-2xl font-semibold tracking-tight text-[#0f3d2e] sm:text-[1.85rem]">
                  {title}
                </h1>
                {subtitle ? (
                  <p className="mt-1 max-w-2xl text-sm leading-relaxed text-[#6f675c]">
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
            item.tone === "money" && "bg-[#0f3d2e] text-[#f4efe4] border-[#0f3d2e]",
          )}
        >
          <p
            className={cn(
              "text-[10px] font-semibold tracking-[0.14em] uppercase",
              item.tone === "money" ? "text-[#c4a574]" : "text-[#9a7040]",
            )}
          >
            {item.label}
          </p>
          <p
            className={cn(
              "mt-1 font-serif text-2xl font-semibold tabular-nums tracking-tight",
              item.tone === "danger" && "text-rose-700",
              item.tone === "warn" && "text-amber-800",
              item.tone === "ok" && "text-emerald-800",
              item.tone === "money" && "text-[#f4efe4]",
              !item.tone || item.tone === "default" ? "text-[#0f3d2e]" : null,
            )}
          >
            {item.value}
          </p>
          {item.hint ? (
            <p
              className={cn(
                "mt-0.5 text-[11px]",
                item.tone === "money" ? "text-white/55" : "text-[#6f675c]",
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
    <div className="flex flex-wrap gap-1.5 rounded-2xl bg-[#0f3d2e]/5 p-1.5">
      {items.map((item) => {
        const active = value === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            className={cn(
              "rounded-xl px-3.5 py-2 text-sm font-semibold transition",
              active
                ? "bg-[#0f3d2e] text-[#f4efe4] shadow-sm"
                : "text-[#4a453e] hover:bg-white/80",
            )}
          >
            {item.label}
            {item.count != null ? (
              <span
                className={cn(
                  "ml-1.5 rounded-md px-1.5 py-0.5 text-[10px] font-bold tabular-nums",
                  active ? "bg-white/15" : "bg-white text-[#0f3d2e]/70",
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
      ? "bg-[#eef6f1]"
      : tint === "amber"
        ? "bg-[#f8f1e4]"
        : tint === "rose"
          ? "bg-[#f8ecec]"
          : "bg-[#faf8f4]";
  return (
    <section className={cn(BQ.surface, "overflow-hidden", className)}>
      {title ? (
        <div
          className={cn(
            "flex flex-wrap items-center justify-between gap-2 border-b border-[#e4ddd0] px-4 py-3",
            head,
          )}
        >
          <div className="flex min-w-0 items-center gap-2">
            {Icon ? <Icon className="size-4 shrink-0 text-[#9a7040]" /> : null}
            <div>
              {eyebrow ? (
                <p className="text-[10px] font-semibold tracking-[0.14em] text-[#9a7040] uppercase">
                  {eyebrow}
                </p>
              ) : null}
              <p className="text-sm font-semibold text-[#0f3d2e]">{title}</p>
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
        tone === "danger" && "bg-rose-500/12 text-rose-800",
        tone === "info" && "bg-sky-500/12 text-sky-900",
        tone === "gold" && "bg-[#c4a574]/25 text-[#6b4e24]",
        tone === "neutral" && "bg-[#0f3d2e]/8 text-[#0f3d2e]",
      )}
    >
      {children}
    </span>
  );
}

export function boutiquePrimaryBtn(className?: string) {
  return cn(
    "rounded-full bg-[#0f3d2e] text-[#f4efe4] hover:bg-[#0f3d2e]/90",
    className,
  );
}

export function boutiqueOutlineBtn(className?: string) {
  return cn(
    "rounded-full border-[#d9d0c3] bg-white text-[#0f3d2e] hover:bg-[#F3F3F3]",
    className,
  );
}
