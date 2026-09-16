export const DEFAULT_WHATSAPP_TO = "+243971651881";

export const KLAMBO_WHATSAPP_MAIL_TEMPLATE =
  process.env.KLAMBO_WHATSAPP_MAIL_TEMPLATE?.trim() || "notification";

const APP_NAME = process.env.APP_NAME?.trim() || "Coccinelle";
const WHATSAPP_CODE_MAX = 3500;
const DEFAULT_BASE_URL = "https://whatsapp-api.klambocore.com";

export type KlamboSendResult = {
  id: string;
  status: string;
  channel?: string;
  to?: string;
  provider_message_id?: string | null;
  created_at?: string;
  /** Alias de `id` (compat logs historiques). */
  logId: string;
};

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
  return process.env.KLAMBO_WHATSAPP_API_KEY?.trim() || null;
}

function getBaseUrl(): string {
  return (
    process.env.KLAMBO_WHATSAPP_BASE_URL?.replace(/\/$/, "") ||
    DEFAULT_BASE_URL
  );
}

export function isKlamboWhatsAppConfigured(): boolean {
  return Boolean(getApiKey());
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
  channel?: "whatsapp" | "sms";
  idempotencyKey?: string;
};

async function klamboFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("KLAMBO_WHATSAPP_API_KEY manquante dans l'environnement.");
  }

  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${apiKey}`);
  if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(`${getBaseUrl()}${path}`, {
    ...init,
    headers,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(text || `HTTP ${res.status}`);
  }
  return (text ? JSON.parse(text) : {}) as T;
}

export async function sendWhatsApp(
  options: SendWhatsAppOptions,
): Promise<KlamboSendResult> {
  const template = options.template ?? KLAMBO_WHATSAPP_MAIL_TEMPLATE;
  const to = toE164Phone(options.to ?? DEFAULT_WHATSAPP_TO);
  const raw = options.variables ?? {};
  const variables: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (value != null && value !== "") {
      variables[key] =
        key === "code" ? truncateWhatsAppCode(value) : sanitizeWhatsAppVariable(value);
    }
  }

  const result = await klamboFetch<{
    id: string;
    status: string;
    channel?: string;
    to?: string;
    provider_message_id?: string | null;
    created_at?: string;
  }>("/v1/send", {
    method: "POST",
    body: JSON.stringify({
      to,
      channel: options.channel ?? "whatsapp",
      type: "template",
      template,
      lang: options.lang ?? "fr",
      variables,
      idempotency_key:
        options.idempotencyKey ??
        `wa-${to}-${template}-${Date.now()}`,
    }),
  });

  return {
    ...result,
    logId: result.id,
  };
}

export async function mirrorEmailToWhatsApp(options: {
  to: string;
  subject: string;
  body: string;
  name?: string | null;
  lang?: string;
}): Promise<KlamboSendResult | null> {
  if (!isKlamboWhatsAppConfigured()) {
    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console
      console.info(
        `[mirrorEmailToWhatsApp] KlamboWhatsApp off — skip to=${options.to}`,
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
      template: KLAMBO_WHATSAPP_MAIL_TEMPLATE,
      lang: options.lang ?? "fr",
      variables: {
        appName: APP_NAME,
        name: options.name?.trim() || "Client",
        code,
      },
    });
    // eslint-disable-next-line no-console
    console.info(
      `[mirrorEmailToWhatsApp] ok to=${to} id=${result.id} status=${result.status}`,
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
}): Promise<KlamboSendResult | null> {
  const to = resolveWhatsAppTo(options.to);
  if (!to) {
    // eslint-disable-next-line no-console
    console.warn(
      `[sendNewUserCredentialsWhatsApp] numéro invalide (« ${options.to} »)`,
    );
    return null;
  }
  if (!isKlamboWhatsAppConfigured()) return null;

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
      template: KLAMBO_WHATSAPP_MAIL_TEMPLATE,
      lang: "fr",
      variables: {
        appName: APP_NAME,
        name: displayName,
        code: message,
      },
    });
    // eslint-disable-next-line no-console
    console.info(
      `[sendNewUserCredentialsWhatsApp] ok to=${to} id=${result.id}`,
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
}): Promise<KlamboSendResult | null> {
  const to = resolveWhatsAppTo(options.to);
  if (!to || !isKlamboWhatsAppConfigured()) return null;

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
}): Promise<KlamboSendResult | null> {
  const to = resolveWhatsAppTo(options.to);
  if (!to || !isKlamboWhatsAppConfigured()) return null;

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
