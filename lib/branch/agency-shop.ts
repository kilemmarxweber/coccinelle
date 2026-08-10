/**
 * Sous-modules Agence (transport) et Boutique (verticales).
 * Même logique que l’hospitalité : au moins un choix à la création.
 */

export type AgencyTransportMode = "AVION" | "BUS" | "BATEAU";
export type ShopVertical = "PHARMACIE" | "BOUTIQUE" | "ALIMENTATION";

export type AgencyFlags = {
  hasAvion: boolean;
  hasBus: boolean;
  hasBateau: boolean;
};

export type ShopFlags = {
  hasPharmacie: boolean;
  hasShop: boolean;
  hasAlimentation: boolean;
};

export function deriveAgencyFlags(flags: AgencyFlags): AgencyFlags {
  if (!flags.hasAvion && !flags.hasBus && !flags.hasBateau) {
    throw new Error("Choisissez au moins Avion, Bus ou Bateau.");
  }
  return {
    hasAvion: flags.hasAvion,
    hasBus: flags.hasBus,
    hasBateau: flags.hasBateau,
  };
}

export function deriveShopFlags(flags: ShopFlags): ShopFlags {
  if (!flags.hasPharmacie && !flags.hasShop && !flags.hasAlimentation) {
    throw new Error("Choisissez au moins Pharmacie, Boutique ou Alimentation.");
  }
  return {
    hasPharmacie: flags.hasPharmacie,
    hasShop: flags.hasShop,
    hasAlimentation: flags.hasAlimentation,
  };
}

export function agencyModesList(flags: AgencyFlags): AgencyTransportMode[] {
  const out: AgencyTransportMode[] = [];
  if (flags.hasAvion) out.push("AVION");
  if (flags.hasBus) out.push("BUS");
  if (flags.hasBateau) out.push("BATEAU");
  return out;
}

export function shopVerticalsList(flags: ShopFlags): ShopVertical[] {
  const out: ShopVertical[] = [];
  if (flags.hasPharmacie) out.push("PHARMACIE");
  if (flags.hasShop) out.push("BOUTIQUE");
  if (flags.hasAlimentation) out.push("ALIMENTATION");
  return out;
}

export function agencyModesLabel(flags: AgencyFlags): string {
  const labels: string[] = [];
  if (flags.hasAvion) labels.push("Avion");
  if (flags.hasBus) labels.push("Bus");
  if (flags.hasBateau) labels.push("Bateau");
  return labels.join(" · ") || "Agence";
}

export function shopVerticalsLabel(flags: ShopFlags): string {
  const labels: string[] = [];
  if (flags.hasPharmacie) labels.push("Pharmacie");
  if (flags.hasShop) labels.push("Boutique");
  if (flags.hasAlimentation) labels.push("Alimentation");
  return labels.join(" · ") || "Boutique";
}

export function modeTransportLabel(mode: string): string {
  if (mode === "AVION") return "Avion";
  if (mode === "BUS") return "Bus";
  if (mode === "BATEAU") return "Bateau";
  return mode;
}

export function branchAllowsMode(
  flags: AgencyFlags,
  mode: AgencyTransportMode | string,
): boolean {
  if (mode === "AVION") return flags.hasAvion;
  if (mode === "BUS") return flags.hasBus;
  if (mode === "BATEAU") return flags.hasBateau;
  return false;
}
