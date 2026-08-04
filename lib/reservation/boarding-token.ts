import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Format QR embarquement (U08 → consommé par U16)
 *
 * Contenu texte du QR :
 * - Token signé (défaut) : `CCNL1.<codeUnique>.<sig8>`
 *   - `CCNL1` = Coccinelle boarding token v1
 *   - `codeUnique` = code passager (`PASS-*`)
 *   - `sig8` = HMAC-SHA256(secret, codeUnique) en hex, 8 premiers caractères
 * - Forme brute acceptée à la lecture : le `codeUnique` seul (`PASS-*`)
 *   pour pointage manuel / QR legacy.
 *
 * Secret : `BOARDING_TOKEN_SECRET` puis `BETTER_AUTH_SECRET`, sinon fallback dev.
 */

export const BOARDING_TOKEN_PREFIX = "CCNL1";

export type BoardingParseResult =
  | { ok: true; codeUnique: string; signed: boolean }
  | { ok: false; reason: "empty" | "malformed" | "invalid_signature" | "unrecognized" };

function resolveSecret(explicit?: string): string {
  return (
    explicit ??
    process.env.BOARDING_TOKEN_SECRET ??
    process.env.BETTER_AUTH_SECRET ??
    "dev-boarding-secret"
  );
}

function hmacSig8(codeUnique: string, secret: string): string {
  return createHmac("sha256", secret).update(codeUnique, "utf8").digest("hex").slice(0, 8);
}

function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
  } catch {
    return false;
  }
}

/** Encode un token signé à mettre dans le QR passager. */
export function encodeBoardingToken(codeUnique: string, secret?: string): string {
  const trimmed = codeUnique.trim();
  const sig = hmacSig8(trimmed, resolveSecret(secret));
  return `${BOARDING_TOKEN_PREFIX}.${trimmed}.${sig}`;
}

/**
 * Décode / vérifie le contenu scanné d’un QR (ou saisie manuelle).
 * Accepte le token signé v1 ou un code `PASS-*` brut.
 */
export function parseBoardingQrPayload(
  payload: string,
  secret?: string,
): BoardingParseResult {
  const trimmed = payload.trim();
  if (!trimmed) return { ok: false, reason: "empty" };

  if (trimmed.startsWith(`${BOARDING_TOKEN_PREFIX}.`)) {
    const rest = trimmed.slice(BOARDING_TOKEN_PREFIX.length + 1);
    const lastDot = rest.lastIndexOf(".");
    if (lastDot <= 0) return { ok: false, reason: "malformed" };

    const codeUnique = rest.slice(0, lastDot);
    const sig = rest.slice(lastDot + 1);
    if (!codeUnique || !sig) return { ok: false, reason: "malformed" };

    const expected = hmacSig8(codeUnique, resolveSecret(secret));
    if (!safeEqualHex(sig, expected)) {
      return { ok: false, reason: "invalid_signature" };
    }
    return { ok: true, codeUnique, signed: true };
  }

  if (trimmed.startsWith("PASS-")) {
    return { ok: true, codeUnique: trimmed, signed: false };
  }

  return { ok: false, reason: "unrecognized" };
}

/** Payload QR recommandé pour un passager (token signé). */
export function boardingQrPayload(codeUnique: string, secret?: string): string {
  return encodeBoardingToken(codeUnique, secret);
}
