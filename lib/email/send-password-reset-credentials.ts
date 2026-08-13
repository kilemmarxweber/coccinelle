import { sendMail, isSmtpConfigured, getDefaultMailFrom } from "./mailer";
import { sendResetPasswordWhatsApp } from "@/lib/zindua";
import { logNotification } from "@/lib/notifications/log";

const APP_NAME = process.env.APP_NAME ?? "Coccinelle";

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export async function sendPasswordResetCredentialsEmail(input: {
  to: string;
  phone?: string | null;
  name: string;
  temporaryPassword: string;
  branchName?: string | null;
  branchId?: string | null;
  loginUrl?: string;
}): Promise<{ emailSent: boolean; whatsappSent: boolean }> {
  const { to, name, temporaryPassword } = input;
  const brand = input.branchName?.trim() || APP_NAME;
  const loginUrl =
    input.loginUrl ??
    `${process.env.BETTER_AUTH_URL ?? process.env.NEXT_PUBLIC_BETTER_AUTH_URL ?? "http://localhost:3000"}/auth/sign-in`;

  const subject = `${brand} — Mot de passe réinitialisé`;
  const text = [
    `Bonjour ${name},`,
    "",
    "Un administrateur a réinitialisé le mot de passe de votre compte.",
    "",
    `Email de connexion : ${to}`,
    `Nouveau mot de passe temporaire : ${temporaryPassword}`,
    "",
    `Connectez-vous ici : ${loginUrl}`,
    "",
    "Pour des raisons de sécurité, changez ce mot de passe après votre connexion.",
    "",
    `— ${brand}`,
  ].join("\n");

  const html = `
    <p>Bonjour ${escapeHtml(name)},</p>
    <p>Un administrateur a réinitialisé le mot de passe de votre compte.</p>
    <ul>
      <li><strong>Email</strong> : ${escapeHtml(to)}</li>
      <li><strong>Mot de passe temporaire</strong> : <code>${escapeHtml(temporaryPassword)}</code></li>
    </ul>
    <p><a href="${escapeHtml(loginUrl)}">Se connecter</a></p>
    <p>— ${escapeHtml(brand)}</p>
  `;

  let emailSent = false;
  if (isSmtpConfigured()) {
    try {
      await sendMail({
        from: getDefaultMailFrom(),
        to,
        subject,
        text,
        html,
      });
      emailSent = true;
      logNotification({
        channel: "email",
        status: "sent",
        refType: "member_password_reset",
        branchId: input.branchId,
        branchName: input.branchName,
        to,
      });
    } catch (err) {
      logNotification({
        channel: "email",
        status: "failed",
        refType: "member_password_reset",
        to,
        reason: err instanceof Error ? err.message : String(err),
      });
      throw new Error(
        `Nodemailer: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  } else {
    logNotification({
      channel: "email",
      status: "skipped",
      refType: "member_password_reset",
      reason: "smtp_off",
      to,
    });
    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console
      console.info(
        `[sendPasswordResetCredentialsEmail] to=${to} (dev, pas de SMTP)`,
      );
    }
  }

  let whatsappSent = false;
  if (input.phone?.trim()) {
    const wa = await sendResetPasswordWhatsApp({
      to: input.phone,
      name,
      email: to,
      temporaryPassword,
      branchName: input.branchName,
      loginUrl,
    });
    whatsappSent = Boolean(wa?.success ?? wa);
    logNotification({
      channel: "whatsapp",
      status: whatsappSent ? "sent" : "failed",
      refType: "member_password_reset",
      branchId: input.branchId,
      to: input.phone,
    });
  }

  return { emailSent, whatsappSent };
}
