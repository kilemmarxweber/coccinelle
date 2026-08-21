export type AttendanceKind =
  | "PRESENT"
  | "ABSENT"
  | "ABSENT_NOTIFIED"
  | "LEAVE"
  | "REST";

export type PayTreatment = "PAID" | "UNPAID" | "NONE";

export type JustificationStatus = "PENDING" | "ACCEPTED" | "REJECTED";

export type AdvanceStatus =
  | "REQUESTED"
  | "APPROVED"
  | "PAID"
  | "REJECTED"
  | "CANCELLED";

export type StaffPayoutMethod = "MOBILE_MONEY" | "BANK" | "CASH";

export type PayrollPeriodStatus = "OPEN" | "REVIEW" | "LOCKED" | "PAID";

export type LeaveRequestStatus =
  | "REQUESTED"
  | "APPROVED"
  | "REJECTED"
  | "CANCELLED";

export type PayrollCapabilities = {
  canView: boolean;
  canPoint: boolean;
  canManage: boolean;
  canPay: boolean;
  isSelfOnly: boolean;
};

export type PayrollSettingsDto = {
  defaultDailyRateUsd: number;
  workWeek: string[];
  notifyBeforeHour: number;
  advanceCapPct: number;
  justificationDays: number;
};

export type StaffPayrollProfileDto = {
  id: string;
  branchMemberId: string;
  dailyRateUsd: number | null;
  effectiveDailyRateUsd: number;
  payoutMethod: StaffPayoutMethod;
  mobileMoneyPhone: string | null;
  bankName: string | null;
  bankAccount: string | null;
  active: boolean;
};

export type AgentRow = {
  branchMemberId: string;
  userId: string;
  name: string;
  email: string;
  phone: string | null;
  opsRole: string;
  profile: StaffPayrollProfileDto;
};

export type AttendanceDto = {
  id: string;
  branchMemberId: string;
  workDate: string;
  kind: AttendanceKind;
  payTreatment: PayTreatment;
  dailyRateUsd: number;
  justificationStatus: JustificationStatus | null;
  justificationNote: string | null;
  source: string;
  payLabel: string;
};

export type PeriodDto = {
  id: string;
  year: number;
  month: number;
  status: PayrollPeriodStatus;
  exchangeRateUsed: number | null;
  closedAt: string | null;
  paidAt: string | null;
  label: string;
};

export type LeaveRequestDto = {
  id: string;
  branchMemberId: string;
  agentName: string;
  startDate: string;
  endDate: string;
  status: LeaveRequestStatus;
  note: string | null;
};

export type AdvanceDto = {
  id: string;
  branchMemberId: string;
  agentName: string;
  amountUsd: number;
  status: AdvanceStatus;
  requestedAt: string;
  paidAt: string | null;
};

export type PayslipLineDay = {
  date: string;
  kind: AttendanceKind;
  payTreatment: PayTreatment;
  amountUsd: number;
  label: string;
};

export type PayslipLineAdvance = {
  date: string;
  amountUsd: number;
};

export type PayslipLines = {
  days: PayslipLineDay[];
  advances: PayslipLineAdvance[];
};

export type PayslipDto = {
  id: string;
  branchMemberId: string;
  agentName: string;
  periodId: string;
  dailyRateUsd: number;
  expectedDays: number;
  unpaidAbsenceDays: number;
  grossUsd: number;
  absenceDeductionUsd: number;
  advancesUsd: number;
  netUsd: number;
  netCdf: number;
  exchangeRateUsed: number;
  lines: PayslipLines;
  expenseId: string | null;
  sentAt: string | null;
};

export type MonthAgentSummary = {
  branchMemberId: string;
  name: string;
  dailyRateUsd: number;
  expectedDays: number;
  presentDays: number;
  leaveDays: number;
  notifiedDays: number;
  justifiedDays: number;
  unpaidDays: number;
  grossUsd: number;
  absenceDeductionUsd: number;
  advancesUsd: number;
  netUsd: number;
  payoutMethod: StaffPayoutMethod;
  payoutReady: boolean;
  payslip: PayslipDto | null;
};
