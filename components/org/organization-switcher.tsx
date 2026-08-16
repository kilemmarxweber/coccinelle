"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Building2, Check } from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type OrgRow = {
  id: string;
  name: string;
  slug: string;
};

/**
 * Sélecteur d’organisation active — un user multi-org ne voit
 * que les données de l’org sélectionnée.
 */
export function OrganizationSwitcher({
  className,
}: {
  className?: string;
}) {
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const { data: orgsData, refetch } = authClient.useListOrganizations();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  const orgs = (Array.isArray(orgsData) ? orgsData : []) as OrgRow[];
  const activeId =
    (session as { organization?: { id?: string } } | null)?.organization?.id ??
    session?.session?.activeOrganizationId ??
    null;
  const active = orgs.find((o) => o.id === activeId) ?? orgs[0] ?? null;

  useEffect(() => {
    void refetch?.();
  }, [refetch]);

  if (orgs.length <= 1) {
    return active ? (
      <div
        className={cn(
          "flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm",
          className,
        )}
      >
        <Building2 className="size-4 shrink-0 text-muted-foreground" />
        <span className="truncate font-medium">{active.name}</span>
      </div>
    ) : null;
  }

  function switchTo(orgId: string) {
    if (orgId === activeId) {
      setOpen(false);
      return;
    }
    startTransition(async () => {
      const { error } = await authClient.organization.setActive({
        organizationId: orgId,
      });
      if (error) {
        toast.error(error.message ?? "Impossible de changer d’organisation.");
        return;
      }
      toast.success("Organisation active mise à jour.");
      setOpen(false);
      router.push(`/admin/organizations/${orgId}/branches`);
      router.refresh();
    });
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            className={cn("h-10 max-w-[240px] justify-start gap-2", className)}
            disabled={pending}
          />
        }
      >
        <Building2 className="size-4 shrink-0" />
        <span className="truncate">{active?.name ?? "Organisation"}</span>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-1">
        <p className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
          Organisation active
        </p>
        {orgs.map((org) => {
          const isActive = org.id === (activeId ?? active?.id);
          return (
            <button
              key={org.id}
              type="button"
              disabled={pending}
              onClick={() => switchTo(org.id)}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-muted",
                isActive && "bg-primary/10",
              )}
            >
              <span className="min-w-0 flex-1 truncate font-medium">
                {org.name}
              </span>
              {isActive ? <Check className="size-4 shrink-0 text-primary" /> : null}
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}
