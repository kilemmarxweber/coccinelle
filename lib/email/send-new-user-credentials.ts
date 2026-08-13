import { sendMail, isSmtpConfigured, getDefaultMailFrom } from "./mailer";
import { sendNewUserCredentialsWhatsApp } from "@/lib/zindua";
import { logNotification } from "@/lib/notifications/log";

const APP_NAME = process.env.APP_NAME ?? "Coccinelle";

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/**
 * Identifiants temporaires après création de compte admin.
 * Email SMTP + WhatsApp dédié, branding branche.
 */
export async function sendNewUserCredentialsEmail(input: {
  to: string;
  phone?: string | null;
  name: string;
  temporaryPassword: string;
  role?: string | null;
  organizationName?: string | null;
  branchName?: string | null;
  branchPhone?: string | null;
  loginUrl?: string;
  branchId?: string | null;
}): Promise<{ emailSent: boolean; whatsappSent: boolean }> {
  const { to, name, temporaryPassword } = input;
  const role = input.role?.trim() || "Membre";
  const organizationName = input.organizationName?.trim() || null;
  const branchName = input.branchName?.trim() || null;
  const brand = branchName || APP_NAME;
  const loginUrl =
    input.loginUrl ??
    `${process.env.BETTER_AUTH_URL ?? process.env.NEXT_PUBLIC_BETTER_AUTH_URL ?? "http://localhost:3000"}/auth/sign-in`;

  const subject = `${brand} — Votre compte a été créé`;
  const text = [
    `Bonjour ${name},`,
    "",
    `Un administrateur a créé votre compte ${APP_NAME}${branchName ? ` pour « ${branchName} »` : ""}.`,
    "",
    `Email de connexion : ${to}`,
    `Rôle : ${role}`,
    ...(organizationName ? [`Organisation : ${organizationName}`] : []),
    ...(branchName ? [`Branche : ${branchName}`] : []),
    `Mot de passe temporaire : ${temporaryPassword}`,
    "",
    `Connectez-vous ici : ${loginUrl}`,
    "",
    "Pour des raisons de sécurité, changez ce mot de passe après votre première connexion.",
    "",
    `— ${brand}`,
  ].join("\n");

  const html = `
    <p>Bonjour ${escapeHtml(name)},</p>
    <p>Un administrateur a créé votre compte ${escapeHtml(APP_NAME)}${
      branchName ? ` pour <strong>${escapeHtml(branchName)}</strong>` : ""
    }.</p>
    <ul>
      <li><strong>Email</strong> : ${escapeHtml(to)}</li>
      <li><strong>Rôle</strong> : ${escapeHtml(role)}</li>
      ${organizationName ? `<li><strong>Organisation</strong> : ${escapeHtml(organizationName)}</li>` : ""}
      ${branchName ? `<li><strong>Branche</strong> : ${escapeHtml(branchName)}</li>` : ""}
      <li><strong>Mot de passe temporaire</strong> : <code>${escapeHtml(temporaryPassword)}</code></li>
    </ul>
    <p><a href="${escapeHtml(loginUrl)}">Se connecter</a></p>
    <p>Pour des raisons de sécurité, changez ce mot de passe après votre première connexion.</p>
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
        refType: "member_credentials",
        branchId: input.branchId,
        branchName,
        to,
      });
    } catch (err) {
      logNotification({
        channel: "email",
        status: "failed",
        refType: "member_credentials",
        branchId: input.branchId,
        branchName,
        to,
        reason: err instanceof Error ? err.message : String(err),
      });
      if (process.env.NODE_ENV !== "development") throw err;
    }
  } else {
    logNotification({
      channel: "email",
      status: "skipped",
      refType: "member_credentials",
      branchId: input.branchId,
      reason: "smtp_off",
      to,
    });
    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console
      console.info(
        `[sendNewUserCredentialsEmail] to=${to} (dev, pas de SMTP) branch=${brand}`,
      );
    }
  }

  let whatsappSent = false;
  if (input.phone?.trim()) {
    const wa = await sendNewUserCredentialsWhatsApp({
      to: input.phone,
      name,
      email: to,
      temporaryPassword,
      role,
      organizationName,
      branchName,
      loginUrl,
    });
    whatsappSent = Boolean(wa?.success ?? wa);
    logNotification({
      channel: "whatsapp",
      status: whatsappSent ? "sent" : "failed",
      refType: "member_credentials",
      branchId: input.branchId,
      branchName,
      to: input.phone,
    });
  } else {
    logNotification({
      channel: "whatsapp",
      status: "skipped",
      refType: "member_credentials",
      branchId: input.branchId,
      reason: "no_phone",
    });
  }

  return { emailSent, whatsappSent };
}
