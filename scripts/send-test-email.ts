import "dotenv/config";
import { sendMail, isSmtpConfigured } from "../lib/email/mailer";

async function main() {
  if (!isSmtpConfigured()) {
    console.error("SMTP not configured. Set EMAIL_USER and EMAIL_PASS in .env");
    process.exit(1);
  }

  const to = process.env.EMAIL_TEST_TO ?? process.env.EMAIL_USER!;
  const from =
    process.env.EMAIL_FROM ?? `${process.env.APP_NAME ?? "App"} <${process.env.EMAIL_USER}>`;

  try {
    const info = await sendMail({
      from,
      to,
      subject: "Test email from coccinelle",
      text: "Ceci est un email de test envoyé depuis le projet coccinelle.",
    });
    console.log("Email envoyé — response:", info);
    process.exit(0);
  } catch (err) {
    console.error("Erreur lors de l'envoi :", err);
    process.exit(2);
  }
}

main();
