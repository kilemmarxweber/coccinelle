import type { ComponentType, ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export type DashboardMenuCardProps = {
  href: string;
  title: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  iconBg?: string;
  iconColor?: string;
  primary?: boolean;
  /** Décalage d’entrée (ms). */
  delay?: number;
  /** Contenu additionnel sous la description (badges…). */
  footer?: ReactNode;
};

const TONES = {
  emerald: {
    wash: "from-emerald-500/22 via-card to-emerald-500/[0.05]",
    hover:
      "hover:from-emerald-500/40 hover:via-emerald-500/12 hover:border-emerald-500/40",
    iconHover: "group-hover:bg-emerald-600 group-hover:text-white",
    title: "group-hover:text-emerald-700 dark:group-hover:text-emerald-300",
  },
  sky: {
    wash: "from-sky-500/22 via-card to-sky-500/[0.05]",
    hover: "hover:from-sky-500/40 hover:via-sky-500/12 hover:border-sky-500/40",
    iconHover: "group-hover:bg-sky-600 group-hover:text-white",
    title: "group-hover:text-sky-700 dark:group-hover:text-sky-300",
  },
  violet: {
    wash: "from-violet-500/22 via-card to-violet-500/[0.05]",
    hover:
      "hover:from-violet-500/40 hover:via-violet-500/12 hover:border-violet-500/40",
    iconHover: "group-hover:bg-violet-600 group-hover:text-white",
    title: "group-hover:text-violet-700 dark:group-hover:text-violet-300",
  },
  rose: {
    wash: "from-rose-500/22 via-card to-rose-500/[0.05]",
    hover: "hover:from-rose-500/40 hover:via-rose-500/12 hover:border-rose-500/40",
    iconHover: "group-hover:bg-rose-600 group-hover:text-white",
    title: "group-hover:text-rose-700 dark:group-hover:text-rose-300",
  },
  amber: {
    wash: "from-amber-500/24 via-card to-amber-500/[0.06]",
    hover:
      "hover:from-amber-500/42 hover:via-amber-500/12 hover:border-amber-500/40",
    iconHover: "group-hover:bg-amber-500 group-hover:text-amber-950",
    title: "group-hover:text-amber-800 dark:group-hover:text-amber-300",
  },
  teal: {
    wash: "from-teal-500/22 via-card to-teal-500/[0.05]",
    hover: "hover:from-teal-500/40 hover:via-teal-500/12 hover:border-teal-500/40",
    iconHover: "group-hover:bg-teal-600 group-hover:text-white",
    title: "group-hover:text-teal-700 dark:group-hover:text-teal-300",
  },
  indigo: {
    wash: "from-indigo-500/22 via-card to-indigo-500/[0.05]",
    hover:
      "hover:from-indigo-500/40 hover:via-indigo-500/12 hover:border-indigo-500/40",
    iconHover: "group-hover:bg-indigo-600 group-hover:text-white",
    title: "group-hover:text-indigo-700 dark:group-hover:text-indigo-300",
  },
  primary: {
    wash: "from-primary/22 via-card to-primary/[0.06]",
    hover: "hover:from-primary/40 hover:via-primary/12 hover:border-primary/45",
    iconHover: "group-hover:bg-primary group-hover:text-primary-foreground",
    title: "group-hover:text-primary",
  },
} as const;

type ToneKey = keyof typeof TONES;

function inferTone(iconColor?: string, iconBg?: string): ToneKey {
  const hay = `${iconColor ?? ""} ${iconBg ?? ""}`;
  if (hay.includes("emerald")) return "emerald";
  if (hay.includes("sky")) return "sky";
  if (hay.includes("violet")) return "violet";
  if (hay.includes("rose")) return "rose";
  if (hay.includes("amber")) return "amber";
  if (hay.includes("teal")) return "teal";
  if (hay.includes("indigo")) return "indigo";
  return "primary";
}

/** Carte menu — teinte animée, icône qui se remplit au survol. */
export function DashboardMenuCard({
  href,
  title,
  description,
  icon: Icon,
  iconBg = "bg-primary/15",
  iconColor = "text-primary",
  primary = false,
  delay,
  footer,
}: DashboardMenuCardProps) {
  const tone = TONES[inferTone(iconColor, iconBg)];
  return (
    <Link
      href={href}
      className={cn(
        "dash-fade-up dash-card-shift group flex items-start gap-3.5 rounded-2xl border bg-gradient-to-br p-4 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:shadow-md",
        tone.wash,
        tone.hover,
        primary ? "border-primary/35" : "border-border/80",
      )}
      style={delay != null ? { animationDelay: `${delay}ms` } : undefined}
    >
      <div
        className={cn(
          "flex size-11 shrink-0 items-center justify-center rounded-xl transition duration-300",
          iconBg,
          iconColor,
          tone.iconHover,
        )}
      >
        <Icon className="size-5" />
      </div>
      <div className="min-w-0 pt-0.5">
        <p
          className={cn(
            "font-semibold text-foreground transition",
            tone.title,
          )}
        >
          {title}
        </p>
        <p className="mt-0.5 text-sm leading-snug text-muted-foreground">
          {description}
        </p>
        {footer ? <div className="mt-2">{footer}</div> : null}
      </div>
    </Link>
  );
}

export type DashboardSectionProps = {
  title: string;
  titleColor?: string;
  icon: ComponentType<{ className?: string }>;
  iconColor?: string;
  delay?: number;
  children: ReactNode;
};

export function DashboardSection({
  title,
  titleColor = "text-primary",
  icon: Icon,
  iconColor = "text-primary",
  delay,
  children,
}: DashboardSectionProps) {
  return (
    <section
      className="dash-fade-up space-y-4"
      style={delay != null ? { animationDelay: `${delay}ms` } : undefined}
    >
      <div className="flex items-center gap-2">
        <Icon className={cn("size-5", iconColor)} />
        <h3
          className={cn(
            "text-sm font-semibold tracking-wide uppercase",
            titleColor,
          )}
        >
          {title}
        </h3>
      </div>
      {children}
    </section>
  );
}
