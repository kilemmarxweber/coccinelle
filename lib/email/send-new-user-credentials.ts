import { sendMail, isSmtpConfigured } from "./mailer";

const APP_NAME = process.env.APP_NAME ?? "Coccinelle";

/**
 * Envoie (ou journalise) les identifiants temporaires après création de compte par un admin.
 * Configurez `EMAIL_USER` et `EMAIL_PASS` pour l’envoi réel via SMTP.
 */
export async function sendNewUserCredentialsEmail(input: {
  to: string;
  name: string;
  temporaryPassword: string;
  loginUrl?: string;
}): Promise<void> {
  const { to, name, temporaryPassword } = input;
  const loginUrl =
    input.loginUrl ??
    `${process.env.BETTER_AUTH_URL ?? process.env.NEXT_PUBLIC_BETTER_AUTH_URL ?? "http://localhost:3000"}/auth/sign-in`;

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

  const from =
    process.env.EMAIL_FROM ??
    (process.env.EMAIL_USER ? `${APP_NAME} <${process.env.EMAIL_USER}>` : `no-reply@example.com`);

  if (isSmtpConfigured()) {
    try {
      await sendMail({ from, to, subject, text, html });
      return;
    } catch (err: any) {
      throw new Error(`Nodemailer: ${err?.message ?? String(err)}`);
    }
  }

  if (process.env.NODE_ENV === "development") {
    // Sans fournisseur d’email : trace locale pour le développement uniquement
    // eslint-disable-next-line no-console
    console.info(`[sendNewUserCredentialsEmail] to=${to} (dev, pas de SMTP configuré)`);
    // eslint-disable-next-line no-console
    console.info(
      `[sendNewUserCredentialsEmail] mot de passe temporaire (dev uniquement) : ${temporaryPassword}`
    );
  } else {
    // eslint-disable-next-line no-console
    console.warn(
      "[sendNewUserCredentialsEmail] SMTP non configuré : email non envoyé (production)."
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
