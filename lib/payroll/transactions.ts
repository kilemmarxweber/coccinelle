import prisma from "@/lib/prisma";
import { normalizeUsdCdfRate } from "@/lib/cash/exchange";
import { monthLabelFr } from "@/lib/payroll/dates";
import { usdToCdf } from "@/lib/payroll/engine";
import { roundMoney } from "@/lib/payroll/constants";
import type {
  PayrollPeriodStatus,
  PayrollTransactionDto,
  PayrollTransactionKind,
} from "@/lib/payroll/types";

const PAYROLL_KINDS: PayrollTransactionKind[] = ["SALAIRE", "AVANCE_SALAIRE"];

async function getActiveExchangeRate(branchId: string) {
  const row = await prisma.exchangeRate.findFirst({
    where: { branchId },
    orderBy: { validFrom: "desc" },
  });
  return normalizeUsdCdfRate(row);
}

function dayRange(isoDate: string) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const start = new Date(Date.UTC(year!, month! - 1, day!));
  const endExclusive = new Date(Date.UTC(year!, month! - 1, day! + 1));
  return { gte: start, lt: endExclusive };
}

function periodRange(startDate: string, endDate: string) {
  const start = dayRange(startDate).gte;
  const endExclusive = dayRange(endDate).lt;
  return { gte: start, lt: endExclusive };
}

export async function listPayrollTransactions(input: {
  branchId: string;
  mode?: "day" | "all" | "period";
  day?: string;
  startDate?: string;
  endDate?: string;
  kind?: PayrollTransactionKind;
  search?: string;
}): Promise<PayrollTransactionDto[]> {
  const mode = input.mode ?? "day";
  let createdAt: { gte: Date; lt: Date } | undefined;
  if (mode === "day" && input.day) createdAt = dayRange(input.day);
  if (mode === "period") {
    if (!input.startDate || !input.endDate) {
      throw new Error("Indiquez une date de début et une date de fin.");
    }
    if (input.startDate > input.endDate) {
      throw new Error("La date de début doit précéder la date de fin.");
    }
    createdAt = periodRange(input.startDate, input.endDate);
  }

  const search = input.search?.trim();
  const rows = await prisma.branchExpense.findMany({
    where: {
      branchId: input.branchId,
      kind: input.kind ?? { in: PAYROLL_KINDS },
      ...(createdAt ? { createdAt } : {}),
      ...(search
        ? {
            OR: [
              { number: { contains: search, mode: "insensitive" } },
              { label: { contains: search, mode: "insensitive" } },
              { beneficiary: { contains: search, mode: "insensitive" } },
              { note: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: {
      payment: {
        select: { id: true, receiptNumber: true, method: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: mode === "day" ? 300 : 500,
  });

  const expenseIds = rows.map((r) => r.id);
  const [payslips, advances] = await Promise.all([
    prisma.payslip.findMany({
      where: { branchId: input.branchId, expenseId: { in: expenseIds } },
      select: {
        id: true,
        expenseId: true,
        period: { select: { year: true, month: true, status: true } },
        branchMember: {
          select: { member: { select: { user: { select: { name: true } } } } },
        },
      },
    }),
    prisma.staffSalaryAdvance.findMany({
      where: { branchId: input.branchId, expenseId: { in: expenseIds } },
      select: {
        id: true,
        expenseId: true,
        period: { select: { year: true, month: true, status: true } },
        branchMember: {
          select: { member: { select: { user: { select: { name: true } } } } },
        },
      },
    }),
  ]);
  const byExpensePayslip = new Map(payslips.map((p) => [p.expenseId, p]));
  const byExpenseAdvance = new Map(advances.map((a) => [a.expenseId, a]));

  return rows.map((row): PayrollTransactionDto => {
    const kind = (row.kind === "AVANCE_SALAIRE" ? "AVANCE_SALAIRE" : "SALAIRE") as
      PayrollTransactionKind;
    const slip = byExpensePayslip.get(row.id);
    const adv = byExpenseAdvance.get(row.id);
    const period = slip?.period ?? adv?.period ?? null;
    const agentName =
      slip?.branchMember.member.user.name ??
      adv?.branchMember.member.user.name ??
      row.beneficiary;
    return {
      id: row.id,
      kind,
      number: row.number,
      label: row.label,
      beneficiary: row.beneficiary,
      amountUsd: row.amountUsd,
      note: row.note,
      createdAt: row.createdAt.toISOString(),
      paymentId: row.payment?.id ?? null,
      receiptNumber: row.payment?.receiptNumber ?? null,
      method: row.payment?.method ?? null,
      agentName,
      payslipId: slip?.id ?? null,
      advanceId: adv?.id ?? null,
      periodLabel: period ? monthLabelFr(period.year, period.month) : null,
      periodStatus: (period?.status as PayrollPeriodStatus | undefined) ?? null,
    };
  });
}

export async function updatePayrollTransaction(input: {
  branchId: string;
  expenseId: string;
  amountUsd?: number;
  note?: string | null;
  method?: "CASH" | "MOBILE_MONEY" | "BANK";
}) {
  const expense = await prisma.branchExpense.findFirst({
    where: { id: input.expenseId, branchId: input.branchId },
    include: { payment: true },
  });
  if (!expense || !PAYROLL_KINDS.includes(expense.kind as PayrollTransactionKind)) {
    throw new Error("Transaction introuvable.");
  }

  const nextAmount =
    input.amountUsd != null ? roundMoney(input.amountUsd) : expense.amountUsd;
  if (!(nextAmount > 0)) throw new Error("Montant invalide.");

  if (expense.kind === "SALAIRE" && input.amountUsd != null) {
    throw new Error(
      "Le montant d’un salaire suit le bulletin. Supprimez la transaction pour re-verser.",
    );
  }

  if (expense.kind === "AVANCE_SALAIRE" && input.amountUsd != null) {
    const advance = await prisma.staffSalaryAdvance.findFirst({
      where: { expenseId: expense.id, branchId: input.branchId },
      include: { period: { select: { status: true } } },
    });
    if (!advance) throw new Error("Avance liée introuvable.");
    if (advance.period.status === "LOCKED" || advance.period.status === "PAID") {
      throw new Error("Période clôturée : impossible de modifier le montant.");
    }
  }

  const rate = await getActiveExchangeRate(input.branchId);
  const rateVal = rate?.rate && rate.rate > 0 ? rate.rate : 1;
  const method = input.method ?? expense.payment?.method ?? undefined;

  await prisma.$transaction(async (tx) => {
    await tx.branchExpense.update({
      where: { id: expense.id },
      data: {
        amountUsd: nextAmount,
        note: input.note === undefined ? expense.note : input.note,
      },
    });
    if (expense.payment) {
      await tx.payment.update({
        where: { id: expense.payment.id },
        data: {
          amountForeign: -nextAmount,
          amountCdf: usdToCdf(-nextAmount, rateVal),
          ...(method ? { method } : {}),
        },
      });
    }
    if (expense.kind === "AVANCE_SALAIRE" && input.amountUsd != null) {
      await tx.staffSalaryAdvance.updateMany({
        where: { expenseId: expense.id, branchId: input.branchId },
        data: { amountUsd: nextAmount },
      });
    }
  });
}

export async function deletePayrollTransaction(input: {
  branchId: string;
  expenseId: string;
}) {
  const expense = await prisma.branchExpense.findFirst({
    where: { id: input.expenseId, branchId: input.branchId },
    include: { payment: true },
  });
  if (!expense || !PAYROLL_KINDS.includes(expense.kind as PayrollTransactionKind)) {
    throw new Error("Transaction introuvable.");
  }

  await prisma.$transaction(async (tx) => {
    if (expense.kind === "SALAIRE") {
      const slips = await tx.payslip.findMany({
        where: { expenseId: expense.id, branchId: input.branchId },
        select: { id: true, periodId: true },
      });
      await tx.payslip.updateMany({
        where: { expenseId: expense.id, branchId: input.branchId },
        data: { expenseId: null },
      });
      const periodIds = [...new Set(slips.map((s) => s.periodId))];
      for (const periodId of periodIds) {
        const remaining = await tx.payslip.count({
          where: { periodId, expenseId: { not: null } },
        });
        if (remaining === 0) {
          await tx.payrollPeriod.update({
            where: { id: periodId },
            data: { status: "LOCKED", paidAt: null },
          });
        }
      }
    } else {
      await tx.staffSalaryAdvance.updateMany({
        where: { expenseId: expense.id, branchId: input.branchId },
        data: { status: "APPROVED", expenseId: null, paidAt: null },
      });
    }
    if (expense.payment) {
      await tx.payment.delete({ where: { id: expense.payment.id } });
    }
    await tx.branchExpense.delete({ where: { id: expense.id } });
  });
}
