import { sendMail, isSmtpConfigured, getDefaultMailFrom } from "@/lib/email/mailer";
import { sendBranchWhatsAppMessage } from "@/lib/zindua";
import {
  branchContactLines,
  resolveNotificationBranch,
} from "@/lib/notifications/branch-context";
import { logNotification } from "@/lib/notifications/log";
import { formatYmdFr } from "@/lib/payroll/dates";
import { roundMoney } from "@/lib/payroll/constants";

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function notifyStaff(input: {
  branchId: string;
  refType: string;
  refId: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  subject: string;
  textLines: string[];
  html?: string;
}): Promise<void> {
  const branch = await resolveNotificationBranch({ branchId: input.branchId });
  const brand = branch.name;
  const contact = branchContactLines(branch);
  const text = [...input.textLines, ...contact, "", `— ${brand}`].join("\n");
  const html =
    input.html ??
    `<p>${input.textLines.map((l) => escapeHtml(l)).join("<br/>")}</p><p>— ${escapeHtml(brand)}</p>`;

  if (input.email?.trim() && isSmtpConfigured()) {
    try {
      await sendMail({
        from: getDefaultMailFrom(),
        to: input.email.trim(),
        subject: input.subject,
        text,
        html,
      });
      logNotification({
        channel: "email",
        status: "sent",
        refType: input.refType,
        refId: input.refId,
        branchId: branch.id,
        branchName: brand,
        to: input.email,
      });
    } catch {
      logNotification({
        channel: "email",
        status: "failed",
        refType: input.refType,
        refId: input.refId,
        branchId: branch.id,
        branchName: brand,
        to: input.email,
      });
    }
  } else if (!input.email?.trim()) {
    logNotification({
      channel: "email",
      status: "skipped",
      refType: input.refType,
      refId: input.refId,
      branchId: branch.id,
      reason: "no_email",
    });
  }

  if (input.phone?.trim()) {
    const wa = await sendBranchWhatsAppMessage({
      to: input.phone,
      name: input.name,
      branchName: brand,
      parts: input.textLines,
    });
    logNotification({
      channel: "whatsapp",
      status: wa ? "sent" : "failed",
      refType: input.refType,
      refId: input.refId,
      branchId: branch.id,
      branchName: brand,
      to: input.phone,
    });
  } else {
    logNotification({
      channel: "whatsapp",
      status: "skipped",
      refType: input.refType,
      refId: input.refId,
      branchId: branch.id,
      reason: "no_phone",
    });
  }
}

export async function notifyUnpaidAbsence(input: {
  branchId: string;
  attendanceId: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  workYmd: string;
  amountUsd: number;
  amountCdfIndicative: number;
  isFollowUp?: boolean;
}): Promise<void> {
  const branch = await resolveNotificationBranch({ branchId: input.branchId });
  const dateLabel = formatYmdFr(input.workYmd);
  const usd = roundMoney(input.amountUsd).toFixed(2);
  const cdf = Math.round(input.amountCdfIndicative).toLocaleString("fr-FR");
  const subject = `${branch.name} — Absence du ${dateLabel}`;
  const lead = input.isFollowUp
    ? `Rappel : votre absence du ${dateLabel} n’est toujours pas justifiée.`
    : `Vous avez été marqué(e) absent(e) le ${dateLabel}.`;
  await notifyStaff({
    branchId: input.branchId,
    refType: input.isFollowUp ? "payroll_absence_followup" : "payroll_absence",
    refId: input.attendanceId,
    name: input.name,
    email: input.email,
    phone: input.phone,
    subject,
    textLines: [
      `Bonjour ${input.name},`,
      lead,
      `${usd} USD (≈ ${cdf} CDF, à titre indicatif) seront déduits de votre paie si l’absence n’est pas justifiée.`,
      "Connectez-vous à « Mes jours » pour envoyer un justificatif.",
    ],
  });
}

export async function notifyJustificationDecision(input: {
  branchId: string;
  attendanceId: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  workYmd: string;
  accepted: boolean;
  amountUsd: number;
}): Promise<void> {
  const branch = await resolveNotificationBranch({ branchId: input.branchId });
  const dateLabel = formatYmdFr(input.workYmd);
  const usd = roundMoney(input.amountUsd).toFixed(2);
  if (input.accepted) {
    await notifyStaff({
      branchId: input.branchId,
      refType: "payroll_justification_accepted",
      refId: input.attendanceId,
      name: input.name,
      email: input.email,
      phone: input.phone,
      subject: `${branch.name} — Justificatif accepté (${dateLabel})`,
      textLines: [
        `Bonjour ${input.name},`,
        `Votre justificatif pour le ${dateLabel} a été accepté.`,
        "Le jour est conservé (payé). L’absence reste au dossier.",
      ],
    });
    return;
  }
  await notifyStaff({
    branchId: input.branchId,
    refType: "payroll_justification_rejected",
    refId: input.attendanceId,
    name: input.name,
    email: input.email,
    phone: input.phone,
    subject: `${branch.name} — Justificatif refusé (${dateLabel})`,
    textLines: [
      `Bonjour ${input.name},`,
      `Votre justificatif pour le ${dateLabel} a été refusé.`,
      `Confirmation : ${usd} USD seront déduits de votre bulletin.`,
    ],
  });
}

export async function notifyAdvancePaid(input: {
  branchId: string;
  advanceId: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  amountUsd: number;
  remainingUsd: number;
}): Promise<void> {
  const branch = await resolveNotificationBranch({ branchId: input.branchId });
  const amt = roundMoney(input.amountUsd).toFixed(2);
  const rest = roundMoney(input.remainingUsd).toFixed(2);
  await notifyStaff({
    branchId: input.branchId,
    refType: "payroll_advance_paid",
    refId: input.advanceId,
    name: input.name,
    email: input.email,
    phone: input.phone,
    subject: `${branch.name} — Avance versée (${amt} USD)`,
    textLines: [
      `Bonjour ${input.name},`,
      `Une avance de ${amt} USD a été versée.`,
      `Net restant estimé ce mois : ${rest} USD.`,
    ],
  });
}

export async function notifyPayslipIssued(input: {
  branchId: string;
  payslipId: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  periodLabel: string;
  grossUsd: number;
  absenceUsd: number;
  advancesUsd: number;
  netUsd: number;
  netCdf: number;
  payoutHint?: string | null;
}): Promise<void> {
  const branch = await resolveNotificationBranch({ branchId: input.branchId });
  const net = roundMoney(input.netUsd).toFixed(2);
  const cdf = Math.round(input.netCdf).toLocaleString("fr-FR");
  await notifyStaff({
    branchId: input.branchId,
    refType: "payroll_payslip",
    refId: input.payslipId,
    name: input.name,
    email: input.email,
    phone: input.phone,
    subject: `${branch.name} — Bulletin ${input.periodLabel}`,
    textLines: [
      `Bonjour ${input.name},`,
      `Votre bulletin ${input.periodLabel} est disponible.`,
      `Brut ${roundMoney(input.grossUsd).toFixed(2)} USD`,
      `− Absences ${roundMoney(input.absenceUsd).toFixed(2)} USD`,
      `− Avances ${roundMoney(input.advancesUsd).toFixed(2)} USD`,
      `Net à verser ${net} USD (${cdf} CDF)`,
      input.payoutHint ? `Versement : ${input.payoutHint}` : null,
      "Vérifiez-le dans « Mes jours » avant le virement.",
    ].filter((l): l is string => Boolean(l)),
  });
}

export async function notifySalaryPaid(input: {
  branchId: string;
  payslipId: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  netUsd: number;
  reference?: string | null;
  methodLabel?: string | null;
}): Promise<void> {
  const branch = await resolveNotificationBranch({ branchId: input.branchId });
  const net = roundMoney(input.netUsd).toFixed(2);
  await notifyStaff({
    branchId: input.branchId,
    refType: "payroll_salary_paid",
    refId: input.payslipId,
    name: input.name,
    email: input.email,
    phone: input.phone,
    subject: `${branch.name} — Salaire versé (${net} USD)`,
    textLines: [
      `Bonjour ${input.name},`,
      `Votre salaire de ${net} USD a été versé.`,
      input.methodLabel ? `Moyen : ${input.methodLabel}` : null,
      input.reference ? `Référence : ${input.reference}` : null,
    ].filter((l): l is string => Boolean(l)),
  });
}
