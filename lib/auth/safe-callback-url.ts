/**
 * Valide un callbackUrl post-login (chemins relatifs internes uniquement).
 */
export function safeAuthCallbackUrl(
  raw: string | null | undefined,
  fallback = "/admin",
): string {
  if (!raw) return fallback;
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return fallback;
  }
  if (!decoded.startsWith("/") || decoded.startsWith("//")) {
    return fallback;
  }
  if (decoded.includes("://") || decoded.includes("\\")) {
    return fallback;
  }
  return decoded;
}
