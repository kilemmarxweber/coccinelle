import {
  DEFAULT_TIMEZONE,
  DEFAULT_WORK_WEEK,
  WEEKDAYS,
  type WeekdayCode,
} from "@/lib/payroll/constants";

export type LocalDateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: WeekdayCode;
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function ymdKey(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(day)}`;
}

export function dateToYmdUtc(d: Date): string {
  return ymdKey(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

/** Date Prisma `@db.Date` : minuit UTC du jour calendaire. */
export function ymdToDate(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
}

export function parseWorkWeek(value: unknown): WeekdayCode[] {
  if (!Array.isArray(value)) return [...DEFAULT_WORK_WEEK];
  const set = new Set<WeekdayCode>();
  for (const raw of value) {
    const code = String(raw).trim().toUpperCase() as WeekdayCode;
    if ((WEEKDAYS as readonly string[]).includes(code)) set.add(code);
  }
  return set.size > 0 ? WEEKDAYS.filter((d) => set.has(d)) : [...DEFAULT_WORK_WEEK];
}

export function isWorkday(weekday: WeekdayCode, workWeek: WeekdayCode[]): boolean {
  return workWeek.includes(weekday);
}

export function localParts(now: Date, timeZone = DEFAULT_TIMEZONE): LocalDateParts {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hour12: false,
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(now).map((p) => [p.type, p.value]),
  );
  const weekdayMap: Record<string, WeekdayCode> = {
    Mon: "MON",
    Tue: "TUE",
    Wed: "WED",
    Thu: "THU",
    Fri: "FRI",
    Sat: "SAT",
    Sun: "SUN",
  };
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour === "24" ? "0" : parts.hour),
    minute: Number(parts.minute),
    weekday: weekdayMap[parts.weekday ?? "Mon"] ?? "MON",
  };
}

export function todayYmd(timeZone = DEFAULT_TIMEZONE, now = new Date()): string {
  const p = localParts(now, timeZone);
  return ymdKey(p.year, p.month, p.day);
}

export function addDaysYmd(ymd: string, days: number): string {
  const d = ymdToDate(ymd);
  d.setUTCDate(d.getUTCDate() + days);
  return dateToYmdUtc(d);
}

export function weekdayOfYmd(ymd: string, timeZone = DEFAULT_TIMEZONE): WeekdayCode {
  const noon = new Date(`${ymd}T12:00:00Z`);
  return localParts(noon, timeZone).weekday;
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function eachYmdInMonth(year: number, month: number): string[] {
  const n = daysInMonth(year, month);
  const out: string[] = [];
  for (let d = 1; d <= n; d += 1) out.push(ymdKey(year, month, d));
  return out;
}

export function monthLabelFr(year: number, month: number): string {
  const d = new Date(Date.UTC(year, month - 1, 1));
  return d.toLocaleDateString("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" });
}

export function formatYmdFr(ymd: string): string {
  return ymdToDate(ymd).toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Cutoff préavis : la veille à `notifyBeforeHour`:00 (timezone branche).
 * Avant ce cutoff → ABSENT_NOTIFIED (payé). Après → ABSENT (non payé).
 */
export function canNotifyAbsence(input: {
  workYmd: string;
  now?: Date;
  timeZone?: string;
  notifyBeforeHour: number;
}): boolean {
  const tz = input.timeZone ?? DEFAULT_TIMEZONE;
  const now = input.now ?? new Date();
  const prev = addDaysYmd(input.workYmd, -1);
  const cutoff = zonedDateTime(prev, input.notifyBeforeHour, 0, tz);
  return now.getTime() < cutoff.getTime();
}

/** Instant UTC correspondant à ymd + heure locale dans `timeZone`. */
export function zonedDateTime(
  ymd: string,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  const guess = Date.UTC(y, (m ?? 1) - 1, d ?? 1, hour, minute, 0);
  const parts = localParts(new Date(guess), timeZone);
  const wanted = `${ymd}T${pad(hour)}:${pad(minute)}`;
  const got = `${ymdKey(parts.year, parts.month, parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}`;
  const deltaMin =
    (new Date(`${wanted}:00Z`).getTime() - new Date(`${got}:00Z`).getTime()) /
    60000;
  return new Date(guess + deltaMin * 60000);
}

export function workingYmdsInMonth(input: {
  year: number;
  month: number;
  workWeek: WeekdayCode[];
  timeZone?: string;
}): string[] {
  const tz = input.timeZone ?? DEFAULT_TIMEZONE;
  return eachYmdInMonth(input.year, input.month).filter((ymd) =>
    isWorkday(weekdayOfYmd(ymd, tz), input.workWeek),
  );
}
