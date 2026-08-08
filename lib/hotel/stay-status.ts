import type { HotelStayStatus } from "@/prisma/generated/prisma/client";

export const HOTEL_STAY_STATUSES = [
  "BOOKED",
  "IN_HOUSE",
  "CHECKED_OUT",
  "CANCELLED",
] as const satisfies ReadonlyArray<HotelStayStatus>;

export type HotelStayStatusValue = (typeof HOTEL_STAY_STATUSES)[number];

export const HOTEL_STAY_STATUS_LABELS: Record<HotelStayStatusValue, string> = {
  BOOKED: "Réservé",
  IN_HOUSE: "En maison",
  CHECKED_OUT: "Parti",
  CANCELLED: "Annulé",
};

export const HOTEL_STAY_STATUS_BADGE_CLASS: Record<HotelStayStatusValue, string> = {
  BOOKED: "border-transparent bg-primary/15 text-primary",
  IN_HOUSE: "border-transparent bg-success/20 text-emerald-800 dark:text-emerald-200",
  CHECKED_OUT: "border-transparent bg-muted text-muted-foreground",
  CANCELLED: "border-transparent bg-muted text-muted-foreground",
};

export type StayListFilter = "upcoming" | "in-house" | "checked-out";

export const STAY_LIST_FILTER_STATUSES: Record<
  StayListFilter,
  HotelStayStatusValue
> = {
  upcoming: "BOOKED",
  "in-house": "IN_HOUSE",
  "checked-out": "CHECKED_OUT",
};

export function isHotelStayStatus(value: string): value is HotelStayStatusValue {
  return (HOTEL_STAY_STATUSES as readonly string[]).includes(value);
}

export function isStayListFilter(value: string): value is StayListFilter {
  return value === "upcoming" || value === "in-house" || value === "checked-out";
}

export function guestDisplayName(prenom: string, nom: string): string {
  return `${prenom.trim()} ${nom.trim()}`.trim();
}
