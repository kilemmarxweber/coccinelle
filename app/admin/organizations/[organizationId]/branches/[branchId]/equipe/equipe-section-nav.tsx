"use client";

import Link from "next/link";
import { Shield, Users } from "lucide-react";
import { sharedBranchRoutes } from "@/lib/branch/paths";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

type EquipeSectionNavProps = {
  organizationId: string;
  branchId: string;
  active: "personnel" | "roles";
};

export function EquipeSectionNav({
  organizationId,
  branchId,
  active,
}: EquipeSectionNavProps) {
  const personnelHref = sharedBranchRoutes.equipe(organizationId, branchId);
  const rolesHref = sharedBranchRoutes.equipeRoles(organizationId, branchId);

  return (
    <nav
      className="flex flex-wrap gap-2"
      aria-label="Section équipe"
    >
      <Link
        href={personnelHref}
        className={cn(
          buttonVariants({
            variant: active === "personnel" ? "default" : "outline",
            size: "sm",
          }),
          "h-10 touch-manipulation",
        )}
        aria-current={active === "personnel" ? "page" : undefined}
      >
        <Users data-icon="inline-start" />
        Personnel
      </Link>
      <Link
        href={rolesHref}
        className={cn(
          buttonVariants({
            variant: active === "roles" ? "default" : "outline",
            size: "sm",
          }),
          "h-10 touch-manipulation",
        )}
        aria-current={active === "roles" ? "page" : undefined}
      >
        <Shield data-icon="inline-start" />
        Rôles
      </Link>
    </nav>
  );
}
