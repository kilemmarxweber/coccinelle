import type { HotelRestaurantTableStatus } from "@/prisma/generated/prisma/client";

export const HOTEL_RESTAURANT_TABLE_STATUSES = [
  "FREE",
  "OCCUPIED",
  "RESERVED",
  "OUT_OF_SERVICE",
] as const satisfies ReadonlyArray<HotelRestaurantTableStatus>;

export type HotelRestaurantTableStatusValue =
  (typeof HOTEL_RESTAURANT_TABLE_STATUSES)[number];

export const HOTEL_RESTAURANT_TABLE_STATUS_LABELS: Record<
  HotelRestaurantTableStatusValue,
  string
> = {
  FREE: "Libre",
  OCCUPIED: "Occupée",
  RESERVED: "Réservée",
  OUT_OF_SERVICE: "Hors service",
};

export const HOTEL_RESTAURANT_TABLE_STATUS_BADGE_CLASS: Record<
  HotelRestaurantTableStatusValue,
  string
> = {
  FREE: "border-transparent bg-success/20 text-emerald-800 dark:text-emerald-200",
  OCCUPIED: "border-transparent bg-primary/15 text-primary",
  RESERVED: "border-transparent bg-warning/20 text-amber-900 dark:text-amber-100",
  OUT_OF_SERVICE: "border-transparent bg-muted text-muted-foreground",
};

export function isHotelRestaurantTableStatus(
  value: string,
): value is HotelRestaurantTableStatusValue {
  return (HOTEL_RESTAURANT_TABLE_STATUSES as readonly string[]).includes(value);
}
