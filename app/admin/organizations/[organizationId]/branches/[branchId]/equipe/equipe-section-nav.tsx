"use client";

import { ParametresSectionNav } from "../parametres/parametres-section-nav";

type EquipeSectionNavProps = {
  organizationId: string;
  branchId: string;
  active: "personnel" | "roles";
};

/** Conservé pour les écrans org encore branchés — redirige vers Paramètres. */
export function EquipeSectionNav({
  organizationId,
  branchId,
  active,
}: EquipeSectionNavProps) {
  return (
    <ParametresSectionNav
      organizationId={organizationId}
      branchId={branchId}
      active={active === "personnel" ? "users" : "roles"}
    />
  );
}
