import { sendMail, isSmtpConfigured, getDefaultMailFrom } from "@/lib/email/mailer";
import { sendBranchWhatsAppMessage } from "@/lib/zindua";
import { resolveNotificationBranch } from "@/lib/notifications/branch-context";
import { logNotification } from "@/lib/notifications/log";

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export async function sendStayCheckoutThanksNotification(input: {
  branchId: string;
  stayId: string;
  guestName: string;
  guestPhone?: string | null;
  guestEmail?: string | null;
}): Promise<void> {
  const branch = await resolveNotificationBranch({ branchId: input.branchId });
  const brand = branch.name;
  const subject = `${brand} — Merci pour votre passage`;
  const text = [
    `Bonjour ${input.guestName},`,
    "",
    `Merci pour votre passage à ${brand}.`,
    "Nous espérons vous revoir bientôt.",
    "",
    `— ${brand}`,
  ].join("\n");

  if (input.guestEmail?.trim() && isSmtpConfigured()) {
    try {
      await sendMail({
        from: getDefaultMailFrom(),
        to: input.guestEmail.trim(),
        subject,
        text,
        html: `<p>Bonjour ${escapeHtml(input.guestName)},</p><p>Merci pour votre passage à <strong>${escapeHtml(brand)}</strong>.</p><p>— ${escapeHtml(brand)}</p>`,
      });
      logNotification({
        channel: "email",
        status: "sent",
        refType: "stay_checkout_thanks",
        refId: input.stayId,
        branchId: branch.id,
        branchName: brand,
        to: input.guestEmail,
      });
    } catch (err) {
      logNotification({
        channel: "email",
        status: "failed",
        refType: "stay_checkout_thanks",
        refId: input.stayId,
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
        `merci pour votre passage à ${brand}.`,
        "Nous espérons vous revoir bientôt.",
      ],
    });
    logNotification({
      channel: "whatsapp",
      status: wa ? "sent" : "failed",
      refType: "stay_checkout_thanks",
      refId: input.stayId,
      branchId: branch.id,
      branchName: brand,
      to: input.guestPhone,
    });
  }
}
