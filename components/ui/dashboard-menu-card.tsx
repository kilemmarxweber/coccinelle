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

/** Carte menu — fond blanc, accent cuivre au survol. */
export function DashboardMenuCard({
  href,
  title,
  description,
  icon: Icon,
  iconBg = "bg-primary/12",
  iconColor = "text-primary",
  primary = false,
  delay,
  footer,
}: DashboardMenuCardProps) {
  return (
    <Link
      href={href}
      className={cn(
        "dash-fade-up group flex items-start gap-3.5 rounded-lg border bg-card p-4 shadow-[0_1px_2px_rgba(15,23,42,0.05)] transition duration-200 hover:border-primary/40 hover:shadow-md",
        primary ? "border-primary/35" : "border-border",
      )}
      style={delay != null ? { animationDelay: `${delay}ms` } : undefined}
    >
      <div
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-lg transition duration-200 group-hover:bg-primary group-hover:text-primary-foreground",
          iconBg,
          iconColor,
        )}
      >
        <Icon className="size-5" />
      </div>
      <div className="min-w-0 pt-0.5">
        <p className="font-semibold text-foreground transition group-hover:text-primary">
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
