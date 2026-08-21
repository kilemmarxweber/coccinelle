export const DEFAULT_DAILY_RATE_USD = 10;
export const DEFAULT_ADVANCE_CAP_PCT = 0.5;
export const DEFAULT_NOTIFY_BEFORE_HOUR = 18;
export const DEFAULT_JUSTIFICATION_DAYS = 3;
export const DEFAULT_TIMEZONE = "Africa/Kinshasa";

export const WEEKDAYS = [
  "MON",
  "TUE",
  "WED",
  "THU",
  "FRI",
  "SAT",
  "SUN",
] as const;

export type WeekdayCode = (typeof WEEKDAYS)[number];

/** Défaut commerce RDC : lundi → samedi. */
export const DEFAULT_WORK_WEEK: WeekdayCode[] = [
  "MON",
  "TUE",
  "WED",
  "THU",
  "FRI",
  "SAT",
];

export const WEEKDAY_LABEL_FR: Record<WeekdayCode, string> = {
  MON: "Lundi",
  TUE: "Mardi",
  WED: "Mercredi",
  THU: "Jeudi",
  FRI: "Vendredi",
  SAT: "Samedi",
  SUN: "Dimanche",
};

export const ATTENDANCE_SOURCE = {
  MANAGER: "MANAGER",
  CRON: "CRON",
  SELF: "SELF",
  POS: "POS",
} as const;

export type AttendanceSource =
  (typeof ATTENDANCE_SOURCE)[keyof typeof ATTENDANCE_SOURCE];

export const PAYROLL_MANAGER_ROLES = new Set([
  "gerant",
  "manager",
  "proprietaire",
  "branch_manager",
]);

export const PAYROLL_POINTER_ROLES = new Set([
  ...PAYROLL_MANAGER_ROLES,
  "caissier",
  "caissier_sejours",
  "caissier_resto",
]);

export function isPayrollManagerRole(role: string | null | undefined): boolean {
  return PAYROLL_MANAGER_ROLES.has((role ?? "").trim().toLowerCase());
}

export function isPayrollPointerRole(role: string | null | undefined): boolean {
  return PAYROLL_POINTER_ROLES.has((role ?? "").trim().toLowerCase());
}

export function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}
