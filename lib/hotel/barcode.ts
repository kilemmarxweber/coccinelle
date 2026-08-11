/**
 * Code-barres produits F&B (HotelMenuItem).
 * Lecteurs USB (wedge) envoient le code + Enter.
 */

const BARCODE_RE = /^[A-Z0-9][A-Z0-9\-_.]{2,63}$/;

/** Normalise une saisie / scan. Retourne null si vide. */
export function normalizeBarcode(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const value = String(raw)
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
  if (!value) return null;
  return value;
}

/** Valide un code déjà normalisé (ou brut). */
export function isValidBarcode(raw: string | null | undefined): boolean {
  const value = normalizeBarcode(raw);
  if (!value) return false;
  return BARCODE_RE.test(value);
}

/**
 * Parse + valide pour persistance.
 * @throws Error si format invalide
 */
export function parseBarcodeInput(
  raw: string | null | undefined,
): string | null {
  const value = normalizeBarcode(raw);
  if (!value) return null;
  if (!BARCODE_RE.test(value)) {
    throw new Error(
      "Code-barres invalide (3–64 caractères : lettres, chiffres, - _ .).",
    );
  }
  return value;
}

/**
 * Génère un code interne unique-ish pour produits sans barre fabricant.
 * Format Code128-friendly : CC{branch4}{base36 time}{rand}
 */
export function generateInternalBarcode(branchId: string): string {
  const branch = branchId.replace(/-/g, "").slice(0, 4).toUpperCase() || "XXXX";
  const time = Date.now().toString(36).toUpperCase();
  const rand = Math.floor(Math.random() * 1296)
    .toString(36)
    .toUpperCase()
    .padStart(2, "0");
  return `CC${branch}${time}${rand}`;
}
