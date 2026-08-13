import nodemailer from "nodemailer";
import type Mail from "nodemailer/lib/mailer";

export type MailPayload = {
  from?: string;
  to: string;
  replyTo?: string;
  subject: string;
  text: string;
  html?: string;
  /** Miroir WhatsApp (Zindua) — indépendant du SMTP. */
  whatsappTo?: string | null;
  whatsappName?: string | null;
};

let transporter: Mail | null = null;

function smtpConfig() {
  const host =
    process.env.SMTP_HOST?.trim() ||
    process.env.EMAIL_HOST?.trim() ||
    "smtp.gmail.com";
  const port = Number(
    process.env.SMTP_PORT ?? process.env.EMAIL_PORT ?? 465,
  );
  const secureRaw = process.env.SMTP_SECURE ?? process.env.EMAIL_SECURE;
  const secure =
    secureRaw != null ? secureRaw === "true" : port === 465;
  const user =
    process.env.SMTP_USER?.trim() || process.env.EMAIL_USER?.trim();
  const pass =
    process.env.SMTP_PASS?.trim() || process.env.EMAIL_PASS?.trim();
  return { host, port, secure, user, pass };
}

function createTransporter() {
  if (transporter) return transporter;
  const { host, port, secure, user, pass } = smtpConfig();
  if (!user || !pass) {
    throw new Error("SMTP non configuré (SMTP_USER/SMTP_PASS ou EMAIL_*).");
  }
  transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
  return transporter;
}

export function getDefaultMailFrom() {
  const appName = process.env.APP_NAME ?? "Coccinelle";
  const explicit =
    process.env.MAIL_FROM?.trim() || process.env.EMAIL_FROM?.trim();
  if (explicit) return explicit;
  const user =
    process.env.SMTP_USER?.trim() || process.env.EMAIL_USER?.trim();
  if (!user) return undefined;
  return `${appName} <${user}>`;
}

export function isSmtpConfigured() {
  const { user, pass } = smtpConfig();
  return Boolean(user && pass);
}

/** Envoi SMTP immédiat. */
export async function deliverMail(payload: {
  from?: string;
  to: string;
  replyTo?: string;
  subject: string;
  text: string;
  html?: string;
}) {
  const t = createTransporter();
  const mailFrom = payload.from ?? getDefaultMailFrom();
  if (!mailFrom) {
    throw new Error("Aucune adresse d’expéditeur (MAIL_FROM / SMTP_USER).");
  }
  return t.sendMail({
    from: mailFrom,
    to: payload.to,
    replyTo: payload.replyTo,
    subject: payload.subject,
    text: payload.text,
    html: payload.html,
  });
}

function queueWhatsAppMirror(payload: MailPayload): void {
  const phone = payload.whatsappTo?.trim();
  if (!phone) return;
  void import("@/lib/zindua")
    .then(({ mirrorEmailToWhatsApp }) =>
      mirrorEmailToWhatsApp({
        to: phone,
        subject: payload.subject,
        body: payload.text,
        name: payload.whatsappName,
      }),
    )
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.warn(
        "[sendMail] WhatsApp mirror failed:",
        err instanceof Error ? err.message : err,
      );
    });
}

/**
 * Envoi email (fire-and-forget si SMTP ok) + miroir WhatsApp optionnel.
 * Ne lance pas si email invalide et seul WhatsApp est demandé.
 */
export async function sendMail(payload: MailPayload): Promise<void> {
  queueWhatsAppMirror(payload);

  const emailTo = payload.to?.trim() ?? "";
  const hasValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTo);
  if (!hasValidEmail) {
    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console
      console.info(
        `[sendMail] email invalide/absent — WhatsApp only subject=${payload.subject}`,
      );
    }
    return;
  }

  if (!isSmtpConfigured()) {
    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console
      console.info(
        `[sendMail] SMTP off — skip to=${emailTo} subject=${payload.subject}`,
      );
      return;
    }
    // eslint-disable-next-line no-console
    console.warn(
      `[sendMail] SMTP non configuré : email non envoyé (to=${emailTo}).`,
    );
    return;
  }

  const { whatsappTo: _wa, whatsappName: _wn, ...emailOnly } = payload;
  try {
    await deliverMail({
      ...emailOnly,
      from: emailOnly.from ?? getDefaultMailFrom(),
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(
      "[sendMail] SMTP failed:",
      err instanceof Error ? err.message : err,
    );
    throw err;
  }
}
