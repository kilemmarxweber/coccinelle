import {
  DEFAULT_ADVANCE_CAP_PCT,
  DEFAULT_DAILY_RATE_USD,
  DEFAULT_JUSTIFICATION_DAYS,
  DEFAULT_NOTIFY_BEFORE_HOUR,
  DEFAULT_WORK_WEEK,
} from "@/lib/payroll/constants";

export function isCommerceBranchType(type: string | null | undefined): boolean {
  return (type ?? "").toUpperCase() === "BOUTIQUE";
}

type PayrollDb = {
  branch: {
    findUnique: (args: {
      where: { id: string };
      select: { type: true };
    }) => Promise<{ type: string } | null>;
  };
  branchPayrollSettings: {
    upsert: (args: {
      where: { branchId: string };
      create: {
        branchId: string;
        defaultDailyRateUsd: number;
        workWeek: string[];
        notifyBeforeHour: number;
        advanceCapPct: number;
        justificationDays: number;
      };
      update: Record<string, never>;
    }) => Promise<unknown>;
  };
  staffPayrollProfile: {
    findUnique: (args: {
      where: { branchMemberId: string };
      select: { id: true };
    }) => Promise<{ id: string } | null>;
    create: (args: {
      data: {
        branchId: string;
        branchMemberId: string;
        dailyRateUsd: null;
        payoutMethod: "MOBILE_MONEY";
        mobileMoneyPhone: string | null;
        active: boolean;
      };
    }) => Promise<unknown>;
  };
  branchMember: {
    findMany: (args: {
      where: { branchId: string; status: "ACTIVE" };
      select: {
        id: true;
        member: { select: { user: { select: { phone: true } } } };
      };
    }) => Promise<
      Array<{ id: string; member: { user: { phone: string | null } } }>
    >;
  };
};

export async function ensureBranchPayrollSettings(
  db: PayrollDb,
  branchId: string,
): Promise<void> {
  const branch = await db.branch.findUnique({
    where: { id: branchId },
    select: { type: true },
  });
  if (!branch || !isCommerceBranchType(branch.type)) return;
  await db.branchPayrollSettings.upsert({
    where: { branchId },
    create: {
      branchId,
      defaultDailyRateUsd: DEFAULT_DAILY_RATE_USD,
      workWeek: [...DEFAULT_WORK_WEEK],
      notifyBeforeHour: DEFAULT_NOTIFY_BEFORE_HOUR,
      advanceCapPct: DEFAULT_ADVANCE_CAP_PCT,
      justificationDays: DEFAULT_JUSTIFICATION_DAYS,
    },
    update: {},
  });
}

export async function ensureStaffPayrollProfile(
  db: Pick<PayrollDb, "staffPayrollProfile">,
  input: { branchId: string; branchMemberId: string; phone?: string | null },
): Promise<void> {
  const existing = await db.staffPayrollProfile.findUnique({
    where: { branchMemberId: input.branchMemberId },
    select: { id: true },
  });
  if (existing) return;
  await db.staffPayrollProfile.create({
    data: {
      branchId: input.branchId,
      branchMemberId: input.branchMemberId,
      dailyRateUsd: null,
      payoutMethod: "MOBILE_MONEY",
      mobileMoneyPhone: input.phone?.trim() || null,
      active: true,
    },
  });
}

export async function ensureCommercePayrollForBranch(
  db: PayrollDb,
  branchId: string,
): Promise<void> {
  await ensureBranchPayrollSettings(db, branchId);
  const members = await db.branchMember.findMany({
    where: { branchId, status: "ACTIVE" },
    select: {
      id: true,
      member: { select: { user: { select: { phone: true } } } },
    },
  });
  for (const m of members) {
    await ensureStaffPayrollProfile(db, {
      branchId,
      branchMemberId: m.id,
      phone: m.member.user.phone,
    });
  }
}
