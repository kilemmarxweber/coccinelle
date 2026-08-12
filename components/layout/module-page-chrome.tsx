import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { branchDashboardPath } from "@/lib/branch/paths";
import { cn } from "@/lib/utils";

export type ModulePageChromeProps = {
  organizationId: string;
  branchId: string;
  title: string;
  subtitle?: string;
  /** Lien retour (défaut : hub branche). */
  backHref?: string;
  backLabel?: string;
  actions?: ReactNode;
  /** Layout only (ex. marges) — le `mx-auto max-w-*` reste au parent. */
  className?: string;
  children?: ReactNode;
};

/**
 * En-tête de module sous `DashboardNavbar` — non sticky (évite le double header).
 */
export function ModulePageChrome({
  organizationId,
  branchId,
  title,
  subtitle,
  backHref,
  backLabel = "Dashboard",
  actions,
  className,
  children,
}: ModulePageChromeProps) {
  const href = backHref ?? branchDashboardPath(organizationId, branchId);

  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between",
        className,
      )}
    >
      <div className="flex min-w-0 flex-col gap-2">
        <Button
          variant="ghost"
          size="xs"
          className="-ml-1.5 self-start text-muted-foreground"
          render={<Link href={href} />}
        >
          <ArrowLeft data-icon="inline-start" aria-hidden />
          {backLabel}
        </Button>
        <div className="flex min-w-0 flex-col gap-0.5">
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          {subtitle ? (
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
        {children}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}
