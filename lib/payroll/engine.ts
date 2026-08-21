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
  justificationStatus?: "PENDING" | "ACCEPTED" | "REJECTED" | null;
}): string {
  const rate = roundMoney(input.dailyRateUsd);
  if (input.kind === "REST" || input.payTreatment === "NONE") return "—";
  if (input.payTreatment === "UNPAID") return `−${rate.toFixed(2)} $`;
  if (input.kind === "ABSENT" && input.justificationStatus === "ACCEPTED") {
    return `${rate.toFixed(2)} $ · justifié`;
  }
  if (input.kind === "ABSENT_NOTIFIED") return `${rate.toFixed(2)} $ · prévenu`;
  if (input.kind === "LEAVE") return `${rate.toFixed(2)} $ · congé`;
  return `${rate.toFixed(2)} $`;
}
