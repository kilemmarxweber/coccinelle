import type { HotelFoodOrderStatus } from "@/prisma/generated/prisma/client";

export const HOTEL_FOOD_ORDER_STATUSES = [
  "NEW",
  "PREPARING",
  "READY",
  "SERVED",
] as const satisfies ReadonlyArray<HotelFoodOrderStatus>;

export type HotelFoodOrderStatusValue =
  (typeof HOTEL_FOOD_ORDER_STATUSES)[number];

export const HOTEL_FOOD_ORDER_STATUS_LABELS: Record<
  HotelFoodOrderStatusValue,
  string
> = {
  NEW: "Nouvelle",
  PREPARING: "En préparation",
  READY: "Prête",
  SERVED: "Servie",
};

export const HOTEL_FOOD_ORDER_STATUS_BADGE_CLASS: Record<
  HotelFoodOrderStatusValue,
  string
> = {
  NEW: "border-transparent bg-primary/15 text-primary",
  PREPARING: "border-transparent bg-warning/20 text-amber-900 dark:text-amber-100",
  READY: "border-transparent bg-success/20 text-emerald-800 dark:text-emerald-200",
  SERVED: "border-transparent bg-muted text-muted-foreground",
};

/** Next status in the kitchen queue, or null when already served. */
export const HOTEL_FOOD_ORDER_NEXT_STATUS: Record<
  HotelFoodOrderStatusValue,
  HotelFoodOrderStatusValue | null
> = {
  NEW: "PREPARING",
  PREPARING: "READY",
  READY: "SERVED",
  SERVED: null,
};

export const HOTEL_FOOD_ORDER_PRIMARY_ACTION_LABEL: Record<
  Exclude<HotelFoodOrderStatusValue, "SERVED">,
  string
> = {
  NEW: "Mettre en préparation",
  PREPARING: "Marquer prête",
  READY: "Marquer servie",
};

export function isHotelFoodOrderStatus(
  value: string,
): value is HotelFoodOrderStatusValue {
  return (HOTEL_FOOD_ORDER_STATUSES as readonly string[]).includes(value);
}

export function nextFoodOrderStatus(
  status: HotelFoodOrderStatusValue,
): HotelFoodOrderStatusValue | null {
  return HOTEL_FOOD_ORDER_NEXT_STATUS[status];
}
