/** Devise métier hôtel : les tarifs chambres / F&B sont en USD. */

export function formatUsd(amount: number, digits = 2) {
  return `${amount.toFixed(digits)} $`;
}

export function formatCdf(amount: number, digits = 0) {
  return `${amount.toLocaleString("fr-FR", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  })} CDF`;
}

/** Affiche le $ et, si taux dispo, l’équivalent CDF. */
export function formatUsdWithCdf(
  amountUsd: number,
  rate?: number | null,
  opts?: { cdfDigits?: number },
) {
  if (rate && rate > 0) {
    return `${formatUsd(amountUsd)} · ${formatCdf(amountUsd * rate, opts?.cdfDigits ?? 0)}`;
  }
  return formatUsd(amountUsd);
}

/** Montant payé en $ (priorité amountForeign). */
export function paymentAmountUsd(p: {
  amountForeign?: number | null;
  amountCdf: number;
}) {
  if (p.amountForeign != null && p.amountForeign > 0) return p.amountForeign;
  return p.amountCdf;
}
