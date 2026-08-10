import { HOTEL_CHECKOUT_HOUR } from "@/lib/hotel/constants";

function startOfUtcDay(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function parseDateOnly(value: string | Date) {
  if (value instanceof Date) return startOfUtcDay(value);
  const [y, m, day] = value.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y!, (m ?? 1) - 1, day ?? 1));
}

function addUtcDays(d: Date, days: number) {
  const next = new Date(d);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

/** Nuitées entre deux dates calendaires (min. 1). */
export function nightsBetween(checkIn: Date, checkOut: Date) {
  const a = parseDateOnly(checkIn);
  const b = parseDateOnly(checkOut);
  const ms = b.getTime() - a.getTime();
  return Math.max(1, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

export type StayNightBilling = {
  /** Nuitées à facturer (jours consommés + règle 10h). */
  nights: number;
  plannedNights: number;
  /** Date de sortie effective (date-only UTC). */
  effectiveCheckOutDate: Date;
  plannedCheckOutDate: Date;
  checkInDate: Date;
  /** true si l’heure locale ≥ heure limite checkout. */
  pastCheckoutHour: boolean;
  earlyDeparture: boolean;
  lateDeparture: boolean;
  checkoutHour: number;
};

/**
 * Calcule les nuitées consommées au moment du check-out.
 *
 * Règle heure (locale) :
 * - avant `checkoutHour` (10h) : le jour courant = jour de sortie (pas de nuitée du jour)
 * - à partir de `checkoutHour` : encore présent → +1 jour / nuitée jusqu’à demain
 */
export function computeStayNightBilling(input: {
  checkInDate: string | Date;
  plannedCheckOutDate: string | Date;
  now?: Date;
  checkoutHour?: number;
}): StayNightBilling {
  const now = input.now ?? new Date();
  const checkoutHour = input.checkoutHour ?? HOTEL_CHECKOUT_HOUR;
  const checkInDate = parseDateOnly(input.checkInDate);
  const plannedCheckOutDate = parseDateOnly(input.plannedCheckOutDate);

  const localToday = new Date(
    Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()),
  );
  const pastCheckoutHour = now.getHours() >= checkoutHour;
  const effectiveCheckOutDate = pastCheckoutHour
    ? addUtcDays(localToday, 1)
    : localToday;

  const nights = nightsBetween(checkInDate, effectiveCheckOutDate);
  const plannedNights = nightsBetween(checkInDate, plannedCheckOutDate);

  return {
    nights,
    plannedNights,
    effectiveCheckOutDate,
    plannedCheckOutDate,
    checkInDate,
    pastCheckoutHour,
    earlyDeparture: effectiveCheckOutDate.getTime() < plannedCheckOutDate.getTime(),
    lateDeparture: effectiveCheckOutDate.getTime() > plannedCheckOutDate.getTime(),
    checkoutHour,
  };
}

export function nightChargeDescription(input: {
  nights: number;
  roomNumber: string;
  roomTypeName: string;
  billing: StayNightBilling;
}) {
  const base = `${input.nights} nuit(s) consommée(s) · ${input.roomTypeName} ${input.roomNumber}`;
  if (input.billing.lateDeparture) {
    return `${base} · sortie après ${input.billing.checkoutHour}h (+ retard)`;
  }
  if (input.billing.earlyDeparture) {
    return `${base} · départ anticipé`;
  }
  return base;
}
