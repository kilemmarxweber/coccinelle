import { Resend } from "resend";

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

  const apiKey = process.env.RESEND_API_KEY;
  const from =
    process.env.RESEND_FROM ??
    (process.env.RESEND_DOMAIN
      ? `noreply@${process.env.RESEND_DOMAIN}`
      : `${APP_NAME} <onboarding@resend.dev>`);

  if (apiKey) {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from,
      to: input.to,
      subject,
      text,
      html,
    });
    if (error) {
      throw new Error(`Resend (${error.name}): ${error.message}`);
    }
    return;
  }

  if (process.env.NODE_ENV === "development") {
    // eslint-disable-next-line no-console
    console.info(`[sendVerificationEmail] to=${input.to} url=${input.url}`);
    return;
  }

  // eslint-disable-next-line no-console
  console.warn("[sendVerificationEmail] RESEND_API_KEY manquant : email non envoyé.");
}

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
