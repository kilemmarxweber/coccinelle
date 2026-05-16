import nodemailer from "nodemailer";

const host = process.env.EMAIL_HOST ?? "smtp.gmail.com";
const port = process.env.EMAIL_PORT ? parseInt(process.env.EMAIL_PORT, 10) : 465;
const secure = process.env.EMAIL_SECURE ? process.env.EMAIL_SECURE === "true" : port === 465;
const user = process.env.EMAIL_USER;
const pass = process.env.EMAIL_PASS;

let transporter: nodemailer.Transporter | null = null;

function createTransporter() {
  if (transporter) return transporter;
  if (!user || !pass)
    throw new Error("EMAIL_USER and EMAIL_PASS must be set to send emails via SMTP");
  transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
  return transporter;
}

export async function sendMail({
  from,
  to,
  subject,
  text,
  html,
}: {
  from: string;
  to: string;
  subject: string;
  text: string;
  html?: string;
}) {
  const t = createTransporter();
  const info = await t.sendMail({ from, to, subject, text, html });
  return info;
}

export function isSmtpConfigured() {
  return !!(process.env.EMAIL_USER && process.env.EMAIL_PASS);
}
