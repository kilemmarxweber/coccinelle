/** Helpers tarif séjour négociable / forfait. */

export const STAY_BILLING = {
  NIGHTLY: "NIGHTLY",
  FLAT: "FLAT",
} as const;

export type StayBillingMode =
  (typeof STAY_BILLING)[keyof typeof STAY_BILLING];

export function resolveStayUnitPrice(stay: {
  catalogUnitPrice: number;
  unitPriceApplied?: number | null;
}) {
  if (stay.unitPriceApplied != null && stay.unitPriceApplied >= 0) {
    return stay.unitPriceApplied;
  }
  return stay.catalogUnitPrice;
}

export function isNegotiatedNightRate(stay: {
  catalogUnitPrice: number;
  unitPriceApplied?: number | null;
}) {
  if (stay.unitPriceApplied == null) return false;
  return Math.abs(stay.unitPriceApplied - stay.catalogUnitPrice) >= 0.01;
}

export function negotiationDiscountPct(catalog: number, applied: number) {
  if (!(catalog > 0)) return 0;
  return Math.round(((catalog - applied) / catalog) * 1000) / 10;
}

export function flatStayDescription(input: {
  roomNumber: string;
  roomTypeName: string;
  flatAmount: number;
  plannedHours?: number | null;
  rateNote?: string | null;
  prolongation?: boolean;
}) {
  const hours =
    input.plannedHours != null && input.plannedHours > 0
      ? ` · ${input.plannedHours} h`
      : "";
  const note = input.rateNote?.trim() ? ` · ${input.rateNote.trim()}` : "";
  const prefix = input.prolongation ? "Prolongation forfait" : "Forfait séjour";
  return `${prefix}${hours} · ${input.roomTypeName} ${input.roomNumber}${note}`;
}

/** Tarif horaire implicite du forfait (montant / heures prévues). */
export function flatHourlyRate(flatAmount: number, plannedHours: number) {
  if (!(plannedHours > 0) || !(flatAmount >= 0)) return 0;
  return Math.round((flatAmount / plannedHours) * 100) / 100;
}

export type FlatOvertimeBilling = {
  plannedHours: number;
  slots: number;
  allowedMinutes: number;
  elapsedMinutes: number;
  overdueMinutes: number;
  /** Heures supplémentaires facturées (arrondi à l’heure commencée). */
  extraHours: number;
  hourlyRate: number;
  amount: number;
};

/**
 * Si le forfait (ex. 4 h) est dépassé, facture les heures entamées au prorata
 * `flatAmount / plannedHours`.
 */
export function computeFlatOvertimeBilling(input: {
  plannedHours: number | null | undefined;
  flatAmount: number | null | undefined;
  checkedInAt: string | Date | null | undefined;
  /** Créneaux forfait (1 + prolongations), hors heures supp. */
  slots?: number | null;
  /** Instant de fin (check-out) ; défaut = maintenant. */
  endedAt?: string | Date | null;
}): FlatOvertimeBilling | null {
  const hours = input.plannedHours;
  const flatAmount = input.flatAmount;
  const startedAt = input.checkedInAt;
  const slots = Math.max(1, Math.round(input.slots ?? 1));
  if (
    hours == null ||
    !(hours > 0) ||
    flatAmount == null ||
    !(flatAmount >= 0) ||
    !startedAt
  ) {
    return null;
  }

  const started = new Date(startedAt).getTime();
  const ended = input.endedAt
    ? new Date(input.endedAt).getTime()
    : Date.now();
  if (!Number.isFinite(started) || !Number.isFinite(ended) || ended < started) {
    return null;
  }

  const allowedMinutes = hours * 60 * slots;
  const elapsedMinutes = Math.max(0, (ended - started) / 60_000);
  const overdueMinutes = Math.max(0, elapsedMinutes - allowedMinutes);
  const extraHours =
    overdueMinutes > 0 ? Math.ceil(overdueMinutes / 60 - 1e-9) : 0;
  const hourlyRate = flatHourlyRate(flatAmount, hours);
  const amount =
    extraHours > 0
      ? Math.round(extraHours * hourlyRate * 100) / 100
      : 0;

  return {
    plannedHours: hours,
    slots,
    allowedMinutes,
    elapsedMinutes,
    overdueMinutes,
    extraHours,
    hourlyRate,
    amount,
  };
}

export function flatOvertimeDescription(input: {
  roomNumber: string;
  roomTypeName: string;
  extraHours: number;
  hourlyRate: number;
  overdueMinutes?: number;
}) {
  const mins =
    input.overdueMinutes != null && input.overdueMinutes > 0
      ? ` · dépassement ${Math.ceil(input.overdueMinutes)} min`
      : "";
  return `Heures supplémentaires · ${input.extraHours} h × ${input.hourlyRate.toFixed(2)} $ · ${input.roomTypeName} ${input.roomNumber}${mins}`;
}

export function nightlyStayDescription(input: {
  nights: number;
  roomNumber: string;
  roomTypeName: string;
  negotiated?: boolean;
  catalogUnitPrice?: number;
  unitPriceApplied?: number;
  rateNote?: string | null;
  suffix?: string;
}) {
  let base = `${input.nights} nuit(s) · ${input.roomTypeName} ${input.roomNumber}`;
  if (input.negotiated && input.unitPriceApplied != null) {
    const pct =
      input.catalogUnitPrice != null
        ? negotiationDiscountPct(input.catalogUnitPrice, input.unitPriceApplied)
        : 0;
    base += ` · tarif négocié ${input.unitPriceApplied.toFixed(2)} $`;
    if (pct > 0) base += ` (−${pct} %)`;
  }
  if (input.suffix) base += ` · ${input.suffix}`;
  if (input.rateNote?.trim() && input.negotiated) {
    base += ` · ${input.rateNote.trim()}`;
  }
  return base;
}

export function assertStayRateInput(input: {
  billingMode: StayBillingMode;
  catalogUnitPrice: number;
  unitPriceApplied?: number | null;
  flatAmount?: number | null;
  plannedHours?: number | null;
  rateNote?: string | null;
}) {
  const note = input.rateNote?.trim() || "";
  if (input.billingMode === STAY_BILLING.FLAT) {
    if (input.flatAmount == null || !(input.flatAmount >= 0)) {
      throw new Error("Montant forfait invalide.");
    }
    if (input.plannedHours == null || !(input.plannedHours > 0)) {
      throw new Error("Durée en heures obligatoire pour un forfait / au temps.");
    }
    if (!note) {
      throw new Error("Motif obligatoire pour un forfait / séjour au temps.");
    }
    return;
  }
  const applied = resolveStayUnitPrice({
    catalogUnitPrice: input.catalogUnitPrice,
    unitPriceApplied: input.unitPriceApplied,
  });
  if (!(applied >= 0)) throw new Error("Tarif appliqué invalide.");
  if (
    Math.abs(applied - input.catalogUnitPrice) >= 0.01 &&
    !note
  ) {
    throw new Error("Motif obligatoire lorsque le tarif diffère du catalogue.");
  }
}
