/** Normalise un taux stocké pour toujours exposer 1 USD = X CDF (X entier). */

export type ExchangeRateRow = {
  id: string;
  branchId: string;
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  validFrom: Date | string;
  createdAt?: Date | string;
};

export type NormalizedUsdCdfRate = ExchangeRateRow & {
  /** Toujours 1 USD = rate CDF (entier) */
  fromCurrency: "USD";
  toCurrency: "CDF";
  rate: number;
  /** Sens tel que saisi en config (devise de saisie UI) */
  configuredFrom: string;
  configuredTo: string;
  /** Toujours le nombre entier de FC pour 1 $ */
  configuredRate: number;
};

/** Force un taux entier ≥ 1 (FC pour 1 USD). */
export function integerUsdCdfRate(value: number): number {
  const n = Math.round(Number(value));
  if (!(n >= 1)) throw new Error("Taux invalide : indiquez un entier (ex. 2250 FC = 1 $).");
  return n;
}

/**
 * Interprète le taux stocké comme « N FC = 1 USD » (entier).
 * Ancien format CDF→USD avec fraction (< 1) encore supporté en lecture.
 */
export function resolveUsdToCdfInteger(
  row: Pick<ExchangeRateRow, "fromCurrency" | "toCurrency" | "rate">,
): number {
  const from = row.fromCurrency.trim().toUpperCase();
  const to = row.toCurrency.trim().toUpperCase();
  const raw = Number(row.rate);
  if (!(raw > 0)) return NaN;

  if (from === "USD" && to === "CDF") {
    return Math.round(raw);
  }
  if (from === "CDF" && to === "USD") {
    // Nouveau : rate = FC pour 1 $ (ex. 2250)
    // Ancien : rate = USD pour 1 FC (ex. 0.000444) → inverser
    if (raw >= 1) return Math.round(raw);
    return Math.round(1 / raw);
  }
  return Math.round(raw);
}

export function normalizeUsdCdfRate(
  row: ExchangeRateRow | null | undefined,
): NormalizedUsdCdfRate | null {
  if (!row || !(row.rate > 0)) return null;
  const from = row.fromCurrency.trim().toUpperCase();
  const to = row.toCurrency.trim().toUpperCase();
  const usdToCdf = resolveUsdToCdfInteger(row);
  if (!(usdToCdf >= 1)) return null;

  return {
    ...row,
    fromCurrency: "USD",
    toCurrency: "CDF",
    rate: usdToCdf,
    configuredFrom: from === "CDF" ? "CDF" : "USD",
    configuredTo: from === "CDF" ? "USD" : "CDF",
    configuredRate: usdToCdf,
  };
}

/** Affichage principal en CDF si le taux a été saisi pour une UI en FC. */
export function isCdfPrimary(
  rate?: Pick<NormalizedUsdCdfRate, "configuredFrom"> | null,
) {
  return rate?.configuredFrom?.toUpperCase() === "CDF";
}

export function usdToCdfAmount(amountUsd: number, usdToCdfRate: number) {
  return Number(amountUsd) * Math.round(usdToCdfRate);
}

/** CDF entier : round(USD × taux), sans arrondi cents intermédiaire. */
export function usdToCdfInteger(amountUsd: number, usdToCdfRate: number) {
  return Math.round(usdToCdfAmount(amountUsd, usdToCdfRate));
}

/** Une ligne : qté × round(P.U. × taux) — évite +3 / +8 FC. */
export function usdLinePrimaryNumber(
  quantity: number,
  unitPriceUsd: number,
  rate?: Pick<NormalizedUsdCdfRate, "rate" | "configuredFrom"> | null,
): number {
  const q = Math.round(Number(quantity) || 0);
  if (isCdfPrimary(rate) && rate && rate.rate > 0) {
    return q * Math.round(unitPriceUsd * Math.round(rate.rate));
  }
  return q * Number(unitPriceUsd || 0);
}

/** Somme de lignes en devise principale (CDF entier ou USD). */
export function usdLinesPrimaryTotal(
  lines: { quantity: number; unitPriceUsd: number }[],
  rate?: Pick<NormalizedUsdCdfRate, "rate" | "configuredFrom"> | null,
): number {
  return lines.reduce(
    (s, l) => s + usdLinePrimaryNumber(l.quantity, l.unitPriceUsd, rate),
    0,
  );
}

/** Encaissement : CDF stocké si devise principale, sinon USD. */
export function paymentPrimaryAmount(
  p: { amountCdf: number; amountForeign?: number | null },
  rate?: Pick<NormalizedUsdCdfRate, "rate" | "configuredFrom"> | null,
): number {
  if (isCdfPrimary(rate)) return Math.round(Number(p.amountCdf) || 0);
  if (p.amountForeign != null && p.amountForeign !== 0) return p.amountForeign;
  if (rate && rate.rate > 0) return Number(p.amountCdf) / Math.round(rate.rate);
  return Number(p.amountCdf) || 0;
}

/** Montant principal selon le sens de taux (prix produit / CA). */
export function formatPrimaryAmount(
  amountUsd: number,
  rate?: Pick<NormalizedUsdCdfRate, "rate" | "configuredFrom"> | null,
) {
  if (isCdfPrimary(rate) && rate && rate.rate > 0) {
    return `${usdToCdfInteger(amountUsd, rate.rate).toLocaleString("fr-FR", {
      maximumFractionDigits: 0,
    })} CDF`;
  }
  return `${amountUsd.toFixed(2)} $`;
}

/** Montant secondaire (équivalent). */
export function formatSecondaryAmount(
  amountUsd: number,
  rate?: Pick<NormalizedUsdCdfRate, "rate" | "configuredFrom"> | null,
) {
  if (!rate || !(rate.rate > 0)) return null;
  if (isCdfPrimary(rate)) {
    return `${amountUsd.toFixed(2)} $`;
  }
  return `${usdToCdfInteger(amountUsd, rate.rate).toLocaleString("fr-FR", {
    maximumFractionDigits: 0,
  })} CDF`;
}

/** Toujours USD + CDF : principal selon sens configuré, secondaire entre parenthèses. */
export function formatBothAmounts(
  amountUsd: number,
  rate?: Pick<NormalizedUsdCdfRate, "rate" | "configuredFrom"> | null,
) {
  const primary = formatPrimaryAmount(amountUsd, rate);
  const secondary = formatSecondaryAmount(amountUsd, rate);
  return secondary ? `${primary} (${secondary})` : primary;
}

export function formatConfiguredRateLabel(
  rate: Pick<
    NormalizedUsdCdfRate,
    "configuredFrom" | "configuredTo" | "configuredRate" | "rate"
  >,
) {
  const n = Math.round(rate.configuredRate ?? rate.rate);
  const nStr = n.toLocaleString("fr-FR");
  // Sens configuré uniquement, entier, sans inverse décimal.
  if (isCdfPrimary(rate)) return `${nStr} CDF = 1 $`;
  return `1 $ = ${nStr} CDF`;
}

/** @deprecated Préférer formatConfiguredRateLabel (taux entier, pas d’inverse décimal). */
export function formatInverseRate(usdToCdfRate: number) {
  if (!(usdToCdfRate > 0)) return "—";
  return `${Math.round(usdToCdfRate).toLocaleString("fr-FR")} CDF = 1 USD`;
}

/** Toujours les deux sens entiers : 1 USD = N CDF et N CDF = 1 USD. */
export function formatBothRateLabels(
  rate: Pick<
    NormalizedUsdCdfRate,
    "rate" | "configuredFrom" | "configuredTo" | "configuredRate"
  > | null | undefined,
) {
  if (!rate || !(rate.rate > 0)) return null;
  const n = Math.round(rate.rate);
  const nStr = n.toLocaleString("fr-FR");
  const usdToCdf = `1 $ = ${nStr} CDF`;
  const cdfToUsd = `${nStr} CDF = 1 $`;
  const configured = formatConfiguredRateLabel(rate);
  return {
    configured,
    usdToCdf,
    cdfToUsd,
    both: configured,
  };
}

/** Snapshot sérialisable pour les rapports client. */
export type ReportExchangeRate = {
  rate: number;
  configuredFrom: string;
  configuredTo: string;
  configuredRate: number;
};

export function toReportExchangeRate(
  rate: NormalizedUsdCdfRate | null | undefined,
): ReportExchangeRate | null {
  if (!rate || !(rate.rate > 0)) return null;
  const n = Math.round(rate.rate);
  return {
    rate: n,
    configuredFrom: rate.configuredFrom,
    configuredTo: rate.configuredTo,
    configuredRate: n,
  };
}

/** Devise de saisie UI selon le sens du taux fixé (CDF ou $). */
export function primaryCurrencyLabel(
  rate?: Pick<NormalizedUsdCdfRate, "configuredFrom"> | null,
): "CDF" | "$" {
  return isCdfPrimary(rate) ? "CDF" : "$";
}

/** USD catalogue → montant saisi dans la devise principale. */
export function usdToPrimaryNumber(
  amountUsd: number,
  rate?: Pick<NormalizedUsdCdfRate, "rate" | "configuredFrom"> | null,
): number {
  if (!Number.isFinite(amountUsd)) return NaN;
  if (isCdfPrimary(rate) && rate && rate.rate > 0) {
    return usdToCdfInteger(amountUsd, rate.rate);
  }
  return amountUsd;
}

/** Montant saisi (devise principale) → USD stocké. */
export function primaryAmountToUsd(
  primary: number,
  rate?: Pick<NormalizedUsdCdfRate, "rate" | "configuredFrom"> | null,
): number {
  if (!Number.isFinite(primary)) return NaN;
  if (isCdfPrimary(rate) && rate && rate.rate > 0) {
    return primary / Math.round(rate.rate);
  }
  return primary;
}

/**
 * Total ligne en devise principale (qté × PU) sans passer par l’USD,
 * pour éviter les erreurs float du type 1 250 000 → 1 250 010 CDF.
 */
export function primaryLineTotal(
  quantity: number,
  unitPrimary: number,
  rate?: Pick<NormalizedUsdCdfRate, "configuredFrom"> | null,
): number {
  const q = Math.round(Number(quantity) || 0);
  const u = Number(unitPrimary) || 0;
  if (!Number.isFinite(u)) return NaN;
  if (isCdfPrimary(rate)) return q * Math.round(u);
  return Math.round(q * u * 100) / 100;
}

/**
 * Affiche un total de ligne stocké en USD : reconstruit qté × PU arrondi
 * en CDF (si CDF primaire) au lieu de convertir le produit USD.
 */
export function formatUsdLineTotal(
  quantity: number,
  unitPriceUsd: number,
  rate?: Pick<NormalizedUsdCdfRate, "rate" | "configuredFrom"> | null,
): string {
  if (isCdfPrimary(rate) && rate && rate.rate > 0) {
    const totalCdf = usdLinePrimaryNumber(quantity, unitPriceUsd, rate);
    return `${totalCdf.toLocaleString("fr-FR")} CDF`;
  }
  return formatPrimaryAmount(usdLinePrimaryNumber(quantity, unitPriceUsd, rate), rate);
}

/** Somme de lignes : Σ (qté × round(P.U.×taux)) — évite +3 / +8 FC. */
export function formatUsdLinesTotal(
  lines: { quantity: number; unitPriceUsd: number }[],
  rate?: Pick<NormalizedUsdCdfRate, "rate" | "configuredFrom"> | null,
): string {
  const total = usdLinesPrimaryTotal(lines, rate);
  if (isCdfPrimary(rate) && rate && rate.rate > 0) {
    return `${total.toLocaleString("fr-FR")} CDF`;
  }
  return formatPrimaryAmount(total, rate);
}

/** Affiche un total déjà en devise principale (CDF entier ou USD). */
export function formatAlreadyPrimaryAmount(
  amount: number,
  rate?: Pick<NormalizedUsdCdfRate, "rate" | "configuredFrom"> | null,
) {
  if (isCdfPrimary(rate)) {
    return `${Math.round(amount).toLocaleString("fr-FR")} CDF`;
  }
  return formatPrimaryAmount(amount, rate);
}

/** USD catalogue depuis un total ligne déjà en devise principale. */
export function primaryTotalToUsd(
  quantity: number,
  unitPrimary: number,
  rate?: Pick<NormalizedUsdCdfRate, "rate" | "configuredFrom"> | null,
): number {
  return primaryAmountToUsd(primaryLineTotal(quantity, unitPrimary, rate), rate);
}

/** Valeur d’input préremplie depuis un montant USD. */
export function formatUsdPrimaryInputValue(
  amountUsd: number,
  rate?: Pick<NormalizedUsdCdfRate, "rate" | "configuredFrom"> | null,
): string {
  if (!Number.isFinite(amountUsd)) return "";
  const n = usdToPrimaryNumber(amountUsd, rate);
  if (!Number.isFinite(n)) return "";
  if (isCdfPrimary(rate)) {
    return String(Math.round(n));
  }
  const rounded = Math.round(n * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
}

export function primaryPriceInputStep(
  rate?: Pick<NormalizedUsdCdfRate, "configuredFrom"> | null,
): string {
  return isCdfPrimary(rate) ? "1" : "0.01";
}
