import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type StatusBadgeTone =
  | "pending"
  | "info"
  | "success"
  | "danger"
  | "muted";

/** Tons soft (fond /15) lisibles en light et dark — tokens thème quand dispo. */
const toneClass: Record<StatusBadgeTone, string> = {
  pending:
    "border-transparent bg-warning/15 text-warning-foreground dark:text-warning",
  info: "border-transparent bg-chart-4/15 text-chart-4",
  success: "border-transparent bg-success/15 text-success",
  danger: "border-transparent bg-destructive/15 text-destructive",
  muted: "border-transparent bg-muted text-muted-foreground",
};

export type StatusBadgeProps = {
  tone?: StatusBadgeTone;
  children: ReactNode;
  className?: string;
};

/** Badge de statut lisible en light et dark. */
export function StatusBadge({
  tone = "muted",
  children,
  className,
}: StatusBadgeProps) {
  return (
    <Badge variant="secondary" className={cn(toneClass[tone], className)}>
      {children}
    </Badge>
  );
}
