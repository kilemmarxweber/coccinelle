import { sendMail, isSmtpConfigured } from "./mailer";

const APP_NAME = process.env.APP_NAME ?? "J Ekklesia";

export async function sendVerificationEmail(input: {
  to: string;
  url: string;
  subject?: string;
}): Promise<void> {
  const subject = input.subject ?? `${APP_NAME} — Confirmez votre adresse email`;
  const text = [
    `Bonjour,`,
    "",
    "Cliquez sur le lien ci-dessous pour confirmer votre adresse email :",
    input.url,
    "",
    "Si vous n’êtes pas à l’origine de cette demande, ignorez ce message.",
    "",
    `— L’équipe ${APP_NAME}`,
  ].join("\n");

  const html = `
    <p>Bonjour,</p>
    <p><a href="${escapeHtml(input.url)}">Confirmer mon adresse email</a></p>
    <p>Si vous n’êtes pas à l’origine de cette demande, ignorez ce message.</p>
    <p>— ${escapeHtml(APP_NAME)}</p>
  `;

  const from =
    process.env.EMAIL_FROM ??
    (process.env.EMAIL_USER ? `${APP_NAME} <${process.env.EMAIL_USER}>` : `no-reply@example.com`);

  if (isSmtpConfigured()) {
    try {
      await sendMail({ from, to: input.to, subject, text, html });
      return;
    } catch (err: any) {
      throw new Error(`Nodemailer: ${err?.message ?? String(err)}`);
    }
  }

  if (process.env.NODE_ENV === "development") {
    // eslint-disable-next-line no-console
    console.info(`[sendVerificationEmail] to=${input.to} url=${input.url}`);
    return;
  }

  // eslint-disable-next-line no-console
  console.warn("[sendVerificationEmail] SMTP non configuré : email non envoyé.");
}

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
