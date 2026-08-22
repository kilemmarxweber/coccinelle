"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeftRight, Palette, Shield, Users, type LucideIcon } from "lucide-react";
import { sharedBranchRoutes } from "@/lib/branch/paths";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function ParametresShell({
  title,
  subtitle,
  organizationId,
  branchId,
  active,
  actions,
  children,
  wide,
}: {
  title: string;
  subtitle?: string;
  organizationId: string;
  branchId: string;
  active: "roles" | "users" | "taux" | "apparence";
  actions?: ReactNode;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div
      className={cn(
        "mx-auto w-full px-4 py-8 sm:px-6",
        wide ? "max-w-5xl" : "max-w-3xl",
      )}
    >
      <Card className="mb-6 gap-0 overflow-hidden py-0 shadow-sm">
        <div className="h-1 w-full bg-primary" />
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 px-5 py-5 sm:px-6">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold tracking-[0.16em] text-primary uppercase">
              Paramètres
            </p>
            <CardTitle className="text-xl font-semibold tracking-tight">
              {title}
            </CardTitle>
            {subtitle ? <CardDescription>{subtitle}</CardDescription> : null}
          </div>
          {actions ? <div className="shrink-0">{actions}</div> : null}
        </CardHeader>
        <CardContent className="border-t bg-muted/30 px-4 py-3 sm:px-5">
          <ParametresSectionNav
            organizationId={organizationId}
            branchId={branchId}
            active={active}
          />
        </CardContent>
      </Card>
      {children}
    </div>
  );
}

export function ParametresPanel({
  title,
  description,
  icon: Icon,
  actions,
  children,
  className,
  bodyClassName,
}: {
  title?: ReactNode;
  description?: string;
  icon?: LucideIcon;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <Card className={cn("gap-0 py-0 shadow-sm", className)}>
      {title ? (
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 border-b bg-muted/30 py-4">
          <div className="flex min-w-0 items-start gap-2.5">
            {Icon ? (
              <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                <Icon className="size-4" />
              </span>
            ) : null}
            <div className="min-w-0">
              <CardTitle>{title}</CardTitle>
              {description ? (
                <CardDescription>{description}</CardDescription>
              ) : null}
            </div>
          </div>
          {actions ? <div className="shrink-0">{actions}</div> : null}
        </CardHeader>
      ) : null}
      <CardContent className={cn("py-4", bodyClassName)}>{children}</CardContent>
    </Card>
  );
}

type ParametresSectionNavProps = {
  organizationId: string;
  branchId: string;
  active: "roles" | "users" | "taux" | "apparence";
};

export function ParametresSectionNav({
  organizationId,
  branchId,
  active,
}: ParametresSectionNavProps) {
  const items = [
    {
      id: "roles" as const,
      href: sharedBranchRoutes.parametres(organizationId, branchId),
      label: "Rôles",
      icon: Shield,
    },
    {
      id: "users" as const,
      href: sharedBranchRoutes.parametresUsers(organizationId, branchId),
      label: "Utilisateurs",
      icon: Users,
    },
    {
      id: "taux" as const,
      href: sharedBranchRoutes.tauxChange(organizationId, branchId),
      label: "Taux de change",
      icon: ArrowLeftRight,
    },
    {
      id: "apparence" as const,
      href: sharedBranchRoutes.parametresApparence(organizationId, branchId),
      label: "Apparence",
      icon: Palette,
    },
  ];

  return (
    <nav
      className="flex flex-wrap gap-1 rounded-xl bg-background p-1 ring-1 ring-border"
      aria-label="Paramètres"
    >
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = active === item.id;
        return (
          <Link
            key={item.id}
            href={item.href}
            className={cn(
              "inline-flex h-9 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-medium transition sm:flex-none",
              isActive
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
            aria-current={isActive ? "page" : undefined}
          >
            <Icon className="size-3.5" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function segmentedTabClass(active: boolean) {
  return cn(
    "inline-flex items-center justify-center rounded-lg px-3 py-1.5 text-sm font-medium transition",
    active
      ? "bg-primary text-primary-foreground shadow-sm"
      : "text-muted-foreground hover:bg-background/80 hover:text-foreground",
  );
}

export function choiceBtnClass(active: boolean) {
  return cn(
    "rounded-lg border px-3 py-2 text-sm font-medium transition",
    active
      ? "border-primary bg-primary text-primary-foreground shadow-sm"
      : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground",
  );
}
