/** Types de produits F&B hôtel — alignés sur le catalogue seed. */
export const HOTEL_MENU_CATEGORIES = [
  "Petit-déj",
  "Plats",
  "Boissons",
  "Desserts",
  "Divers",
  "Consommables",
] as const;

export type HotelMenuCategory = (typeof HOTEL_MENU_CATEGORIES)[number];

export const CONSUMABLE_CATEGORY = "Consommables" as const;

export function isConsumableCategory(category: string) {
  return category.trim().toLowerCase() === "consommables";
}

/** Cuisine par défaut selon le type (modifiable ensuite). */
export function defaultNeedsKitchen(category: string): boolean {
  const c = category.trim().toLowerCase();
  if (c === "boissons" || c === "consommables") return false;
  return true;
}

export function isHotelMenuCategory(value: string): value is HotelMenuCategory {
  return (HOTEL_MENU_CATEGORIES as readonly string[]).includes(value);
}

export const STOCK_LOW_THRESHOLD = 5;
