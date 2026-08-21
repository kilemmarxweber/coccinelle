"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { canAccessBranch } from "@/lib/branch/user-branches";
import { resolveCurrentBranchOpsRole } from "@/lib/branch/resolve-ops-role";
import { boutiqueRoutes } from "@/lib/branch/paths";
import {
  autoMarkPresentFromActivity,
  assertCommerceBranch,
  capabilitiesFromOpsRole,
  findBranchMemberForUser,
  getMonthPayload,
  getPayslip,
  getPresencesPayload,
  getSelfPayload,
  getStaffProfile,
  loadSettings,
  markAttendance,
  markNotifiedAbsence,
  markTeamPresent,
  payAdvance,
  payAllPayslips,
  requestAdvance,
  requestLeave,
  reviewAdvance,
  reviewJustification,
  reviewLeave,
  setPeriodStatus,
  submitJustification,
  updateSettings,
  updateStaffProfile,
} from "@/lib/payroll/service";
import { ATTENDANCE_SOURCE } from "@/lib/payroll/constants";
import type { AttendanceKind, StaffPayoutMethod } from "@/lib/payroll/types";

async function ctx(organizationId: string, branchId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) throw new Error("Non authentifié.");
  const branch = await canAccessBranch(
    session.user.id,
    session.user.role,
    branchId,
  );
  if (!branch || branch.organizationId !== organizationId) {
    throw new Error("Branche inaccessible.");
  }
  const commerce = await assertCommerceBranch(branchId);
  const opsRole = await resolveCurrentBranchOpsRole(organizationId, branchId);
  return {
    user: session.user,
    branch: commerce,
    opsRole,
    caps: capabilitiesFromOpsRole(opsRole),
  };
}

function revalidatePayroll(organizationId: string, branchId: string) {
  const r = boutiqueRoutes;
  revalidatePath(r.paie(organizationId, branchId));
  revalidatePath(r.paiePresences(organizationId, branchId));
  revalidatePath(r.paieMoi(organizationId, branchId));
  revalidatePath(r.paieParametres(organizationId, branchId));
}

export async function getPayrollCapabilitiesAction(
  organizationId: string,
  branchId: string,
) {
  const { caps } = await ctx(organizationId, branchId);
  return caps;
}

export async function loadPresencesAction(
  organizationId: string,
  branchId: string,
  ymd?: string,
) {
  const { caps } = await ctx(organizationId, branchId);
  if (!caps.canPoint) throw new Error("Permission insuffisante (présences).");
  return getPresencesPayload({ branchId, ymd });
}

export async function markAttendanceAction(input: {
  organizationId: string;
  branchId: string;
  branchMemberId: string;
  workYmd: string;
  kind: AttendanceKind;
}) {
  const { caps, branch } = await ctx(input.organizationId, input.branchId);
  if (!caps.canPoint) throw new Error("Permission insuffisante.");
  const row = await markAttendance({
    branchId: input.branchId,
    branchMemberId: input.branchMemberId,
    workYmd: input.workYmd,
    kind: input.kind,
    timezone: branch.timezone,
  });
  revalidatePayroll(input.organizationId, input.branchId);
  return row;
}

export async function markTeamPresentAction(input: {
  organizationId: string;
  branchId: string;
  workYmd: string;
}) {
  const { caps, branch } = await ctx(input.organizationId, input.branchId);
  if (!caps.canPoint) throw new Error("Permission insuffisante.");
  const rows = await markTeamPresent({
    branchId: input.branchId,
    workYmd: input.workYmd,
    timezone: branch.timezone,
  });
  revalidatePayroll(input.organizationId, input.branchId);
  return rows;
}

export async function markNotifiedAbsenceAction(input: {
  organizationId: string;
  branchId: string;
  branchMemberId: string;
  workYmd: string;
}) {
  const { caps, branch, user } = await ctx(input.organizationId, input.branchId);
  const self = await findBranchMemberForUser(input.branchId, user.id);
  const asManager = caps.canPoint;
  if (!asManager && self?.id !== input.branchMemberId) {
    throw new Error("Permission insuffisante.");
  }
  const row = await markNotifiedAbsence({
    branchId: input.branchId,
    branchMemberId: input.branchMemberId,
    workYmd: input.workYmd,
    timezone: branch.timezone,
    source: asManager ? ATTENDANCE_SOURCE.MANAGER : ATTENDANCE_SOURCE.SELF,
  });
  revalidatePayroll(input.organizationId, input.branchId);
  return row;
}

export async function submitJustificationAction(input: {
  organizationId: string;
  branchId: string;
  attendanceId: string;
  note: string;
}) {
  const { caps, user } = await ctx(input.organizationId, input.branchId);
  const self = await findBranchMemberForUser(input.branchId, user.id);
  await submitJustification({
    branchId: input.branchId,
    attendanceId: input.attendanceId,
    note: input.note,
    actorMemberId: self?.id,
    asManager: caps.canManage,
  });
  revalidatePayroll(input.organizationId, input.branchId);
}

export async function reviewJustificationAction(input: {
  organizationId: string;
  branchId: string;
  attendanceId: string;
  accept: boolean;
}) {
  const { caps } = await ctx(input.organizationId, input.branchId);
  if (!caps.canManage) throw new Error("Permission insuffisante.");
  const row = await reviewJustification(input);
  revalidatePayroll(input.organizationId, input.branchId);
  return row;
}

export async function requestLeaveAction(input: {
  organizationId: string;
  branchId: string;
  startYmd: string;
  endYmd: string;
  note?: string | null;
  branchMemberId?: string;
}) {
  const { caps, user, branch } = await ctx(input.organizationId, input.branchId);
  const self = await findBranchMemberForUser(input.branchId, user.id);
  const memberId = caps.canManage && input.branchMemberId
    ? input.branchMemberId
    : self?.id;
  if (!memberId) throw new Error("Agent introuvable.");
  await requestLeave({
    branchId: input.branchId,
    branchMemberId: memberId,
    startYmd: input.startYmd,
    endYmd: input.endYmd,
    note: input.note,
    autoApprove: caps.canManage && Boolean(input.branchMemberId),
    timezone: branch.timezone,
  });
  revalidatePayroll(input.organizationId, input.branchId);
}

export async function reviewLeaveAction(input: {
  organizationId: string;
  branchId: string;
  leaveId: string;
  accept: boolean;
}) {
  const { caps, branch } = await ctx(input.organizationId, input.branchId);
  if (!caps.canManage) throw new Error("Permission insuffisante.");
  await reviewLeave({
    branchId: input.branchId,
    leaveId: input.leaveId,
    accept: input.accept,
    timezone: branch.timezone,
  });
  revalidatePayroll(input.organizationId, input.branchId);
}

export async function requestAdvanceAction(input: {
  organizationId: string;
  branchId: string;
  amountUsd: number;
  branchMemberId?: string;
}) {
  const { caps, user, branch } = await ctx(input.organizationId, input.branchId);
  const self = await findBranchMemberForUser(input.branchId, user.id);
  const memberId =
    caps.canManage && input.branchMemberId
      ? input.branchMemberId
      : self?.id;
  if (!memberId) throw new Error("Agent introuvable.");
  await requestAdvance({
    branchId: input.branchId,
    branchMemberId: memberId,
    amountUsd: input.amountUsd,
    timezone: branch.timezone,
  });
  revalidatePayroll(input.organizationId, input.branchId);
}

export async function reviewAdvanceAction(input: {
  organizationId: string;
  branchId: string;
  advanceId: string;
  accept: boolean;
}) {
  const { caps } = await ctx(input.organizationId, input.branchId);
  if (!caps.canManage) throw new Error("Permission insuffisante.");
  await reviewAdvance(input);
  revalidatePayroll(input.organizationId, input.branchId);
}

export async function payAdvanceAction(input: {
  organizationId: string;
  branchId: string;
  advanceId: string;
}) {
  const { caps, user, branch } = await ctx(input.organizationId, input.branchId);
  if (!caps.canPay) throw new Error("Permission insuffisante.");
  await payAdvance({
    branchId: input.branchId,
    advanceId: input.advanceId,
    userId: user.id,
    timezone: branch.timezone,
  });
  revalidatePayroll(input.organizationId, input.branchId);
}

export async function loadMonthPayrollAction(
  organizationId: string,
  branchId: string,
  year?: number,
  month?: number,
) {
  const { caps } = await ctx(organizationId, branchId);
  if (!caps.canManage) throw new Error("Permission insuffisante.");
  return getMonthPayload({ branchId, year, month });
}

export async function preparePayrollAction(input: {
  organizationId: string;
  branchId: string;
  periodId: string;
}) {
  const { caps, branch } = await ctx(input.organizationId, input.branchId);
  if (!caps.canManage) throw new Error("Permission insuffisante.");
  await setPeriodStatus({
    branchId: input.branchId,
    periodId: input.periodId,
    status: "REVIEW",
    timezone: branch.timezone,
  });
  revalidatePayroll(input.organizationId, input.branchId);
}

export async function lockPayrollAction(input: {
  organizationId: string;
  branchId: string;
  periodId: string;
}) {
  const { caps, branch } = await ctx(input.organizationId, input.branchId);
  if (!caps.canManage) throw new Error("Permission insuffisante.");
  await setPeriodStatus({
    branchId: input.branchId,
    periodId: input.periodId,
    status: "LOCKED",
    timezone: branch.timezone,
  });
  revalidatePayroll(input.organizationId, input.branchId);
}

export async function payPayrollAction(input: {
  organizationId: string;
  branchId: string;
  periodId: string;
}) {
  const { caps, user } = await ctx(input.organizationId, input.branchId);
  if (!caps.canPay) throw new Error("Permission insuffisante.");
  await payAllPayslips({
    branchId: input.branchId,
    periodId: input.periodId,
    userId: user.id,
  });
  revalidatePayroll(input.organizationId, input.branchId);
}

export async function loadSelfPayrollAction(
  organizationId: string,
  branchId: string,
) {
  const { user } = await ctx(organizationId, branchId);
  return getSelfPayload({ branchId, userId: user.id });
}

export async function loadPayslipAction(
  organizationId: string,
  branchId: string,
  payslipId: string,
) {
  const { caps, user } = await ctx(organizationId, branchId);
  const self = await findBranchMemberForUser(branchId, user.id);
  return getPayslip({
    branchId,
    payslipId,
    onlyMemberId: caps.canManage ? undefined : self?.id,
  });
}

export async function loadPayrollSettingsAction(
  organizationId: string,
  branchId: string,
) {
  const { caps } = await ctx(organizationId, branchId);
  if (!caps.canManage) throw new Error("Permission insuffisante.");
  return loadSettings(branchId);
}

export async function savePayrollSettingsAction(input: {
  organizationId: string;
  branchId: string;
  defaultDailyRateUsd: number;
  workWeek: string[];
  notifyBeforeHour: number;
  advanceCapPct: number;
  justificationDays: number;
}) {
  const { caps } = await ctx(input.organizationId, input.branchId);
  if (!caps.canManage) throw new Error("Permission insuffisante.");
  await updateSettings(input);
  revalidatePayroll(input.organizationId, input.branchId);
}

export async function loadStaffPayrollProfileAction(
  organizationId: string,
  branchId: string,
  branchMemberId: string,
) {
  const { caps } = await ctx(organizationId, branchId);
  if (!caps.canManage) throw new Error("Permission insuffisante.");
  return getStaffProfile(branchId, branchMemberId);
}

export async function saveStaffPayrollProfileAction(input: {
  organizationId: string;
  branchId: string;
  branchMemberId: string;
  dailyRateUsd: number | null;
  payoutMethod: StaffPayoutMethod;
  mobileMoneyPhone?: string | null;
  bankName?: string | null;
  bankAccount?: string | null;
}) {
  const { caps } = await ctx(input.organizationId, input.branchId);
  if (!caps.canManage) throw new Error("Permission insuffisante.");
  await updateStaffProfile(input);
  revalidatePayroll(input.organizationId, input.branchId);
}

export async function hintPresentFromActivityAction(
  organizationId: string,
  branchId: string,
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return;
  await autoMarkPresentFromActivity({
    branchId,
    userId: session.user.id,
  });
}
