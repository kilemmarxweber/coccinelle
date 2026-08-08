/** Calendar-night helpers for hotel folio lines (dates stored as UTC midnight). */

export function parseDateOnlyInput(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date;
}

export function toDateOnlyInput(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Local calendar today as YYYY-MM-DD for HTML date inputs. */
export function todayDateOnlyInput(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addCalendarDaysInput(dateOnly: string, days: number): string {
  const base = parseDateOnlyInput(dateOnly);
  if (!base) return dateOnly;
  base.setUTCDate(base.getUTCDate() + days);
  return toDateOnlyInput(base);
}

export function formatStayDateFr(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
}

export function nightsBetween(checkInDate: Date, checkOutDate: Date): number {
  const ms = checkOutDate.getTime() - checkInDate.getTime();
  return Math.round(ms / (24 * 60 * 60 * 1000));
}

export type NightFolioLineDraft = {
  label: string;
  amount: number;
  kind: "NIGHT";
};

function formatNightLabel(date: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function buildNightFolioLines(
  checkInDate: Date,
  checkOutDate: Date,
  priceNight: number,
): { nights: number; lines: NightFolioLineDraft[]; totalAmount: number } {
  const nights = nightsBetween(checkInDate, checkOutDate);
  if (nights < 1) {
    return { nights: 0, lines: [], totalAmount: 0 };
  }
  const lines: NightFolioLineDraft[] = [];
  for (let i = 0; i < nights; i += 1) {
    const nightDate = new Date(checkInDate);
    nightDate.setUTCDate(nightDate.getUTCDate() + i);
    lines.push({
      label: `Nuit du ${formatNightLabel(nightDate)}`,
      amount: priceNight,
      kind: "NIGHT",
    });
  }
  return { nights, lines, totalAmount: nights * priceNight };
}
