import { safeAuthCallbackUrl } from "@/lib/auth/safe-callback-url";

/**
 * Callback post-login hôtel : uniquement des chemins sous `/{orgSlug}/hotel/…`.
 */
export function safeHotelCallbackUrl(
  raw: string | null | undefined,
  orgSlug: string,
): string | null {
  const path = safeAuthCallbackUrl(raw, "");
  if (!path) return null;
  const prefix = `/${orgSlug}/hotel`;
  if (path === prefix || path.startsWith(`${prefix}/`)) {
    return path;
  }
  return null;
}
