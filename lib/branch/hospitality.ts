/**
 * Modules hospitalité (HOTEL / RESTAURANT) — flags hasStays / hasRestaurant.
 * @see context/plan-hospitalite-modules-hotel-restaurant.md
 */

export type HospitalityModule = "stays" | "restaurant" | "livraison";

export type BranchTypeLike = string;

export type HospitalityFlags = {
  type: BranchTypeLike;
  hasStays: boolean;
  hasRestaurant: boolean;
};

export function isHospitality(type: BranchTypeLike): boolean {
  return type === "HOTEL" || type === "RESTAURANT";
}

export function canAccessStays(branch: HospitalityFlags): boolean {
  return isHospitality(branch.type) && branch.hasStays;
}

export function canAccessRestaurant(branch: HospitalityFlags): boolean {
  return isHospitality(branch.type) && branch.hasRestaurant;
}

/** Livraison stock : commune hébergement et/ou resto. */
export function canAccessLivraison(branch: HospitalityFlags): boolean {
  return (
    isHospitality(branch.type) && (branch.hasStays || branch.hasRestaurant)
  );
}

export function branchTypeLabel(type: BranchTypeLike): string {
  if (type === "AGENCE") return "Agence";
  if (type === "HOTEL") return "Hôtel";
  if (type === "BOUTIQUE") return "Boutique";
  if (type === "RESTAURANT") return "Restaurant";
  if (type === "USINE") return "Usine";
  return type;
}

/** Libellé détaillé (modules) pour navbar / listes. */
export function branchTypeDetailLabel(branch: {
  type: BranchTypeLike;
  hasStays?: boolean;
  hasRestaurant?: boolean;
  hasAvion?: boolean;
  hasBus?: boolean;
  hasBateau?: boolean;
  hasPharmacie?: boolean;
  hasShop?: boolean;
  hasAlimentation?: boolean;
  hasEau?: boolean;
  hasVin?: boolean;
}): string {
  const base = branchTypeLabel(branch.type);
  if (branch.type === "HOTEL" || branch.type === "RESTAURANT") {
    const parts: string[] = [];
    if (branch.hasStays) parts.push("Séjours");
    if (branch.hasRestaurant) parts.push("Restaurant");
    return parts.length ? `${base} · ${parts.join(" · ")}` : base;
  }
  if (branch.type === "AGENCE") {
    const parts: string[] = [];
    if (branch.hasAvion) parts.push("Avion");
    if (branch.hasBus) parts.push("Bus");
    if (branch.hasBateau) parts.push("Bateau");
    return parts.length ? `${base} · ${parts.join(" · ")}` : base;
  }
  if (branch.type === "BOUTIQUE") {
    const parts: string[] = [];
    if (branch.hasPharmacie) parts.push("Pharmacie");
    if (branch.hasShop) parts.push("Boutique");
    if (branch.hasAlimentation) parts.push("Alimentation");
    return parts.length ? parts.join(" · ") : base;
  }
  if (branch.type === "USINE") {
    return base;
  }
  return base;
}

/** Dérive BranchType Prisma + flags à la création. */
export function deriveHospitalityBranch(
  hasStays: boolean,
  hasRestaurant: boolean,
): {
  type: "HOTEL" | "RESTAURANT";
  hasStays: boolean;
  hasRestaurant: boolean;
} {
  if (!hasStays && !hasRestaurant) {
    throw new Error("Choisissez au moins Séjours ou Restaurant.");
  }
  if (!hasStays && hasRestaurant) {
    return { type: "RESTAURANT", hasStays: false, hasRestaurant: true };
  }
  return { type: "HOTEL", hasStays: true, hasRestaurant };
}

export function assertHospitalityModule(
  branch: HospitalityFlags,
  module: HospitalityModule,
): void {
  if (module === "stays" && !canAccessStays(branch)) {
    throw new Error("Module Séjours non activé sur cette branche.");
  }
  if (module === "restaurant" && !canAccessRestaurant(branch)) {
    throw new Error("Module Restaurant non activé sur cette branche.");
  }
  if (module === "livraison" && !canAccessLivraison(branch)) {
    throw new Error("Livraison non disponible sur cette branche.");
  }
}
