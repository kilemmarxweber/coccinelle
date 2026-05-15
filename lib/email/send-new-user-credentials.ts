import { Resend } from "resend";

const APP_NAME = process.env.APP_NAME ?? "J Ekklesia";

/**
 * Envoie (ou journalise) les identifiants temporaires après création de compte par un admin.
 * Configurez `RESEND_API_KEY` (+ optionnellement `RESEND_FROM` ou `RESEND_DOMAIN`) pour un envoi réel via Resend.
 */
export async function sendNewUserCredentialsEmail(input: {
  to: string;
  name: string;
  temporaryPassword: string;
  loginUrl?: string;
}): Promise<void> {
  const { to, name, temporaryPassword } = input;
  const loginUrl = input.loginUrl ?? `${process.env.BETTER_AUTH_URL ?? process.env.NEXT_PUBLIC_BETTER_AUTH_URL ?? "http://localhost:3000"}/auth/sign-in`;

  const subject = `${APP_NAME} — Votre compte a été créé`;
  const text = [
    `Bonjour ${name},`,
    "",
    "Un administrateur a créé un compte pour vous.",
    "",
    `Email de connexion : ${to}`,
    `Mot de passe temporaire : ${temporaryPassword}`,
    "",
    `Connectez-vous ici : ${loginUrl}`,
    "",
    "Pour des raisons de sécurité, changez ce mot de passe après votre première connexion.",
    "",
    "— L’équipe " + APP_NAME,
  ].join("\n");

  const html = `
    <p>Bonjour ${escapeHtml(name)},</p>
    <p>Un administrateur a créé un compte pour vous.</p>
    <ul>
      <li><strong>Email</strong> : ${escapeHtml(to)}</li>
      <li><strong>Mot de passe temporaire</strong> : <code>${escapeHtml(temporaryPassword)}</code></li>
    </ul>
    <p><a href="${escapeHtml(loginUrl)}">Se connecter</a></p>
    <p>Pour des raisons de sécurité, changez ce mot de passe après votre première connexion.</p>
    <p>— ${escapeHtml(APP_NAME)}</p>
  `;

  const apiKey = process.env.RESEND_API_KEY;
  const from =
    process.env.RESEND_FROM ??
    (process.env.RESEND_DOMAIN ? `noreply@${process.env.RESEND_DOMAIN}` : `${APP_NAME} <onboarding@resend.dev>`);

  if (apiKey) {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from,
      to,
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
    // Sans fournisseur d’email : trace locale pour le développement uniquement
    // eslint-disable-next-line no-console
    console.info(`[sendNewUserCredentialsEmail] to=${to} (dev, pas de RESEND_API_KEY)`);
    // eslint-disable-next-line no-console
    console.info(`[sendNewUserCredentialsEmail] mot de passe temporaire (dev uniquement) : ${temporaryPassword}`);
  } else {
    // eslint-disable-next-line no-console
    console.warn(
      "[sendNewUserCredentialsEmail] RESEND_API_KEY manquant : email non envoyé (production).",
    );
  }
}

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
