/** Clés de test Cloudflare (documentation Turnstile). Utilisées seulement hors production si .env est vide. */
const TEST_SITE_KEY = "3x00000000000000000000FF";
const TEST_SECRET = "1x0000000000000000000000000000000AA";

export const TURNSTILE_COOKIE = "cf_human";

export function turnstileSiteKey() {
  const configured = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim();
  if (configured) return configured;
  if (process.env.NODE_ENV === "production") return "";
  return TEST_SITE_KEY;
}

function turnstileSecret() {
  const configured = process.env.TURNSTILE_SECRET_KEY?.trim();
  if (configured) return configured;
  if (process.env.NODE_ENV === "production") return "";
  return TEST_SECRET;
}

export async function verifyTurnstileToken(token: string, remoteIp?: string | null) {
  const secret = turnstileSecret();
  if (!secret || token.trim().length < 10) return false;
  const body = new URLSearchParams({
    secret,
    response: token.trim(),
  });
  if (remoteIp) body.set("remoteip", remoteIp);
  try {
    const response = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      { method: "POST", body },
    );
    if (!response.ok) return false;
    const data = (await response.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}
