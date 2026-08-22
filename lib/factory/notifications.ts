import { sendBranchWhatsAppMessage } from "@/lib/zindua";
import { resolveNotificationBranch } from "@/lib/notifications/branch-context";
import { logNotification } from "@/lib/notifications/log";

function formatDate(d: Date) {
  return d.toLocaleDateString("fr-CD", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

async function send(input: {
  branchId: string;
  refType: string;
  refId: string;
  phone?: string | null;
  name?: string | null;
  parts: Array<string | null | undefined>;
}) {
  if (!input.phone?.trim()) {
    logNotification({
      channel: "whatsapp",
      status: "skipped",
      refType: input.refType,
      refId: input.refId,
      branchId: input.branchId,
      reason: "no_phone",
    });
    return;
  }
  const branch = await resolveNotificationBranch({ branchId: input.branchId });
  try {
    const wa = await sendBranchWhatsAppMessage({
      to: input.phone,
      name: input.name,
      branchName: branch.name,
      parts: input.parts,
    });
    logNotification({
      channel: "whatsapp",
      status: wa ? "sent" : "failed",
      refType: input.refType,
      refId: input.refId,
      branchId: input.branchId,
    });
  } catch {
    logNotification({
      channel: "whatsapp",
      status: "failed",
      refType: input.refType,
      refId: input.refId,
      branchId: input.branchId,
    });
  }
}

export async function notifyFactoryCreditCreated(input: {
  branchId: string;
  creditId: string;
  number: string;
  customerName: string;
  phone?: string | null;
  qtyLabel: string;
  totalUsd: number;
  dueAt: Date;
}) {
  await send({
    branchId: input.branchId,
    refType: "factory_credit",
    refId: input.creditId,
    phone: input.phone,
    name: input.customerName,
    parts: [
      `Bonjour ${input.customerName},`,
      `${input.qtyLabel} · ${input.totalUsd.toFixed(2)} USD`,
      `à payer le ${formatDate(input.dueAt)}.`,
      `Crédit ${input.number}.`,
    ],
  });
}

export async function notifyFactoryCreditPayment(input: {
  branchId: string;
  creditId: string;
  number: string;
  customerName: string;
  phone?: string | null;
  kind: string;
  amountUsd: number;
  remainingUsd: number;
  dueAt: Date;
  settled: boolean;
}) {
  const kindLabel =
    input.kind === "ACOMPTE"
      ? "acompte"
      : input.kind === "SOLDE"
        ? "solde"
        : "complément";
  await send({
    branchId: input.branchId,
    refType: "factory_credit_pay",
    refId: input.creditId,
    phone: input.phone,
    name: input.customerName,
    parts: input.settled
      ? [
          `Crédit ${input.number} soldé. Merci.`,
          "Vous pouvez réserver du stock auprès du marketeur.",
        ]
      : [
          `Paiement ${kindLabel} ${input.amountUsd.toFixed(2)} USD reçu.`,
          `Restant ${input.remainingUsd.toFixed(2)} USD.`,
          `Échéance ${formatDate(input.dueAt)}.`,
        ],
  });
}

export async function notifyFactoryCreditExtension(input: {
  branchId: string;
  creditId: string;
  number: string;
  customerName: string;
  phone?: string | null;
  newDueAt: Date;
  reason: string;
}) {
  await send({
    branchId: input.branchId,
    refType: "factory_credit_extend",
    refId: input.creditId,
    phone: input.phone,
    name: input.customerName,
    parts: [
      `Crédit ${input.number} : nouvelle échéance ${formatDate(input.newDueAt)}.`,
      input.reason.trim() ? `Motif : ${input.reason.trim()}` : null,
    ],
  });
}

export async function notifyFactoryCreditReminder(input: {
  branchId: string;
  creditId: string;
  number: string;
  customerName: string;
  phone?: string | null;
  remainingUsd: number;
  dueAt: Date;
}) {
  await send({
    branchId: input.branchId,
    refType: "factory_credit_reminder",
    refId: input.creditId,
    phone: input.phone,
    name: input.customerName,
    parts: [
      `Rappel : solde ${input.remainingUsd.toFixed(2)} USD`,
      `dû le ${formatDate(input.dueAt)} (crédit ${input.number}).`,
    ],
  });
}

export async function notifyFactoryReservation(input: {
  branchId: string;
  reservationId: string;
  customerName: string;
  phone?: string | null;
  qtyLabel: string;
  holdUntil: Date;
  expired?: boolean;
}) {
  await send({
    branchId: input.branchId,
    refType: "factory_reservation",
    refId: input.reservationId,
    phone: input.phone,
    name: input.customerName,
    parts: input.expired
      ? ["Réservation expirée, stock libéré."]
      : [
          `Réservation ${input.qtyLabel}`,
          `jusqu’au ${formatDate(input.holdUntil)}.`,
        ],
  });
}
