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
  /** Contenu additionnel sous la description (badges…). */
  footer?: ReactNode;
};

/** Carte menu — même style que le dashboard branche. */
export function DashboardMenuCard({
  href,
  title,
  description,
  icon: Icon,
  iconBg = "bg-primary/15",
  iconColor = "text-primary",
  primary = false,
  footer,
}: DashboardMenuCardProps) {
  return (
    <Link
      href={href}
      className={cn(
        "group flex items-start gap-3.5 rounded-xl border bg-card p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md",
        primary
          ? "border-primary/50 hover:border-primary hover:shadow-primary/15"
          : "border-border hover:border-primary/40 hover:shadow-primary/10",
      )}
    >
      <div
        className={cn(
          "flex size-11 shrink-0 items-center justify-center rounded-xl",
          iconBg,
        )}
      >
        <Icon className={cn("size-5", iconColor)} />
      </div>
      <div className="min-w-0 pt-0.5">
        <p className="font-semibold text-foreground group-hover:text-primary">
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
  children: ReactNode;
};

export function DashboardSection({
  title,
  titleColor = "text-foreground",
  icon: Icon,
  iconColor = "text-primary",
  children,
}: DashboardSectionProps) {
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <Icon className={cn("size-5", iconColor)} />
        <h3
          className={cn(
            "text-sm font-bold tracking-wide uppercase",
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
