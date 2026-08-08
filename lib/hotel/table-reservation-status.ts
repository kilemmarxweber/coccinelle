import type { HotelTableReservationStatus } from "@/prisma/generated/prisma/client";

export const HOTEL_TABLE_RESERVATION_STATUSES = [
  "CONFIRMED",
  "CANCELLED",
  "COMPLETED",
  "NO_SHOW",
] as const satisfies ReadonlyArray<HotelTableReservationStatus>;

export type HotelTableReservationStatusValue =
  (typeof HOTEL_TABLE_RESERVATION_STATUSES)[number];

export const HOTEL_TABLE_RESERVATION_STATUS_LABELS: Record<
  HotelTableReservationStatusValue,
  string
> = {
  CONFIRMED: "Confirmée",
  CANCELLED: "Annulée",
  COMPLETED: "Terminée",
  NO_SHOW: "No-show",
};

export const HOTEL_TABLE_RESERVATION_STATUS_BADGE_CLASS: Record<
  HotelTableReservationStatusValue,
  string
> = {
  CONFIRMED: "border-transparent bg-success/20 text-emerald-800 dark:text-emerald-200",
  CANCELLED: "border-transparent bg-muted text-muted-foreground",
  COMPLETED: "border-transparent bg-primary/15 text-primary",
  NO_SHOW: "border-transparent bg-warning/20 text-amber-900 dark:text-amber-100",
};

export function isHotelTableReservationStatus(
  value: string,
): value is HotelTableReservationStatusValue {
  return (HOTEL_TABLE_RESERVATION_STATUSES as readonly string[]).includes(
    value,
  );
}

/** Durée d’occupation d’une table (minutes) pour chevauchement. */
export const TABLE_RESERVATION_SLOT_MINUTES = 90;

export function tableReservationSlotEnd(startsAt: Date): Date {
  return new Date(
    startsAt.getTime() + TABLE_RESERVATION_SLOT_MINUTES * 60 * 1000,
  );
}
