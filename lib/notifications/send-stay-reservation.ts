import { sendMail, isSmtpConfigured, getDefaultMailFrom } from "@/lib/email/mailer";
import { sendBranchWhatsAppMessage } from "@/lib/zindua";
import {
  branchContactLines,
  resolveNotificationBranch,
} from "@/lib/notifications/branch-context";
import { logNotification } from "@/lib/notifications/log";
import { HOTEL_CHECKOUT_HOUR } from "@/lib/hotel/constants";

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatDay(isoOrDate: string | Date): string {
  const d =
    isoOrDate instanceof Date ? isoOrDate : new Date(`${isoOrDate.slice(0, 10)}T12:00:00`);
  return d.toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export async function sendStayReservationNotification(input: {
  branchId: string;
  stayId?: string | null;
  guestName: string;
  guestPhone?: string | null;
  guestEmail?: string | null;
  checkInDate: string | Date;
  checkOutDate: string | Date;
  roomLabel: string;
}): Promise<void> {
  const branch = await resolveNotificationBranch({ branchId: input.branchId });
  const brand = branch.name;
  const inLabel = formatDay(input.checkInDate);
  const outLabel = formatDay(input.checkOutDate);
  const contact = branchContactLines(branch);

  const subject = `${brand} — Confirmation de réservation`;
  const text = [
    `Bonjour ${input.guestName},`,
    "",
    `Votre réservation à ${brand} est confirmée.`,
    `Espace : ${input.roomLabel}`,
    `Arrivée : ${inLabel}`,
    `Départ : ${outLabel} (sortie prévue ${HOTEL_CHECKOUT_HOUR}h)`,
    ...contact,
    "",
    "À bientôt.",
    `— ${brand}`,
  ].join("\n");

  const html = `
    <p>Bonjour ${escapeHtml(input.guestName)},</p>
    <p>Votre réservation à <strong>${escapeHtml(brand)}</strong> est confirmée.</p>
    <ul>
      <li><strong>Espace</strong> : ${escapeHtml(input.roomLabel)}</li>
      <li><strong>Arrivée</strong> : ${escapeHtml(inLabel)}</li>
      <li><strong>Départ</strong> : ${escapeHtml(outLabel)} (sortie prévue ${HOTEL_CHECKOUT_HOUR}h)</li>
    </ul>
    <p>— ${escapeHtml(brand)}</p>
  `;

  if (input.guestEmail?.trim() && isSmtpConfigured()) {
    try {
      await sendMail({
        from: getDefaultMailFrom(),
        to: input.guestEmail.trim(),
        subject,
        text,
        html,
      });
      logNotification({
        channel: "email",
        status: "sent",
        refType: "stay_reservation",
        refId: input.stayId,
        branchId: branch.id,
        branchName: brand,
        to: input.guestEmail,
      });
    } catch (err) {
      logNotification({
        channel: "email",
        status: "failed",
        refType: "stay_reservation",
        refId: input.stayId,
        branchId: branch.id,
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }

  if (input.guestPhone?.trim()) {
    const wa = await sendBranchWhatsAppMessage({
      to: input.guestPhone,
      name: input.guestName,
      branchName: brand,
      parts: [
        `Bonjour ${input.guestName},`,
        `réservation confirmée à ${brand}.`,
        `${input.roomLabel}.`,
        `Arrivée ${inLabel}.`,
        `Départ ${outLabel} (${HOTEL_CHECKOUT_HOUR}h).`,
        ...contact,
      ],
    });
    logNotification({
      channel: "whatsapp",
      status: wa ? "sent" : "failed",
      refType: "stay_reservation",
      refId: input.stayId,
      branchId: branch.id,
      branchName: brand,
      to: input.guestPhone,
    });
  }
}
