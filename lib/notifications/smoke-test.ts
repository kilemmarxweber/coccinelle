"use server";

import { isSmtpConfigured, sendMail, getDefaultMailFrom } from "@/lib/email/mailer";
import {
  isZinduaConfigured,
  sendBranchWhatsAppMessage,
} from "@/lib/zindua";

/**
 * Smoke test SMTP + Zindua (dev / admin).
 * Ne pas exposer en UI publique.
 */
export async function sendNotificationSmokeTestAction(input: {
  email?: string | null;
  phone?: string | null;
  branchName?: string | null;
}): Promise<{
  ok: true;
  smtp: boolean;
  zindua: boolean;
  emailSent: boolean;
  whatsappSent: boolean;
}> {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_NOTIF_SMOKE !== "1") {
    throw new Error("Smoke test désactivé en production.");
  }

  const brand = input.branchName?.trim() || process.env.APP_NAME || "Coccinelle";
  let emailSent = false;
  let whatsappSent = false;

  if (input.email?.trim() && isSmtpConfigured()) {
    await sendMail({
      from: getDefaultMailFrom(),
      to: input.email.trim(),
      subject: `${brand} — Smoke test email`,
      text: `Test SMTP Coccinelle depuis ${brand}.`,
    });
    emailSent = true;
  }

  if (input.phone?.trim() && isZinduaConfigured()) {
    const wa = await sendBranchWhatsAppMessage({
      to: input.phone,
      name: "Test",
      branchName: brand,
      parts: [`Smoke test WhatsApp Coccinelle depuis ${brand}.`],
    });
    whatsappSent = Boolean(wa);
  }

  return {
    ok: true,
    smtp: isSmtpConfigured(),
    zindua: isZinduaConfigured(),
    emailSent,
    whatsappSent,
  };
}
