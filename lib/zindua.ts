import { Zindua, type ZinduaSendResult } from "@zindua/sdk";

export const DEFAULT_WHATSAPP_TO = "+243971651881";

export const ZINDUA_MAIL_MIRROR_TEMPLATE =
  process.env.ZINDUA_WHATSAPP_MAIL_TEMPLATE?.trim() || "notification";

const APP_NAME = process.env.APP_NAME?.trim() || "Coccinelle";
const WHATSAPP_CODE_MAX = 3500;

function sanitizeWhatsAppVariable(value: string): string {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/[\r\n\t]+/g, " | ")
    .replace(/[^\S\n]+/g, " ")
    .replace(/( \| ){2,}/g, " | ")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .trim();
}

function truncateWhatsAppCode(value: string): string {
  const cleaned = sanitizeWhatsAppVariable(value);
  if (cleaned.length <= WHATSAPP_CODE_MAX) return cleaned;
  return `${cleaned.slice(0, WHATSAPP_CODE_MAX - 1)}…`;
}

function getApiKey(): string | null {
  return process.env.ZINDUA_API_KEY?.trim() || null;
}

function getSiteUrl(): string | undefined {
  return (
    process.env.ZINDUA_SITE_URL?.replace(/\/$/, "") ||
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    process.env.BETTER_AUTH_URL?.replace(/\/$/, "") ||
    undefined
  );
}

export function isZinduaConfigured(): boolean {
  return Boolean(getApiKey());
}

let client: Zindua | null = null;

export function getZindua(): Zindua {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("ZINDUA_API_KEY manquante dans l'environnement.");
  }
  if (!client) {
    client = new Zindua({
      apiKey,
      siteUrl: getSiteUrl(),
    });
  }
  return client;
}

/** Normalise vers E.164 (formats RDC courants). */
export function toE164Phone(phone: string): string {
  const trimmed = phone.trim();
  if (!trimmed) throw new Error("Numéro WhatsApp vide.");

  let digits = trimmed.replace(/\D/g, "");
  if (!digits) throw new Error("Numéro WhatsApp invalide.");

  if (digits.startsWith("0") && digits.length === 10) {
    digits = `243${digits.slice(1)}`;
  } else if (digits.length === 9 && /^[89]/.test(digits)) {
    digits = `243${digits}`;
  }

  if (digits.length < 10) throw new Error("Numéro WhatsApp trop court.");
  return `+${digits}`;
}

export function resolveWhatsAppTo(phone?: string | null): string | null {
  if (!phone?.trim()) return null;
  try {
    const e164 = toE164Phone(phone);
    const digits = e164.replace(/\D/g, "");
    if (digits.length < 11) return null;
    if (/^2430+$/.test(digits) || /^0+$/.test(digits)) return null;
    return e164;
  } catch {
    return null;
  }
}

type SendWhatsAppOptions = {
  to?: string;
  template?: string;
  variables?: {
    appName?: string;
    name?: string;
    code?: string;
    [key: string]: string | undefined;
  };
  lang?: string;
};

export async function sendWhatsApp(
  options: SendWhatsAppOptions,
): Promise<ZinduaSendResult> {
  const template = options.template ?? ZINDUA_MAIL_MIRROR_TEMPLATE;
  const to = toE164Phone(options.to ?? DEFAULT_WHATSAPP_TO);
  const raw = options.variables ?? {};
  const variables: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (value != null && value !== "") {
      variables[key] =
        key === "code" ? truncateWhatsAppCode(value) : sanitizeWhatsAppVariable(value);
    }
  }

  return getZindua().send({
    to,
    channel: "whatsapp",
    template,
    lang: options.lang ?? "fr",
    variables,
  });
}

export async function mirrorEmailToWhatsApp(options: {
  to: string;
  subject: string;
  body: string;
  name?: string | null;
  lang?: string;
}): Promise<ZinduaSendResult | null> {
  if (!isZinduaConfigured()) {
    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console
      console.info(
        `[mirrorEmailToWhatsApp] Zindua off — skip to=${options.to}`,
      );
    }
    return null;
  }

  const to = resolveWhatsAppTo(options.to);
  if (!to) {
    // eslint-disable-next-line no-console
    console.warn(
      `[mirrorEmailToWhatsApp] numéro invalide (« ${options.to} »)`,
    );
    return null;
  }

  const code = truncateWhatsAppCode(
    `${options.subject.trim()} | ${options.body.trim()}`,
  );

  try {
    const result = await sendWhatsApp({
      to,
      template: ZINDUA_MAIL_MIRROR_TEMPLATE,
      lang: options.lang ?? "fr",
      variables: {
        appName: APP_NAME,
        name: options.name?.trim() || "Client",
        code,
      },
    });
    // eslint-disable-next-line no-console
    console.info(
      `[mirrorEmailToWhatsApp] ok to=${to} logId=${result.logId} status=${result.status}`,
    );
    return result;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn(
      "[mirrorEmailToWhatsApp] échec:",
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

function resolveWhatsAppLoginUrl(loginUrl?: string | null): string {
  const raw =
    loginUrl?.trim() ||
    process.env.BETTER_AUTH_URL?.replace(/\/$/, "") ||
    process.env.NEXT_PUBLIC_BETTER_AUTH_URL?.replace(/\/$/, "") ||
    "http://localhost:3000";
  if (/\/auth\/sign-in\/?$/i.test(raw)) return raw.replace(/\/$/, "");
  return `${raw.replace(/\/$/, "")}/auth/sign-in`;
}

function buildWhatsAppBody(parts: Array<string | null | undefined>): string {
  return truncateWhatsAppCode(
    parts
      .map((part) => part?.trim())
      .filter((part): part is string => Boolean(part))
      .join(" | "),
  );
}

export async function sendNewUserCredentialsWhatsApp(options: {
  to: string;
  name: string;
  email: string;
  temporaryPassword: string;
  role?: string;
  organizationName?: string | null;
  branchName?: string | null;
  loginUrl?: string;
}): Promise<ZinduaSendResult | null> {
  const to = resolveWhatsAppTo(options.to);
  if (!to) {
    // eslint-disable-next-line no-console
    console.warn(
      `[sendNewUserCredentialsWhatsApp] numéro invalide (« ${options.to} »)`,
    );
    return null;
  }
  if (!isZinduaConfigured()) return null;

  const loginUrl = resolveWhatsAppLoginUrl(options.loginUrl);
  const displayName = options.name.trim() || "Utilisateur";
  const role = options.role?.trim() || "Membre";
  const branchLabel = options.branchName?.trim() || null;

  const message = buildWhatsAppBody([
    branchLabel,
    `Bonjour ${displayName},`,
    `votre compte ${APP_NAME} a été créé (rôle ${role}).`,
    options.organizationName
      ? `Organisation : ${options.organizationName}.`
      : null,
    `Email : ${options.email}.`,
    `Mot de passe temporaire : ${options.temporaryPassword}.`,
    `Connectez-vous : ${loginUrl}`,
    "Changez ce mot de passe après connexion.",
    `— ${branchLabel || APP_NAME}`,
  ]);

  try {
    const result = await sendWhatsApp({
      to,
      template: ZINDUA_MAIL_MIRROR_TEMPLATE,
      lang: "fr",
      variables: {
        appName: APP_NAME,
        name: displayName,
        code: message,
      },
    });
    // eslint-disable-next-line no-console
    console.info(
      `[sendNewUserCredentialsWhatsApp] ok to=${to} logId=${result.logId}`,
    );
    return result;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn(
      "[sendNewUserCredentialsWhatsApp] échec:",
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

export async function sendResetPasswordWhatsApp(options: {
  to: string;
  name: string;
  temporaryPassword: string;
  email: string;
  loginUrl?: string;
  branchName?: string | null;
}): Promise<ZinduaSendResult | null> {
  const to = resolveWhatsAppTo(options.to);
  if (!to || !isZinduaConfigured()) return null;

  const loginUrl = resolveWhatsAppLoginUrl(options.loginUrl);
  const branchLabel = options.branchName?.trim() || null;
  const message = buildWhatsAppBody([
    branchLabel,
    `Bonjour ${options.name.trim() || "Utilisateur"},`,
    `votre mot de passe ${APP_NAME} a été réinitialisé.`,
    `Email : ${options.email}.`,
    `Nouveau mot de passe temporaire : ${options.temporaryPassword}.`,
    `Connexion : ${loginUrl}`,
    "Changez-le après connexion.",
    `— ${branchLabel || APP_NAME}`,
  ]);

  try {
    return await sendWhatsApp({
      to,
      variables: {
        appName: APP_NAME,
        name: options.name.trim() || "Utilisateur",
        code: message,
      },
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn(
      "[sendResetPasswordWhatsApp] échec:",
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

/** Message libre WhatsApp (séjours, promos, rappels). */
export async function sendBranchWhatsAppMessage(options: {
  to: string;
  name?: string | null;
  branchName?: string | null;
  parts: Array<string | null | undefined>;
}): Promise<ZinduaSendResult | null> {
  const to = resolveWhatsAppTo(options.to);
  if (!to || !isZinduaConfigured()) return null;

  const branchLabel = options.branchName?.trim() || null;
  const message = buildWhatsAppBody([
    branchLabel,
    ...options.parts,
    `— ${branchLabel || APP_NAME}`,
  ]);

  try {
    return await sendWhatsApp({
      to,
      variables: {
        appName: APP_NAME,
        name: options.name?.trim() || "Client",
        code: message,
      },
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn(
      "[sendBranchWhatsAppMessage] échec:",
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}
