import type { HotelRoomStatus } from "@/prisma/generated/prisma/client";

export const HOTEL_ROOM_STATUSES = [
  "AVAILABLE",
  "CLEANING",
  "OCCUPIED",
  "OUT_OF_ORDER",
] as const satisfies ReadonlyArray<HotelRoomStatus>;

export type HotelRoomStatusValue = (typeof HOTEL_ROOM_STATUSES)[number];

export const HOTEL_ROOM_STATUS_LABELS: Record<HotelRoomStatusValue, string> = {
  AVAILABLE: "Libre · Prête",
  CLEANING: "Libre · Sale",
  OCCUPIED: "Occupée",
  OUT_OF_ORDER: "Hors service",
};

/** Badge visual cue classes (text label always shown alongside). */
export const HOTEL_ROOM_STATUS_BADGE_CLASS: Record<HotelRoomStatusValue, string> = {
  AVAILABLE: "border-transparent bg-success/20 text-emerald-800 dark:text-emerald-200",
  CLEANING: "border-transparent bg-warning/25 text-warning-foreground",
  OCCUPIED: "border-transparent bg-primary/15 text-primary",
  OUT_OF_ORDER: "border-transparent bg-muted text-muted-foreground",
};

export function isHotelRoomStatus(value: string): value is HotelRoomStatusValue {
  return (HOTEL_ROOM_STATUSES as readonly string[]).includes(value);
}
