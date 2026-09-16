import { sendBranchWhatsAppMessage } from "@/lib/klambo-whatsapp";
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

export async function notifyFactoryOrderRequestCreated(input: {
  branchId: string;
  requestId: string;
  customerName: string;
  phone?: string | null;
  qtyLabel: string;
  href?: string;
}) {
  await send({
    branchId: input.branchId,
    refType: "factory_order_request",
    refId: input.requestId,
    phone: input.phone,
    name: input.customerName,
    parts: [
      `Demande reçue : ${input.qtyLabel}.`,
      "Le marketeur la validera avant livraison.",
    ],
  });

  const { default: prisma } = await import("@/lib/prisma");
  await prisma.branchNotification.create({
    data: {
      branchId: input.branchId,
      title: "Nouvelle demande affilié",
      body: `${input.customerName} · ${input.qtyLabel}`,
      kind: "usine_demande",
      href: input.href ?? null,
    },
  });
}

export async function notifyFactoryOrderRequestApproved(input: {
  branchId: string;
  requestId: string;
  customerName: string;
  phone?: string | null;
  creditNumber: string;
  qtyLabel: string;
}) {
  await send({
    branchId: input.branchId,
    refType: "factory_order_request_approved",
    refId: input.requestId,
    phone: input.phone,
    name: input.customerName,
    parts: [
      `Demande validée · crédit ${input.creditNumber}.`,
      input.qtyLabel,
      "Livraison à planifier avec le marketeur.",
    ],
  });
}

export async function notifyFactoryOrderRequestRejected(input: {
  branchId: string;
  requestId: string;
  customerName: string;
  phone?: string | null;
  reason: string;
}) {
  await send({
    branchId: input.branchId,
    refType: "factory_order_request_rejected",
    refId: input.requestId,
    phone: input.phone,
    name: input.customerName,
    parts: [
      "Demande refusée.",
      input.reason.trim() ? `Motif : ${input.reason.trim()}` : null,
    ],
  });
}

/** Bienvenue après enregistrement fiche affilié (sans compte). */
export async function notifyFactoryCustomerWelcome(input: {
  branchId: string;
  customerId: string;
  customerName: string;
  phone?: string | null;
  companyName?: string | null;
}) {
  await send({
    branchId: input.branchId,
    refType: "factory_customer_welcome",
    refId: input.customerId,
    phone: input.phone,
    name: input.customerName,
    parts: [
      input.companyName
        ? `Bienvenue ${input.companyName}.`
        : `Bienvenue ${input.customerName}.`,
      "Vous êtes enregistré comme client affilié.",
      "Vous recevrez les infos crédit, échéances et livraisons sur WhatsApp.",
    ],
  });
}

/** Accès portail pour un compte déjà existant (lien sans nouveau MDP). */
export async function notifyFactoryAffiliatePortalAccess(input: {
  branchId: string;
  customerId: string;
  customerName: string;
  phone?: string | null;
  email: string;
  portalUrl: string;
}) {
  await send({
    branchId: input.branchId,
    refType: "factory_affiliate_portal",
    refId: input.customerId,
    phone: input.phone,
    name: input.customerName,
    parts: [
      `Bonjour ${input.customerName},`,
      "Votre accès affilié est prêt.",
      `Email : ${input.email}`,
      `Portail : ${input.portalUrl}`,
    ],
  });
}
