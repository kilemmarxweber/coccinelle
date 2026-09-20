import { roundMoney } from "@/lib/payroll/constants";

export type PayslipTotalsInput = {
  expectedDays: number;
  unpaidAbsenceDays: number;
  dailyRateUsd: number;
  advancesUsd: number;
};

export type PayslipTotals = {
  paidDays: number;
  grossUsd: number;
  absenceDeductionUsd: number;
  advancesUsd: number;
  netUsd: number;
};

export function computePayslipTotals(input: PayslipTotalsInput): PayslipTotals {
  const expectedDays = Math.max(0, Math.floor(input.expectedDays));
  const unpaidAbsenceDays = Math.min(
    expectedDays,
    Math.max(0, Math.floor(input.unpaidAbsenceDays)),
  );
  const dailyRateUsd = roundMoney(input.dailyRateUsd);
  const advancesUsd = roundMoney(Math.max(0, input.advancesUsd));
  const grossUsd = roundMoney(expectedDays * dailyRateUsd);
  const absenceDeductionUsd = roundMoney(unpaidAbsenceDays * dailyRateUsd);
  const netUsd = roundMoney(grossUsd - absenceDeductionUsd - advancesUsd);
  return {
    paidDays: expectedDays - unpaidAbsenceDays,
    grossUsd,
    absenceDeductionUsd,
    advancesUsd,
    netUsd,
  };
}

export function advanceCeilingUsd(input: {
  earnedUsd: number;
  alreadyAdvancedUsd: number;
  advanceCapPct: number;
}): number {
  const earned = Math.max(0, roundMoney(input.earnedUsd));
  const already = Math.max(0, roundMoney(input.alreadyAdvancedUsd));
  const capPct = Math.min(1, Math.max(0, input.advanceCapPct));
  return roundMoney(Math.max(0, Math.min(earned * capPct, earned - already)));
}

export function usdToCdf(usd: number, rate: number): number {
  return roundMoney(usd * (rate > 0 ? rate : 0));
}

export type AttendanceKindCode =
  | "PRESENT"
  | "ABSENT"
  | "ABSENT_NOTIFIED"
  | "LEAVE"
  | "REST";

export type PayTreatmentCode = "PAID" | "UNPAID" | "NONE";

export type JustificationStatusCode =
  | "PENDING"
  | "ACCEPTED"
  | "REJECTED"
  | null
  | undefined;

/** Statut calendrier UI (Mes jours / résumés). */
export type WorkdayUiStatus =
  | "PRESENT"
  | "ABSENT_UNPAID"
  | "ABSENT_MISSING"
  | "ABSENT_JUSTIFIED"
  | "ABSENT_PENDING"
  | "NOTIFIED"
  | "LEAVE"
  | "REST"
  | "FUTURE"
  | "UNKNOWN";

export function defaultPayTreatment(
  kind: AttendanceKindCode,
): PayTreatmentCode {
  if (kind === "REST") return "NONE";
  if (kind === "ABSENT") return "UNPAID";
  return "PAID";
}

export function attendancePayLabel(input: {
  kind: AttendanceKindCode;
  payTreatment: PayTreatmentCode;
  dailyRateUsd: number;
  justificationStatus?: JustificationStatusCode;
}): string {
  const rate = roundMoney(input.dailyRateUsd);
  if (input.kind === "REST" || input.payTreatment === "NONE") return "—";
  if (input.payTreatment === "UNPAID") return `−${rate.toFixed(2)} $`;
  if (input.kind === "ABSENT" && input.justificationStatus === "ACCEPTED") {
    return `${rate.toFixed(2)} $ · excuse`;
  }
  if (input.kind === "ABSENT" && input.justificationStatus === "PENDING") {
    return `${rate.toFixed(2)} $ · en revue`;
  }
  if (input.kind === "ABSENT_NOTIFIED") return `${rate.toFixed(2)} $ · prévenu`;
  if (input.kind === "LEAVE") return `${rate.toFixed(2)} $ · congé`;
  if (input.kind === "PRESENT") return `${rate.toFixed(2)} $ · présent`;
  return `${rate.toFixed(2)} $`;
}

export function resolveWorkdayUiStatus(input: {
  ymd: string;
  todayYmd: string;
  day?: {
    kind: AttendanceKindCode;
    payTreatment: PayTreatmentCode;
    justificationStatus?: JustificationStatusCode;
  } | null;
}): WorkdayUiStatus {
  if (input.ymd > input.todayYmd) {
    return input.day ? resolveRecordedStatus(input.day) : "FUTURE";
  }
  if (!input.day) return "ABSENT_MISSING";
  return resolveRecordedStatus(input.day);
}

function resolveRecordedStatus(day: {
  kind: AttendanceKindCode;
  payTreatment: PayTreatmentCode;
  justificationStatus?: JustificationStatusCode;
}): WorkdayUiStatus {
  if (day.kind === "REST" || day.payTreatment === "NONE") return "REST";
  if (day.kind === "PRESENT") return "PRESENT";
  if (day.kind === "LEAVE") return "LEAVE";
  if (day.kind === "ABSENT_NOTIFIED") return "NOTIFIED";
  if (day.kind === "ABSENT" && day.justificationStatus === "ACCEPTED") {
    return "ABSENT_JUSTIFIED";
  }
  if (day.kind === "ABSENT" && day.justificationStatus === "PENDING") {
    return "ABSENT_PENDING";
  }
  if (day.payTreatment === "UNPAID") return "ABSENT_UNPAID";
  return "UNKNOWN";
}

export function workdayUiLabel(status: WorkdayUiStatus): string {
  switch (status) {
    case "PRESENT":
      return "Présent";
    case "ABSENT_UNPAID":
      return "Absent (−)";
    case "ABSENT_MISSING":
      return "Non pointé (−)";
    case "ABSENT_JUSTIFIED":
      return "Excuse";
    case "ABSENT_PENDING":
      return "Justif. en cours";
    case "NOTIFIED":
      return "Prévenu";
    case "LEAVE":
      return "Congé";
    case "REST":
      return "Repos";
    case "FUTURE":
      return "À venir";
    default:
      return "—";
  }
}

/**
 * Compte les jours qui coupent la paie :
 * - `UNPAID` explicite
 * - jour ouvré ≤ asOf sans fiche (absence présumée)
 * Les jours futurs vides ne coupent pas encore.
 */
export function countUnpaidWorkdays(input: {
  workYmds: string[];
  days: Array<{
    workDate: string;
    payTreatment: PayTreatmentCode;
  }>;
  asOfYmd: string;
}): number {
  const byDate = new Map(input.days.map((d) => [d.workDate, d]));
  let unpaid = 0;
  for (const ymd of input.workYmds) {
    if (ymd > input.asOfYmd) continue;
    const day = byDate.get(ymd);
    if (!day) {
      unpaid += 1;
      continue;
    }
    if (day.payTreatment === "UNPAID") unpaid += 1;
  }
  return unpaid;
}

/** Jours déjà acquis (PAID) jusqu’à asOf — un jour manquant ne rapporte rien. */
export function countPaidWorkdaysToDate(input: {
  workYmds: string[];
  days: Array<{
    workDate: string;
    payTreatment: PayTreatmentCode;
  }>;
  asOfYmd: string;
}): number {
  const byDate = new Map(input.days.map((d) => [d.workDate, d]));
  let paid = 0;
  for (const ymd of input.workYmds) {
    if (ymd > input.asOfYmd) continue;
    const day = byDate.get(ymd);
    if (day?.payTreatment === "PAID") paid += 1;
  }
  return paid;
}
