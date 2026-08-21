export const WAREHOUSE_PRODUCT_TYPES = ["BOUTIQUE", "DIVERS"] as const;

export type WarehouseProductTypeCode = (typeof WAREHOUSE_PRODUCT_TYPES)[number];

export const WAREHOUSE_DESTINATIONS = ["BOUTIQUE"] as const;

export type WarehouseDestinationCode = (typeof WAREHOUSE_DESTINATIONS)[number];

export const WAREHOUSE_LOCATION_ZONES = ["STOCK", "BOUTIQUE"] as const;

export type WarehouseLocationZoneCode = (typeof WAREHOUSE_LOCATION_ZONES)[number];

/** Catégories métier par type — seed initial, puis CRUD. */
export const DEFAULT_WAREHOUSE_CATEGORIES: Record<
  WarehouseProductTypeCode,
  string[]
> = {
  BOUTIQUE: ["Alimentaire", "Hygiène", "Boissons", "Divers"],
  DIVERS: ["Divers"],
};

/** Emplacements de départ pour picking / livraison POS. */
export const DEFAULT_WAREHOUSE_LOCATIONS: {
  zone: WarehouseLocationZoneCode;
  floor: string;
  code: string;
  label: string;
}[] = [
  { zone: "STOCK", floor: "RDC", code: "A-01", label: "Réserve principale A" },
  { zone: "STOCK", floor: "RDC", code: "A-02", label: "Réserve principale B" },
  { zone: "STOCK", floor: "1", code: "B-01", label: "Étage 1 — allée B" },
  { zone: "BOUTIQUE", floor: "RDC", code: "POS-01", label: "Rayon / comptoir POS" },
  { zone: "BOUTIQUE", floor: "RDC", code: "POS-FRIGO", label: "Frigo boutique" },
];

export function warehouseProductTypeLabel(t: string) {
  switch (t) {
    case "BOUTIQUE":
      return "Boutique";
    default:
      return "Divers";
  }
}

export function warehouseLocationZoneLabel(z: string) {
  switch (z) {
    case "STOCK":
      return "Stock principal";
    case "BOUTIQUE":
      return "Stock auxiliaire (POS)";
    default:
      return z;
  }
}

export function warehouseDestinationLabel(d: string | null | undefined) {
  switch (d) {
    case "BOUTIQUE":
      return "Boutique / POS";
    case "FOURNISSEUR":
      return "Fournisseur";
    default:
      return "—";
  }
}

export function warehouseSlipKindLabel(k: string) {
  return k === "COMMANDE" ? "Bon de commande" : "Bon de sortie";
}

export function warehouseSlipStatusLabel(s: string) {
  switch (s) {
    case "BROUILLON":
      return "Brouillon";
    case "ENVOYE":
      return "Envoyé — à réceptionner";
    case "VALIDE":
      return "Validé";
    case "RECU":
      return "Reçu & signé";
    case "ANNULE":
      return "Annulé";
    default:
      return s;
  }
}

export function formatWarehouseLocation(loc: {
  zone: string;
  floor: string;
  code: string;
  label?: string | null;
} | null | undefined) {
  if (!loc) return "—";
  const base = `${warehouseLocationZoneLabel(loc.zone)} · Étage ${loc.floor} · ${loc.code}`;
  return loc.label ? `${base} (${loc.label})` : base;
}

/** Chemin de livraison : picking → dépôt point de vente. */
export function formatDeliveryPath(
  from: Parameters<typeof formatWarehouseLocation>[0],
  to: Parameters<typeof formatWarehouseLocation>[0],
) {
  return `${formatWarehouseLocation(from)} → ${formatWarehouseLocation(to)}`;
}

export function stockLevel(
  stockQty: number,
  minQty: number,
): "ok" | "low" | "out" {
  if (stockQty <= 0) return "out";
  if (stockQty <= minQty) return "low";
  return "ok";
}

export function slugSku(name: string) {
  const base = name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 24);
  return base || "SKU";
}

/** Zone de destination liée au type produit. */
export function zoneForProductType(
  type: WarehouseProductTypeCode,
): WarehouseLocationZoneCode {
  if (type === "BOUTIQUE") return "BOUTIQUE";
  return "STOCK";
}
