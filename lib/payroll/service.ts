import prisma from "@/lib/prisma";
import { normalizeUsdCdfRate } from "@/lib/cash/exchange";
import {
  ATTENDANCE_SOURCE,
  DEFAULT_DAILY_RATE_USD,
  isPayrollManagerRole,
  isPayrollPointerRole,
  roundMoney,
  type AttendanceSource,
} from "@/lib/payroll/constants";
import {
  addDaysYmd,
  canNotifyAbsence,
  dateToYmdUtc,
  formatYmdFr,
  localParts,
  monthLabelFr,
  parseWorkWeek,
  todayYmd,
  weekdayOfYmd,
  workingYmdsInMonth,
  ymdToDate,
  isWorkday,
} from "@/lib/payroll/dates";
import {
  advanceCeilingUsd,
  attendancePayLabel,
  computePayslipTotals,
  defaultPayTreatment,
  usdToCdf,
  type AttendanceKindCode,
} from "@/lib/payroll/engine";
import {
  ensureBranchPayrollSettings,
  ensureCommercePayrollForBranch,
  ensureStaffPayrollProfile,
  isCommerceBranchType,
} from "@/lib/payroll/bootstrap";
import {
  notifyAdvancePaid,
  notifyJustificationDecision,
  notifyPayslipIssued,
  notifySalaryPaid,
  notifyUnpaidAbsence,
} from "@/lib/notifications/staff-payroll";
import { expenseCashNote, expenseNumberPrefix } from "@/lib/expenses/kinds";
import type {
  AdvanceDto,
  AgentRow,
  AttendanceDto,
  AttendanceKind,
  LeaveRequestDto,
  MonthAgentSummary,
  PayTreatment,
  PayrollCapabilities,
  PayrollPeriodStatus,
  PayrollSettingsDto,
  PayslipDto,
  PayslipLines,
  PeriodDto,
  StaffPayoutMethod,
  StaffPayrollProfileDto,
} from "@/lib/payroll/types";

async function getActiveExchangeRate(branchId: string) {
  const row = await prisma.exchangeRate.findFirst({
    where: { branchId },
    orderBy: { validFrom: "desc" },
  });
  return normalizeUsdCdfRate(row);
}

async function getOpenCashSession(branchId: string, userId: string) {
  return prisma.cashSession.findFirst({
    where: { branchId, status: "OPEN", openedByUserId: userId },
    orderBy: { openedAt: "desc" },
  });
}

function periodDto(row: {
  id: string;
  year: number;
  month: number;
  status: PayrollPeriodStatus;
  exchangeRateUsed: number | null;
  closedAt: Date | null;
  paidAt: Date | null;
}): PeriodDto {
  return {
    id: row.id,
    year: row.year,
    month: row.month,
    status: row.status,
    exchangeRateUsed: row.exchangeRateUsed,
    closedAt: row.closedAt?.toISOString() ?? null,
    paidAt: row.paidAt?.toISOString() ?? null,
    label: monthLabelFr(row.year, row.month),
  };
}

function mapAttendance(row: {
  id: string;
  branchMemberId: string;
  workDate: Date;
  kind: AttendanceKind;
  payTreatment: PayTreatment;
  dailyRateUsd: number;
  justificationStatus: AttendanceDto["justificationStatus"];
  justificationNote: string | null;
  source: string;
}): AttendanceDto {
  return {
    id: row.id,
    branchMemberId: row.branchMemberId,
    workDate: dateToYmdUtc(row.workDate),
    kind: row.kind,
    payTreatment: row.payTreatment,
    dailyRateUsd: row.dailyRateUsd,
    justificationStatus: row.justificationStatus,
    justificationNote: row.justificationNote,
    source: row.source,
    payLabel: attendancePayLabel({
      kind: row.kind,
      payTreatment: row.payTreatment,
      dailyRateUsd: row.dailyRateUsd,
      justificationStatus: row.justificationStatus,
    }),
  };
}

function parsePayslipLines(value: unknown): PayslipLines {
  if (!value || typeof value !== "object") return { days: [], advances: [] };
  const v = value as PayslipLines;
  return {
    days: Array.isArray(v.days) ? v.days : [],
    advances: Array.isArray(v.advances) ? v.advances : [],
  };
}

function payoutReady(profile: {
  payoutMethod: StaffPayoutMethod;
  mobileMoneyPhone: string | null;
  bankName: string | null;
  bankAccount: string | null;
}): boolean {
  if (profile.payoutMethod === "CASH") return true;
  if (profile.payoutMethod === "MOBILE_MONEY") {
    return Boolean(profile.mobileMoneyPhone?.trim());
  }
  return Boolean(profile.bankName?.trim() && profile.bankAccount?.trim());
}

function payoutHint(profile: {
  payoutMethod: StaffPayoutMethod;
  mobileMoneyPhone: string | null;
  bankName: string | null;
  bankAccount: string | null;
}): string {
  if (profile.payoutMethod === "CASH") return "Espèces";
  if (profile.payoutMethod === "BANK") {
    const acc = profile.bankAccount?.trim() ?? "";
    const tail = acc.length > 4 ? acc.slice(-4) : acc;
    return `${profile.bankName ?? "Banque"} · ****${tail}`;
  }
  const phone = profile.mobileMoneyPhone?.trim() ?? "";
  const tail = phone.length > 4 ? phone.slice(-4) : phone;
  return `Mobile Money · ****${tail}`;
}

export function capabilitiesFromOpsRole(opsRole: string): PayrollCapabilities {
  const canManage = isPayrollManagerRole(opsRole);
  const canPoint = isPayrollPointerRole(opsRole);
  return {
    canView: true,
    canPoint,
    canManage,
    canPay: canManage,
    isSelfOnly: !canPoint && !canManage,
  };
}

export async function assertCommerceBranch(branchId: string) {
  const branch = await prisma.branch.findUnique({
    where: { id: branchId },
    select: {
      id: true,
      organizationId: true,
      type: true,
      name: true,
      timezone: true,
    },
  });
  if (!branch) throw new Error("Branche introuvable.");
  if (!isCommerceBranchType(branch.type)) {
    throw new Error("La paie journalière est disponible pour les branches commerce (boutique, alimentation, pharmacie).");
  }
  await ensureCommercePayrollForBranch(prisma, branchId);
  return branch;
}

export async function loadSettings(branchId: string): Promise<PayrollSettingsDto> {
  const row = await prisma.branchPayrollSettings.findUnique({
    where: { branchId },
  });
  return {
    defaultDailyRateUsd: row?.defaultDailyRateUsd ?? DEFAULT_DAILY_RATE_USD,
    workWeek: parseWorkWeek(row?.workWeek),
    notifyBeforeHour: row?.notifyBeforeHour ?? 18,
    advanceCapPct: row?.advanceCapPct ?? 0.5,
    justificationDays: row?.justificationDays ?? 3,
  };
}

export async function ensureOpenPeriod(branchId: string, year: number, month: number) {
  return prisma.payrollPeriod.upsert({
    where: { branchId_year_month: { branchId, year, month } },
    create: { branchId, year, month, status: "OPEN" },
    update: {},
  });
}

export async function currentPeriod(branchId: string, timezone: string, now = new Date()) {
  const parts = localParts(now, timezone);
  const row = await ensureOpenPeriod(branchId, parts.year, parts.month);
  return periodDto(row);
}

function effectiveRate(
  profileRate: number | null | undefined,
  defaultRate: number,
): number {
  if (profileRate != null && profileRate > 0) return roundMoney(profileRate);
  return roundMoney(defaultRate);
}

async function loadActiveAgents(branchId: string, defaultRate: number): Promise<AgentRow[]> {
  const rows = await prisma.branchMember.findMany({
    where: { branchId, status: "ACTIVE" },
    select: {
      id: true,
      role: true,
      member: {
        select: {
          userId: true,
          user: { select: { name: true, email: true, phone: true } },
        },
      },
      payrollProfile: true,
    },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((row) => {
    const profile = row.payrollProfile;
    const dto: StaffPayrollProfileDto = {
      id: profile?.id ?? "",
      branchMemberId: row.id,
      dailyRateUsd: profile?.dailyRateUsd ?? null,
      effectiveDailyRateUsd: effectiveRate(profile?.dailyRateUsd, defaultRate),
      payoutMethod: profile?.payoutMethod ?? "MOBILE_MONEY",
      mobileMoneyPhone: profile?.mobileMoneyPhone ?? row.member.user.phone,
      bankName: profile?.bankName ?? null,
      bankAccount: profile?.bankAccount ?? null,
      active: profile?.active ?? true,
    };
    return {
      branchMemberId: row.id,
      userId: row.member.userId,
      name: row.member.user.name,
      email: row.member.user.email,
      phone: row.member.user.phone,
      opsRole: row.role,
      profile: dto,
    };
  });
}

export async function findBranchMemberForUser(branchId: string, userId: string) {
  return prisma.branchMember.findFirst({
    where: {
      branchId,
      status: "ACTIVE",
      member: { userId },
    },
    select: {
      id: true,
      role: true,
      member: {
        select: {
          userId: true,
          user: { select: { name: true, email: true, phone: true } },
        },
      },
    },
  });
}

function assertPeriodEditable(status: PayrollPeriodStatus, forAttendance = true) {
  if (status === "LOCKED" || status === "PAID") {
    throw new Error("Cette période de paie est clôturée.");
  }
  if (forAttendance && status === "REVIEW") {
    throw new Error("La période est en revue : plus de pointage libre. Justifiez encore les absences.");
  }
}

async function sendAbsenceNoticeIfNeeded(attendanceId: string) {
  const row = await prisma.staffAttendanceDay.findUnique({
    where: { id: attendanceId },
    include: {
      branch: { select: { id: true, timezone: true } },
      branchMember: {
        include: {
          member: { select: { user: { select: { name: true, email: true, phone: true } } } },
        },
      },
    },
  });
  if (!row) return;
  if (row.kind !== "ABSENT" || row.payTreatment !== "UNPAID") return;
  if (row.absenceNoticeSentAt) return;

  const rate = await getActiveExchangeRate(row.branchId);
  const cdf = usdToCdf(row.dailyRateUsd, rate?.rate ?? 0);
  const user = row.branchMember.member.user;
  await notifyUnpaidAbsence({
    branchId: row.branchId,
    attendanceId: row.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    workYmd: dateToYmdUtc(row.workDate),
    amountUsd: row.dailyRateUsd,
    amountCdfIndicative: cdf,
  });
  await prisma.staffAttendanceDay.update({
    where: { id: row.id },
    data: { absenceNoticeSentAt: new Date() },
  });
}

export async function upsertAttendanceDay(input: {
  branchId: string;
  branchMemberId: string;
  workYmd: string;
  kind: AttendanceKind;
  payTreatment?: PayTreatment;
  source: AttendanceSource;
  timezone: string;
  overwrite?: boolean;
  /** Remplissage à la clôture (REVIEW autorisé). */
  forClose?: boolean;
}): Promise<AttendanceDto> {
  const settings = await loadSettings(input.branchId);
  const workWeek = parseWorkWeek(settings.workWeek);
  const weekday = weekdayOfYmd(input.workYmd, input.timezone);
  const [y, m] = input.workYmd.split("-").map(Number);
  const period = await ensureOpenPeriod(input.branchId, y, m);
  if (input.forClose) {
    if (period.status === "LOCKED" || period.status === "PAID") {
      throw new Error("Cette période de paie est clôturée.");
    }
  } else {
    assertPeriodEditable(period.status);
  }

  const member = await prisma.branchMember.findFirst({
    where: { id: input.branchMemberId, branchId: input.branchId, status: "ACTIVE" },
    include: { payrollProfile: true },
  });
  if (!member) throw new Error("Agent introuvable sur cette branche.");

  const rate = effectiveRate(member.payrollProfile?.dailyRateUsd, settings.defaultDailyRateUsd);
  let kind = input.kind;
  if (kind !== "REST" && !isWorkday(weekday, workWeek)) {
    kind = "REST";
  }
  const payTreatment =
    input.payTreatment ?? defaultPayTreatment(kind as AttendanceKindCode);

  const existing = await prisma.staffAttendanceDay.findUnique({
    where: {
      branchMemberId_workDate: {
        branchMemberId: input.branchMemberId,
        workDate: ymdToDate(input.workYmd),
      },
    },
  });
  if (existing && input.overwrite === false) {
    return mapAttendance(existing);
  }

  const row = await prisma.staffAttendanceDay.upsert({
    where: {
      branchMemberId_workDate: {
        branchMemberId: input.branchMemberId,
        workDate: ymdToDate(input.workYmd),
      },
    },
    create: {
      branchId: input.branchId,
      branchMemberId: input.branchMemberId,
      periodId: period.id,
      workDate: ymdToDate(input.workYmd),
      kind,
      payTreatment,
      dailyRateUsd: rate,
      justificationStatus: kind === "ABSENT" ? "PENDING" : null,
      source: input.source,
    },
    update: {
      kind,
      payTreatment,
      dailyRateUsd: existing ? existing.dailyRateUsd : rate,
      justificationStatus:
        kind === "ABSENT"
          ? existing?.justificationStatus ?? "PENDING"
          : null,
      source: input.source,
    },
  });

  if (row.kind === "ABSENT" && row.payTreatment === "UNPAID" && !row.absenceNoticeSentAt) {
    await sendAbsenceNoticeIfNeeded(row.id);
  }
  const fresh = await prisma.staffAttendanceDay.findUniqueOrThrow({
    where: { id: row.id },
  });
  return mapAttendance(fresh);
}

export async function autoMarkPresentFromActivity(input: {
  branchId: string;
  userId: string;
}): Promise<void> {
  try {
    const branch = await prisma.branch.findUnique({
      where: { id: input.branchId },
      select: { type: true, timezone: true },
    });
    if (!branch || !isCommerceBranchType(branch.type)) return;
    await ensureCommercePayrollForBranch(prisma, input.branchId);
    const member = await findBranchMemberForUser(input.branchId, input.userId);
    if (!member) return;
    const ymd = todayYmd(branch.timezone || "Africa/Kinshasa");
    const settings = await loadSettings(input.branchId);
    const weekday = weekdayOfYmd(ymd, branch.timezone || "Africa/Kinshasa");
    if (!isWorkday(weekday, parseWorkWeek(settings.workWeek))) return;
    const existing = await prisma.staffAttendanceDay.findUnique({
      where: {
        branchMemberId_workDate: {
          branchMemberId: member.id,
          workDate: ymdToDate(ymd),
        },
      },
    });
    if (existing) return;
    await upsertAttendanceDay({
      branchId: input.branchId,
      branchMemberId: member.id,
      workYmd: ymd,
      kind: "PRESENT",
      source: ATTENDANCE_SOURCE.POS,
      timezone: branch.timezone || "Africa/Kinshasa",
      overwrite: false,
    });
  } catch {
    // never block POS / caisse
  }
}

export async function getPresencesPayload(input: {
  branchId: string;
  ymd?: string;
}) {
  const branch = await assertCommerceBranch(input.branchId);
  const tz = branch.timezone || "Africa/Kinshasa";
  const settings = await loadSettings(input.branchId);
  const ymd = input.ymd ?? todayYmd(tz);
  const [y, m] = ymd.split("-").map(Number);
  const period = await ensureOpenPeriod(input.branchId, y, m);
  const agents = await loadActiveAgents(input.branchId, settings.defaultDailyRateUsd);
  const days = await prisma.staffAttendanceDay.findMany({
    where: { branchId: input.branchId, workDate: ymdToDate(ymd) },
  });
  const byMember = new Map(days.map((d) => [d.branchMemberId, mapAttendance(d)]));
  const weekday = weekdayOfYmd(ymd, tz);
  const rest = !isWorkday(weekday, parseWorkWeek(settings.workWeek));
  return {
    branchName: branch.name,
    timezone: tz,
    ymd,
    isWorkday: !rest,
    period: periodDto(period),
    settings,
    agents: agents.map((a) => ({
      ...a,
      attendance: byMember.get(a.branchMemberId) ?? null,
    })),
    rate: await getActiveExchangeRate(input.branchId),
  };
}

export async function markAttendance(input: {
  branchId: string;
  branchMemberId: string;
  workYmd: string;
  kind: AttendanceKind;
  timezone: string;
}) {
  return upsertAttendanceDay({
    ...input,
    source: ATTENDANCE_SOURCE.MANAGER,
    overwrite: true,
  });
}

export async function markTeamPresent(input: {
  branchId: string;
  workYmd: string;
  timezone: string;
}) {
  const settings = await loadSettings(input.branchId);
  const agents = await loadActiveAgents(input.branchId, settings.defaultDailyRateUsd);
  const out: AttendanceDto[] = [];
  for (const a of agents) {
    out.push(
      await upsertAttendanceDay({
        branchId: input.branchId,
        branchMemberId: a.branchMemberId,
        workYmd: input.workYmd,
        kind: "PRESENT",
        source: ATTENDANCE_SOURCE.MANAGER,
        timezone: input.timezone,
        overwrite: true,
      }),
    );
  }
  return out;
}

export async function markNotifiedAbsence(input: {
  branchId: string;
  branchMemberId: string;
  workYmd: string;
  timezone: string;
  source: AttendanceSource;
}) {
  const settings = await loadSettings(input.branchId);
  const allowed = canNotifyAbsence({
    workYmd: input.workYmd,
    timeZone: input.timezone,
    notifyBeforeHour: settings.notifyBeforeHour,
  });
  if (!allowed) {
    return upsertAttendanceDay({
      ...input,
      kind: "ABSENT",
      source: input.source,
      overwrite: true,
    });
  }
  return upsertAttendanceDay({
    ...input,
    kind: "ABSENT_NOTIFIED",
    payTreatment: "PAID",
    source: input.source,
    overwrite: true,
  });
}

export async function submitJustification(input: {
  branchId: string;
  attendanceId: string;
  note: string;
  actorMemberId?: string;
  asManager?: boolean;
}) {
  const note = input.note.trim();
  if (!note) throw new Error("Le motif est obligatoire.");
  const row = await prisma.staffAttendanceDay.findFirst({
    where: { id: input.attendanceId, branchId: input.branchId },
  });
  if (!row) throw new Error("Jour introuvable.");
  if (input.actorMemberId && row.branchMemberId !== input.actorMemberId && !input.asManager) {
    throw new Error("Vous ne pouvez justifier que vos propres jours.");
  }
  const period = await prisma.payrollPeriod.findUniqueOrThrow({
    where: { id: row.periodId },
  });
  if (period.status === "LOCKED" || period.status === "PAID") {
    throw new Error("Période clôturée.");
  }
  if (row.kind !== "ABSENT") {
    throw new Error("Un justificatif ne s’applique qu’à une absence.");
  }
  await prisma.staffAttendanceDay.update({
    where: { id: row.id },
    data: {
      justificationNote: note,
      justificationStatus: "PENDING",
    },
  });
}

export async function reviewJustification(input: {
  branchId: string;
  attendanceId: string;
  accept: boolean;
}) {
  const row = await prisma.staffAttendanceDay.findFirst({
    where: { id: input.attendanceId, branchId: input.branchId },
    include: {
      branchMember: {
        include: {
          member: { select: { user: { select: { name: true, email: true, phone: true } } } },
        },
      },
    },
  });
  if (!row) throw new Error("Jour introuvable.");
  const period = await prisma.payrollPeriod.findUniqueOrThrow({
    where: { id: row.periodId },
  });
  if (period.status === "LOCKED" || period.status === "PAID") {
    throw new Error("Période clôturée.");
  }
  if (row.kind !== "ABSENT") throw new Error("Ce jour n’est pas une absence.");

  const updated = await prisma.staffAttendanceDay.update({
    where: { id: row.id },
    data: {
      justificationStatus: input.accept ? "ACCEPTED" : "REJECTED",
      payTreatment: input.accept ? "PAID" : "UNPAID",
    },
  });

  const user = row.branchMember.member.user;
  await notifyJustificationDecision({
    branchId: input.branchId,
    attendanceId: row.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    workYmd: dateToYmdUtc(row.workDate),
    accepted: input.accept,
    amountUsd: row.dailyRateUsd,
  });
  return mapAttendance(updated);
}

async function applyLeaveDays(input: {
  branchId: string;
  branchMemberId: string;
  startYmd: string;
  endYmd: string;
  timezone: string;
}) {
  let cursor = input.startYmd;
  const settings = await loadSettings(input.branchId);
  const week = parseWorkWeek(settings.workWeek);
  while (cursor <= input.endYmd) {
    const wd = weekdayOfYmd(cursor, input.timezone);
    if (isWorkday(wd, week)) {
      await upsertAttendanceDay({
        branchId: input.branchId,
        branchMemberId: input.branchMemberId,
        workYmd: cursor,
        kind: "LEAVE",
        payTreatment: "PAID",
        source: ATTENDANCE_SOURCE.MANAGER,
        timezone: input.timezone,
        overwrite: true,
      });
    }
    cursor = addDaysYmd(cursor, 1);
  }
}

export async function requestLeave(input: {
  branchId: string;
  branchMemberId: string;
  startYmd: string;
  endYmd: string;
  note?: string | null;
  autoApprove?: boolean;
  timezone: string;
}) {
  if (input.endYmd < input.startYmd) {
    throw new Error("Les dates de congé sont invalides.");
  }
  const created = await prisma.staffLeaveRequest.create({
    data: {
      branchId: input.branchId,
      branchMemberId: input.branchMemberId,
      startDate: ymdToDate(input.startYmd),
      endDate: ymdToDate(input.endYmd),
      note: input.note?.trim() || null,
      status: input.autoApprove ? "APPROVED" : "REQUESTED",
    },
  });
  if (input.autoApprove) {
    await applyLeaveDays({
      branchId: input.branchId,
      branchMemberId: input.branchMemberId,
      startYmd: input.startYmd,
      endYmd: input.endYmd,
      timezone: input.timezone,
    });
  }
  return created;
}

export async function reviewLeave(input: {
  branchId: string;
  leaveId: string;
  accept: boolean;
  timezone: string;
}) {
  const row = await prisma.staffLeaveRequest.findFirst({
    where: { id: input.leaveId, branchId: input.branchId },
  });
  if (!row) throw new Error("Demande de congé introuvable.");
  if (row.status !== "REQUESTED") throw new Error("Cette demande a déjà été traitée.");
  await prisma.staffLeaveRequest.update({
    where: { id: row.id },
    data: { status: input.accept ? "APPROVED" : "REJECTED" },
  });
  if (input.accept) {
    await applyLeaveDays({
      branchId: input.branchId,
      branchMemberId: row.branchMemberId,
      startYmd: dateToYmdUtc(row.startDate),
      endYmd: dateToYmdUtc(row.endDate),
      timezone: input.timezone,
    });
  }
}

function earnedToDateUsd(input: {
  days: AttendanceDto[];
  workYmds: string[];
  todayYmd: string;
  dailyRateUsd: number;
}): number {
  const paid = input.workYmds.filter((ymd) => {
    if (ymd > input.todayYmd) return false;
    const day = input.days.find((d) => d.workDate === ymd);
    if (!day) return false;
    return day.payTreatment === "PAID";
  }).length;
  return roundMoney(paid * input.dailyRateUsd);
}

export async function requestAdvance(input: {
  branchId: string;
  branchMemberId: string;
  amountUsd: number;
  timezone: string;
}) {
  const amount = roundMoney(input.amountUsd);
  if (!(amount > 0)) throw new Error("Montant invalide.");
  const branch = await assertCommerceBranch(input.branchId);
  const tz = input.timezone || branch.timezone;
  const settings = await loadSettings(input.branchId);
  const now = localParts(new Date(), tz);
  const period = await ensureOpenPeriod(input.branchId, now.year, now.month);
  if (period.status !== "OPEN") {
    throw new Error("Impossible de demander une avance sur une période déjà en revue ou clôturée.");
  }
  const member = await prisma.branchMember.findFirst({
    where: { id: input.branchMemberId, branchId: input.branchId },
    include: { payrollProfile: true },
  });
  if (!member) throw new Error("Agent introuvable.");
  const rate = effectiveRate(member.payrollProfile?.dailyRateUsd, settings.defaultDailyRateUsd);
  const workYmds = workingYmdsInMonth({
    year: now.year,
    month: now.month,
    workWeek: parseWorkWeek(settings.workWeek),
    timeZone: tz,
  });
  const days = await prisma.staffAttendanceDay.findMany({
    where: { branchMemberId: input.branchMemberId, periodId: period.id },
  });
  const today = todayYmd(tz);
  const earned = earnedToDateUsd({
    days: days.map(mapAttendance),
    workYmds,
    todayYmd: today,
    dailyRateUsd: rate,
  });
  const paidAdvances = await prisma.staffSalaryAdvance.aggregate({
    where: {
      branchMemberId: input.branchMemberId,
      periodId: period.id,
      status: "PAID",
    },
    _sum: { amountUsd: true },
  });
  const alreadyUsd = roundMoney(paidAdvances._sum.amountUsd ?? 0);
  const cap = advanceCeilingUsd({
    earnedUsd: earned,
    alreadyAdvancedUsd: alreadyUsd,
    advanceCapPct: settings.advanceCapPct,
  });
  if (amount > cap + 0.001) {
    throw new Error(
      `Avance refusée : plafond ${cap.toFixed(2)} USD (${Math.round(settings.advanceCapPct * 100)} % du déjà-gagné ${earned.toFixed(2)} USD, moins ${alreadyUsd.toFixed(2)} USD déjà versés).`,
    );
  }
  return prisma.staffSalaryAdvance.create({
    data: {
      branchId: input.branchId,
      branchMemberId: input.branchMemberId,
      periodId: period.id,
      amountUsd: amount,
      status: "REQUESTED",
    },
  });
}

async function nextExpenseNumber(branchId: string, kind: "SALAIRE" | "AVANCE_SALAIRE") {
  const prefix = expenseNumberPrefix(kind);
  const count = await prisma.branchExpense.count({ where: { branchId, kind } });
  return `${prefix}-${String(count + 1).padStart(5, "0")}`;
}

async function nextReceiptNumber(branchId: string) {
  const count = await prisma.payment.count({ where: { branchId } });
  return `RC-${String(count + 1).padStart(5, "0")}`;
}

async function createPayrollCashOut(input: {
  branchId: string;
  userId: string;
  kind: "SALAIRE" | "AVANCE_SALAIRE";
  label: string;
  beneficiary: string;
  amountUsd: number;
  method: "CASH" | "MOBILE_MONEY" | "BANK";
  note?: string | null;
}) {
  const amountUsd = roundMoney(input.amountUsd);
  if (!(amountUsd > 0)) throw new Error("Montant invalide.");
  let cashSessionId: string | null = null;
  if (input.method === "CASH") {
    const session = await getOpenCashSession(input.branchId, input.userId);
    if (!session) {
      throw new Error("Ouvrez une session de caisse pour un versement en espèces.");
    }
    cashSessionId = session.id;
  }
  const rate = await getActiveExchangeRate(input.branchId);
  const rateVal = rate?.rate && rate.rate > 0 ? rate.rate : 1;
  const number = await nextExpenseNumber(input.branchId, input.kind);
  const expense = await prisma.branchExpense.create({
    data: {
      branchId: input.branchId,
      number,
      kind: input.kind,
      label: input.label,
      category: "Personnel",
      beneficiary: input.beneficiary,
      amountUsd,
      note: input.note ?? null,
      createdByUserId: input.userId,
    },
  });
  const payment = await prisma.payment.create({
    data: {
      branchId: input.branchId,
      cashSessionId,
      expenseId: expense.id,
      receiptNumber: await nextReceiptNumber(input.branchId),
      method: input.method,
      amountCdf: usdToCdf(-amountUsd, rateVal),
      amountForeign: -amountUsd,
      foreignCurrency: "USD",
      exchangeRateUsed: rate?.rate ?? null,
      cashierUserId: input.userId,
      note: expenseCashNote(input.kind, input.label),
    },
  });
  return { expense, payment };
}

export async function reviewAdvance(input: {
  branchId: string;
  advanceId: string;
  accept: boolean;
}) {
  const row = await prisma.staffSalaryAdvance.findFirst({
    where: { id: input.advanceId, branchId: input.branchId },
  });
  if (!row) throw new Error("Avance introuvable.");
  if (row.status !== "REQUESTED") throw new Error("Cette avance a déjà été traitée.");
  await prisma.staffSalaryAdvance.update({
    where: { id: row.id },
    data: { status: input.accept ? "APPROVED" : "REJECTED" },
  });
}

export async function payAdvance(input: {
  branchId: string;
  advanceId: string;
  userId: string;
  timezone: string;
}) {
  const row = await prisma.staffSalaryAdvance.findFirst({
    where: { id: input.advanceId, branchId: input.branchId },
    include: {
      period: true,
      branchMember: {
        include: {
          payrollProfile: true,
          member: { select: { user: { select: { name: true, email: true, phone: true } } } },
        },
      },
    },
  });
  if (!row) throw new Error("Avance introuvable.");
  if (row.status === "PAID" && row.expenseId) return;
  if (row.status !== "APPROVED") {
    throw new Error("L’avance doit d’abord être approuvée.");
  }
  if (row.period.status === "LOCKED" || row.period.status === "PAID") {
    throw new Error("Période clôturée.");
  }
  const profile = row.branchMember.payrollProfile;
  if (!profile) throw new Error("Profil de paie manquant.");
  const method =
    profile.payoutMethod === "BANK"
      ? "BANK"
      : profile.payoutMethod === "CASH"
        ? "CASH"
        : "MOBILE_MONEY";
  const user = row.branchMember.member.user;
  const { expense } = await createPayrollCashOut({
    branchId: input.branchId,
    userId: input.userId,
    kind: "AVANCE_SALAIRE",
    label: `Avance salaire · ${user.name}`,
    beneficiary: user.name,
    amountUsd: row.amountUsd,
    method,
    note: payoutHint(profile),
  });
  await prisma.staffSalaryAdvance.update({
    where: { id: row.id },
    data: { status: "PAID", expenseId: expense.id, paidAt: new Date() },
  });

  const settings = await loadSettings(input.branchId);
  const now = localParts(new Date(), input.timezone);
  const workYmds = workingYmdsInMonth({
    year: now.year,
    month: now.month,
    workWeek: parseWorkWeek(settings.workWeek),
    timeZone: input.timezone,
  });
  const days = await prisma.staffAttendanceDay.findMany({
    where: { branchMemberId: row.branchMemberId, periodId: row.periodId },
  });
  const rate = effectiveRate(profile.dailyRateUsd, settings.defaultDailyRateUsd);
  const earned = earnedToDateUsd({
    days: days.map(mapAttendance),
    workYmds,
    todayYmd: todayYmd(input.timezone),
    dailyRateUsd: rate,
  });
  const paidSum = await prisma.staffSalaryAdvance.aggregate({
    where: { branchMemberId: row.branchMemberId, periodId: row.periodId, status: "PAID" },
    _sum: { amountUsd: true },
  });
  await notifyAdvancePaid({
    branchId: input.branchId,
    advanceId: row.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    amountUsd: row.amountUsd,
    remainingUsd: roundMoney(earned - (paidSum._sum.amountUsd ?? 0)),
  });
}

export async function listLeaveAndAdvances(branchId: string, periodId?: string) {
  const leaves = await prisma.staffLeaveRequest.findMany({
    where: { branchId },
    include: {
      branchMember: {
        include: { member: { select: { user: { select: { name: true } } } } },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const advances = await prisma.staffSalaryAdvance.findMany({
    where: periodId ? { branchId, periodId } : { branchId },
    include: {
      branchMember: {
        include: { member: { select: { user: { select: { name: true } } } } },
      },
    },
    orderBy: { requestedAt: "desc" },
    take: 50,
  });
  return {
    leaves: leaves.map(
      (l): LeaveRequestDto => ({
        id: l.id,
        branchMemberId: l.branchMemberId,
        agentName: l.branchMember.member.user.name,
        startDate: dateToYmdUtc(l.startDate),
        endDate: dateToYmdUtc(l.endDate),
        status: l.status,
        note: l.note,
      }),
    ),
    advances: advances.map(
      (a): AdvanceDto => ({
        id: a.id,
        branchMemberId: a.branchMemberId,
        agentName: a.branchMember.member.user.name,
        amountUsd: a.amountUsd,
        status: a.status,
        requestedAt: a.requestedAt.toISOString(),
        paidAt: a.paidAt?.toISOString() ?? null,
      }),
    ),
  };
}

function summarizeAgent(input: {
  agent: AgentRow;
  workYmds: string[];
  days: AttendanceDto[];
  advancesUsd: number;
  payslip: PayslipDto | null;
}): MonthAgentSummary {
  const byDate = new Map(input.days.map((d) => [d.workDate, d]));
  let presentDays = 0;
  let leaveDays = 0;
  let notifiedDays = 0;
  let justifiedDays = 0;
  let unpaidDays = 0;
  for (const ymd of input.workYmds) {
    const day = byDate.get(ymd);
    if (!day) continue;
    if (day.kind === "PRESENT") presentDays += 1;
    if (day.kind === "LEAVE") leaveDays += 1;
    if (day.kind === "ABSENT_NOTIFIED") notifiedDays += 1;
    if (day.kind === "ABSENT" && day.payTreatment === "PAID") justifiedDays += 1;
    if (day.payTreatment === "UNPAID") unpaidDays += 1;
  }
  const totals = computePayslipTotals({
    expectedDays: input.workYmds.length,
    unpaidAbsenceDays: unpaidDays,
    dailyRateUsd: input.agent.profile.effectiveDailyRateUsd,
    advancesUsd: input.advancesUsd,
  });
  return {
    branchMemberId: input.agent.branchMemberId,
    name: input.agent.name,
    dailyRateUsd: input.agent.profile.effectiveDailyRateUsd,
    expectedDays: input.workYmds.length,
    presentDays,
    leaveDays,
    notifiedDays,
    justifiedDays,
    unpaidDays,
    grossUsd: totals.grossUsd,
    absenceDeductionUsd: totals.absenceDeductionUsd,
    advancesUsd: totals.advancesUsd,
    netUsd: totals.netUsd,
    payoutMethod: input.agent.profile.payoutMethod,
    payoutReady: payoutReady(input.agent.profile),
    payslip: input.payslip,
  };
}

export async function getMonthPayload(input: {
  branchId: string;
  year?: number;
  month?: number;
}) {
  const branch = await assertCommerceBranch(input.branchId);
  const tz = branch.timezone || "Africa/Kinshasa";
  const settings = await loadSettings(input.branchId);
  const now = localParts(new Date(), tz);
  const year = input.year ?? now.year;
  const month = input.month ?? now.month;
  const period = await ensureOpenPeriod(input.branchId, year, month);
  const workYmds = workingYmdsInMonth({
    year,
    month,
    workWeek: parseWorkWeek(settings.workWeek),
    timeZone: tz,
  });
  const agents = await loadActiveAgents(input.branchId, settings.defaultDailyRateUsd);
  const days = await prisma.staffAttendanceDay.findMany({
    where: { branchId: input.branchId, periodId: period.id },
  });
  const advances = await prisma.staffSalaryAdvance.findMany({
    where: { periodId: period.id, status: "PAID" },
  });
  const payslips = await prisma.payslip.findMany({
    where: { periodId: period.id },
    include: {
      branchMember: {
        include: { member: { select: { user: { select: { name: true } } } } },
      },
    },
  });
  const extras = await listLeaveAndAdvances(input.branchId, period.id);
  const fx = await getActiveExchangeRate(input.branchId);

  const summaries = agents.map((agent) => {
    const agentDays = days
      .filter((d) => d.branchMemberId === agent.branchMemberId)
      .map(mapAttendance);
    const adv = advances
      .filter((a) => a.branchMemberId === agent.branchMemberId)
      .reduce((s, a) => s + a.amountUsd, 0);
    const slip = payslips.find((p) => p.branchMemberId === agent.branchMemberId);
    return summarizeAgent({
      agent,
      workYmds,
      days: agentDays,
      advancesUsd: adv,
      payslip: slip
        ? {
            id: slip.id,
            branchMemberId: slip.branchMemberId,
            agentName: slip.branchMember.member.user.name,
            periodId: slip.periodId,
            dailyRateUsd: slip.dailyRateUsd,
            expectedDays: slip.expectedDays,
            unpaidAbsenceDays: slip.unpaidAbsenceDays,
            grossUsd: slip.grossUsd,
            absenceDeductionUsd: slip.absenceDeductionUsd,
            advancesUsd: slip.advancesUsd,
            netUsd: slip.netUsd,
            netCdf: slip.netCdf,
            exchangeRateUsed: slip.exchangeRateUsed,
            lines: parsePayslipLines(slip.lines),
            expenseId: slip.expenseId,
            sentAt: slip.sentAt?.toISOString() ?? null,
          }
        : null,
    });
  });

  return {
    branchName: branch.name,
    timezone: tz,
    settings,
    period: periodDto(period),
    rate: fx,
    agents: summaries,
    leaves: extras.leaves,
    advances: extras.advances,
    pendingJustifications: days
      .filter((d) => d.kind === "ABSENT" && d.justificationStatus === "PENDING")
      .map(mapAttendance),
  };
}

async function fillMissingUnpaidDays(input: {
  branchId: string;
  periodId: string;
  year: number;
  month: number;
  timezone: string;
}) {
  const settings = await loadSettings(input.branchId);
  const workYmds = workingYmdsInMonth({
    year: input.year,
    month: input.month,
    workWeek: parseWorkWeek(settings.workWeek),
    timeZone: input.timezone,
  });
  const agents = await loadActiveAgents(input.branchId, settings.defaultDailyRateUsd);
  const existing = await prisma.staffAttendanceDay.findMany({
    where: { periodId: input.periodId },
    select: { branchMemberId: true, workDate: true },
  });
  const have = new Set(
    existing.map((e) => `${e.branchMemberId}:${dateToYmdUtc(e.workDate)}`),
  );
  for (const agent of agents) {
    for (const ymd of workYmds) {
      if (have.has(`${agent.branchMemberId}:${ymd}`)) continue;
      await upsertAttendanceDay({
        branchId: input.branchId,
        branchMemberId: agent.branchMemberId,
        workYmd: ymd,
        kind: "ABSENT",
        source: ATTENDANCE_SOURCE.CRON,
        timezone: input.timezone,
        overwrite: false,
        forClose: true,
      });
    }
  }
}

export async function setPeriodStatus(input: {
  branchId: string;
  periodId: string;
  status: "REVIEW" | "LOCKED";
  timezone: string;
}) {
  const period = await prisma.payrollPeriod.findFirst({
    where: { id: input.periodId, branchId: input.branchId },
  });
  if (!period) throw new Error("Période introuvable.");
  if (period.status === "PAID") throw new Error("Période déjà versée.");
  if (input.status === "REVIEW") {
    if (period.status !== "OPEN") throw new Error("Seule une période ouverte peut passer en revue.");
    await prisma.payrollPeriod.update({
      where: { id: period.id },
      data: { status: "REVIEW" },
    });
    return;
  }

  await fillMissingUnpaidDays({
    branchId: input.branchId,
    periodId: period.id,
    year: period.year,
    month: period.month,
    timezone: input.timezone,
  });

  const fx = await getActiveExchangeRate(input.branchId);
  const rateVal = fx?.rate && fx.rate > 0 ? fx.rate : 0;
  if (!(rateVal > 0)) {
    throw new Error("Définissez un taux USD→CDF avant de clôturer.");
  }

  const payload = await getMonthPayload({
    branchId: input.branchId,
    year: period.year,
    month: period.month,
  });
  for (const agent of payload.agents) {
    if (agent.netUsd < 0) {
      throw new Error(
        `Clôture bloquée : ${agent.name} a un net négatif (${agent.netUsd.toFixed(2)} USD).`,
      );
    }
  }

  const settings = await loadSettings(input.branchId);
  const workYmds = workingYmdsInMonth({
    year: period.year,
    month: period.month,
    workWeek: parseWorkWeek(settings.workWeek),
    timeZone: input.timezone,
  });
  const days = await prisma.staffAttendanceDay.findMany({
    where: { periodId: period.id },
  });
  const advances = await prisma.staffSalaryAdvance.findMany({
    where: { periodId: period.id, status: "PAID" },
  });
  const agents = await loadActiveAgents(input.branchId, settings.defaultDailyRateUsd);

  for (const agent of agents) {
    const agentDays = days
      .filter((d) => d.branchMemberId === agent.branchMemberId)
      .map(mapAttendance);
    const agentAdv = advances.filter((a) => a.branchMemberId === agent.branchMemberId);
    const unpaidDays = agentDays.filter((d) => d.payTreatment === "UNPAID").length;
    const totals = computePayslipTotals({
      expectedDays: workYmds.length,
      unpaidAbsenceDays: unpaidDays,
      dailyRateUsd: agent.profile.effectiveDailyRateUsd,
      advancesUsd: agentAdv.reduce((s, a) => s + a.amountUsd, 0),
    });
    const lines: PayslipLines = {
      days: workYmds.map((ymd) => {
        const day = agentDays.find((d) => d.workDate === ymd);
        const kind = day?.kind ?? "ABSENT";
        const pay = day?.payTreatment ?? "UNPAID";
        const amount =
          pay === "UNPAID" ? roundMoney(-agent.profile.effectiveDailyRateUsd) : 0;
        return {
          date: ymd,
          kind,
          payTreatment: pay,
          amountUsd: amount,
          label: day
            ? attendancePayLabel({
                kind: day.kind,
                payTreatment: day.payTreatment,
                dailyRateUsd: day.dailyRateUsd,
                justificationStatus: day.justificationStatus,
              })
            : `−${agent.profile.effectiveDailyRateUsd.toFixed(2)} $`,
        };
      }),
      advances: agentAdv.map((a) => ({
        date: dateToYmdUtc(a.paidAt ?? a.requestedAt),
        amountUsd: a.amountUsd,
      })),
    };
    const slip = await prisma.payslip.upsert({
      where: {
        periodId_branchMemberId: {
          periodId: period.id,
          branchMemberId: agent.branchMemberId,
        },
      },
      create: {
        branchId: input.branchId,
        branchMemberId: agent.branchMemberId,
        periodId: period.id,
        dailyRateUsd: agent.profile.effectiveDailyRateUsd,
        expectedDays: workYmds.length,
        unpaidAbsenceDays: unpaidDays,
        grossUsd: totals.grossUsd,
        absenceDeductionUsd: totals.absenceDeductionUsd,
        advancesUsd: totals.advancesUsd,
        netUsd: totals.netUsd,
        netCdf: usdToCdf(totals.netUsd, rateVal),
        exchangeRateUsed: rateVal,
        lines,
      },
      update: {
        dailyRateUsd: agent.profile.effectiveDailyRateUsd,
        expectedDays: workYmds.length,
        unpaidAbsenceDays: unpaidDays,
        grossUsd: totals.grossUsd,
        absenceDeductionUsd: totals.absenceDeductionUsd,
        advancesUsd: totals.advancesUsd,
        netUsd: totals.netUsd,
        netCdf: usdToCdf(totals.netUsd, rateVal),
        exchangeRateUsed: rateVal,
        lines,
      },
    });
    await notifyPayslipIssued({
      branchId: input.branchId,
      payslipId: slip.id,
      name: agent.name,
      email: agent.email,
      phone: agent.phone,
      periodLabel: monthLabelFr(period.year, period.month),
      grossUsd: totals.grossUsd,
      absenceUsd: totals.absenceDeductionUsd,
      advancesUsd: totals.advancesUsd,
      netUsd: totals.netUsd,
      netCdf: usdToCdf(totals.netUsd, rateVal),
      payoutHint: payoutHint(agent.profile),
    });
    await prisma.payslip.update({
      where: { id: slip.id },
      data: { sentAt: new Date() },
    });
  }

  await prisma.payrollPeriod.update({
    where: { id: period.id },
    data: {
      status: "LOCKED",
      exchangeRateUsed: rateVal,
      closedAt: new Date(),
    },
  });
}

export async function payAllPayslips(input: {
  branchId: string;
  periodId: string;
  userId: string;
}) {
  const period = await prisma.payrollPeriod.findFirst({
    where: { id: input.periodId, branchId: input.branchId },
  });
  if (!period) throw new Error("Période introuvable.");
  if (period.status !== "LOCKED" && period.status !== "PAID") {
    throw new Error("Clôturez d’abord la période avant de verser.");
  }
  const slips = await prisma.payslip.findMany({
    where: { periodId: period.id },
    include: {
      branchMember: {
        include: {
          payrollProfile: true,
          member: { select: { user: { select: { name: true, email: true, phone: true } } } },
        },
      },
    },
  });
  for (const slip of slips) {
    if (slip.expenseId) continue;
    const profile = slip.branchMember.payrollProfile;
    if (!profile || !payoutReady(profile)) {
      throw new Error(
        `Coordonnées de versement manquantes pour ${slip.branchMember.member.user.name}.`,
      );
    }
    if (slip.netUsd <= 0) continue;
    const method =
      profile.payoutMethod === "BANK"
        ? "BANK"
        : profile.payoutMethod === "CASH"
          ? "CASH"
          : "MOBILE_MONEY";
    const user = slip.branchMember.member.user;
    const { expense, payment } = await createPayrollCashOut({
      branchId: input.branchId,
      userId: input.userId,
      kind: "SALAIRE",
      label: `Salaire ${monthLabelFr(period.year, period.month)} · ${user.name}`,
      beneficiary: user.name,
      amountUsd: slip.netUsd,
      method,
      note: payoutHint(profile),
    });
    await prisma.payslip.update({
      where: { id: slip.id },
      data: { expenseId: expense.id },
    });
    await notifySalaryPaid({
      branchId: input.branchId,
      payslipId: slip.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      netUsd: slip.netUsd,
      reference: payment.receiptNumber,
      methodLabel: payoutHint(profile),
    });
  }
  await prisma.payrollPeriod.update({
    where: { id: period.id },
    data: { status: "PAID", paidAt: new Date() },
  });
}

export async function getPayslip(input: {
  branchId: string;
  payslipId: string;
  onlyMemberId?: string;
}) {
  const slip = await prisma.payslip.findFirst({
    where: { id: input.payslipId, branchId: input.branchId },
    include: {
      period: true,
      branch: { select: { name: true } },
      branchMember: {
        include: {
          payrollProfile: true,
          member: { select: { user: { select: { name: true, email: true } } } },
        },
      },
    },
  });
  if (!slip) throw new Error("Bulletin introuvable.");
  if (input.onlyMemberId && slip.branchMemberId !== input.onlyMemberId) {
    throw new Error("Accès refusé.");
  }
  const dto: PayslipDto = {
    id: slip.id,
    branchMemberId: slip.branchMemberId,
    agentName: slip.branchMember.member.user.name,
    periodId: slip.periodId,
    dailyRateUsd: slip.dailyRateUsd,
    expectedDays: slip.expectedDays,
    unpaidAbsenceDays: slip.unpaidAbsenceDays,
    grossUsd: slip.grossUsd,
    absenceDeductionUsd: slip.absenceDeductionUsd,
    advancesUsd: slip.advancesUsd,
    netUsd: slip.netUsd,
    netCdf: slip.netCdf,
    exchangeRateUsed: slip.exchangeRateUsed,
    lines: parsePayslipLines(slip.lines),
    expenseId: slip.expenseId,
    sentAt: slip.sentAt?.toISOString() ?? null,
  };
  return {
    branchName: slip.branch.name,
    period: periodDto(slip.period),
    payoutHint: slip.branchMember.payrollProfile
      ? payoutHint(slip.branchMember.payrollProfile)
      : null,
    payslip: dto,
  };
}

export async function getSelfPayload(input: {
  branchId: string;
  userId: string;
}) {
  const branch = await assertCommerceBranch(input.branchId);
  const tz = branch.timezone || "Africa/Kinshasa";
  const member = await findBranchMemberForUser(input.branchId, input.userId);
  if (!member) throw new Error("Vous n’êtes pas rattaché à cette branche.");
  const settings = await loadSettings(input.branchId);
  const now = localParts(new Date(), tz);
  const period = await ensureOpenPeriod(input.branchId, now.year, now.month);
  const profileRow = await prisma.staffPayrollProfile.findUnique({
    where: { branchMemberId: member.id },
  });
  const rate = effectiveRate(profileRow?.dailyRateUsd, settings.defaultDailyRateUsd);
  const workYmds = workingYmdsInMonth({
    year: now.year,
    month: now.month,
    workWeek: parseWorkWeek(settings.workWeek),
    timeZone: tz,
  });
  const days = await prisma.staffAttendanceDay.findMany({
    where: { branchMemberId: member.id, periodId: period.id },
    orderBy: { workDate: "asc" },
  });
  const advances = await prisma.staffSalaryAdvance.findMany({
    where: { branchMemberId: member.id, periodId: period.id },
    orderBy: { requestedAt: "desc" },
  });
  const leaves = await prisma.staffLeaveRequest.findMany({
    where: { branchMemberId: member.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  const payslips = await prisma.payslip.findMany({
    where: { branchMemberId: member.id, branchId: input.branchId },
    include: {
      period: true,
      branchMember: {
        include: { member: { select: { user: { select: { name: true } } } } },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 12,
  });
  const mappedDays = days.map(mapAttendance);
  const paidAdv = advances
    .filter((a) => a.status === "PAID")
    .reduce((s, a) => s + a.amountUsd, 0);
  const earned = earnedToDateUsd({
    days: mappedDays,
    workYmds,
    todayYmd: todayYmd(tz),
    dailyRateUsd: rate,
  });
  const cap = advanceCeilingUsd({
    earnedUsd: earned,
    alreadyAdvancedUsd: paidAdv,
    advanceCapPct: settings.advanceCapPct,
  });
  const unpaid = mappedDays.filter((d) => d.payTreatment === "UNPAID").length;
  const live = computePayslipTotals({
    expectedDays: workYmds.filter((d) => d <= todayYmd(tz)).length,
    unpaidAbsenceDays: mappedDays.filter(
      (d) => d.payTreatment === "UNPAID" && d.workDate <= todayYmd(tz),
    ).length,
    dailyRateUsd: rate,
    advancesUsd: paidAdv,
  });
  return {
    branchName: branch.name,
    timezone: tz,
    settings,
    period: periodDto(period),
    member: {
      branchMemberId: member.id,
      name: member.member.user.name,
      email: member.member.user.email,
      phone: member.member.user.phone,
      dailyRateUsd: rate,
    },
    days: mappedDays,
    workYmds,
    unpaidOpen: unpaid,
    earnedUsd: earned,
    advancesUsd: paidAdv,
    remainingUsd: live.netUsd,
    advanceCapUsd: cap,
    advances: advances.map(
      (a): AdvanceDto => ({
        id: a.id,
        branchMemberId: a.branchMemberId,
        agentName: member.member.user.name,
        amountUsd: a.amountUsd,
        status: a.status,
        requestedAt: a.requestedAt.toISOString(),
        paidAt: a.paidAt?.toISOString() ?? null,
      }),
    ),
    leaves: leaves.map(
      (l): LeaveRequestDto => ({
        id: l.id,
        branchMemberId: l.branchMemberId,
        agentName: member.member.user.name,
        startDate: dateToYmdUtc(l.startDate),
        endDate: dateToYmdUtc(l.endDate),
        status: l.status,
        note: l.note,
      }),
    ),
    payslips: payslips.map((p) => ({
      id: p.id,
      periodLabel: monthLabelFr(p.period.year, p.period.month),
      netUsd: p.netUsd,
      netCdf: p.netCdf,
      status: p.period.status,
    })),
  };
}

export async function updateSettings(input: {
  branchId: string;
  defaultDailyRateUsd: number;
  workWeek: string[];
  notifyBeforeHour: number;
  advanceCapPct: number;
  justificationDays: number;
}) {
  await ensureBranchPayrollSettings(prisma, input.branchId);
  const rate = roundMoney(input.defaultDailyRateUsd);
  if (!(rate > 0)) throw new Error("Taux journalier invalide.");
  const cap = Number(input.advanceCapPct);
  if (!(cap > 0) || cap > 1) throw new Error("Plafond d’avance entre 0 et 100 %.");
  const hour = Math.floor(input.notifyBeforeHour);
  if (hour < 0 || hour > 23) throw new Error("Heure de cutoff invalide.");
  await prisma.branchPayrollSettings.update({
    where: { branchId: input.branchId },
    data: {
      defaultDailyRateUsd: rate,
      workWeek: parseWorkWeek(input.workWeek),
      notifyBeforeHour: hour,
      advanceCapPct: cap,
      justificationDays: Math.max(1, Math.floor(input.justificationDays)),
    },
  });
}

export async function updateStaffProfile(input: {
  branchId: string;
  branchMemberId: string;
  dailyRateUsd: number | null;
  payoutMethod: StaffPayoutMethod;
  mobileMoneyPhone?: string | null;
  bankName?: string | null;
  bankAccount?: string | null;
}) {
  await ensureStaffPayrollProfile(prisma, {
    branchId: input.branchId,
    branchMemberId: input.branchMemberId,
  });
  if (input.dailyRateUsd != null && !(input.dailyRateUsd > 0)) {
    throw new Error("Taux override invalide.");
  }
  await prisma.staffPayrollProfile.update({
    where: { branchMemberId: input.branchMemberId },
    data: {
      dailyRateUsd: input.dailyRateUsd,
      payoutMethod: input.payoutMethod,
      mobileMoneyPhone: input.mobileMoneyPhone?.trim() || null,
      bankName: input.bankName?.trim() || null,
      bankAccount: input.bankAccount?.trim() || null,
    },
  });
}

export async function getStaffProfile(branchId: string, branchMemberId: string) {
  const settings = await loadSettings(branchId);
  const row = await prisma.staffPayrollProfile.findUnique({
    where: { branchMemberId },
  });
  const member = await prisma.branchMember.findFirst({
    where: { id: branchMemberId, branchId },
    include: { member: { select: { user: { select: { name: true, phone: true } } } } },
  });
  if (!member) throw new Error("Agent introuvable.");
  return {
    agentName: member.member.user.name,
    defaultDailyRateUsd: settings.defaultDailyRateUsd,
    profile: {
      id: row?.id ?? "",
      branchMemberId,
      dailyRateUsd: row?.dailyRateUsd ?? null,
      effectiveDailyRateUsd: effectiveRate(row?.dailyRateUsd, settings.defaultDailyRateUsd),
      payoutMethod: row?.payoutMethod ?? "MOBILE_MONEY",
      mobileMoneyPhone: row?.mobileMoneyPhone ?? member.member.user.phone,
      bankName: row?.bankName ?? null,
      bankAccount: row?.bankAccount ?? null,
      active: row?.active ?? true,
    } satisfies StaffPayrollProfileDto,
  };
}

export async function runEndOfDayCron(now = new Date()) {
  const branches = await prisma.branch.findMany({
    where: { type: "BOUTIQUE", status: "ACTIVE" },
    select: { id: true, timezone: true },
  });
  let created = 0;
  let followUps = 0;
  for (const branch of branches) {
    const tz = branch.timezone || "Africa/Kinshasa";
    const parts = localParts(now, tz);
    if (parts.hour < 20) continue;
    await ensureCommercePayrollForBranch(prisma, branch.id);
    const settings = await loadSettings(branch.id);
    const ymd = todayYmd(tz, now);
    if (!isWorkday(parts.weekday, parseWorkWeek(settings.workWeek))) continue;
    const period = await ensureOpenPeriod(branch.id, parts.year, parts.month);
    if (period.status !== "OPEN") continue;
    const agents = await loadActiveAgents(branch.id, settings.defaultDailyRateUsd);
    for (const agent of agents) {
      const existing = await prisma.staffAttendanceDay.findUnique({
        where: {
          branchMemberId_workDate: {
            branchMemberId: agent.branchMemberId,
            workDate: ymdToDate(ymd),
          },
        },
      });
      if (existing) continue;
      await upsertAttendanceDay({
        branchId: branch.id,
        branchMemberId: agent.branchMemberId,
        workYmd: ymd,
        kind: "ABSENT",
        source: ATTENDANCE_SOURCE.CRON,
        timezone: tz,
        overwrite: false,
      });
      created += 1;
    }

    const followYmd = addDaysYmd(ymd, -2);
    const followRows = await prisma.staffAttendanceDay.findMany({
      where: {
        branchId: branch.id,
        workDate: ymdToDate(followYmd),
        kind: "ABSENT",
        payTreatment: "UNPAID",
        followUpNoticeSentAt: null,
        absenceNoticeSentAt: { not: null },
        period: { status: "OPEN" },
      },
      include: {
        branchMember: {
          include: {
            member: { select: { user: { select: { name: true, email: true, phone: true } } } },
          },
        },
      },
    });
    const fx = await getActiveExchangeRate(branch.id);
    for (const row of followRows) {
      const user = row.branchMember.member.user;
      await notifyUnpaidAbsence({
        branchId: branch.id,
        attendanceId: row.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        workYmd: followYmd,
        amountUsd: row.dailyRateUsd,
        amountCdfIndicative: usdToCdf(row.dailyRateUsd, fx?.rate ?? 0),
        isFollowUp: true,
      });
      await prisma.staffAttendanceDay.update({
        where: { id: row.id },
        data: { followUpNoticeSentAt: new Date() },
      });
      followUps += 1;
    }

    if (parts.day === 1) {
      await ensureOpenPeriod(branch.id, parts.year, parts.month);
    }
  }
  return { scanned: branches.length, created, followUps };
}

export { formatYmdFr };
