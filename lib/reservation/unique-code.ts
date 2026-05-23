/** Préfixe + horodatage + suffixe aléatoire court pour codes traçables guichet / en ligne. */
export function reservationUniqueCode(prefix: string): string {
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${prefix}-${Date.now()}-${suffix}`;
}
