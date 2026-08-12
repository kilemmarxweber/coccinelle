/** Normalise un taux stocké pour toujours exposer 1 USD = X CDF côté métier hôtel/caisse. */

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
  /** Toujours 1 USD = rate CDF */
  fromCurrency: "USD";
  toCurrency: "CDF";
  /** Sens tel que saisi en config */
  configuredFrom: string;
  configuredTo: string;
  configuredRate: number;
};

export function normalizeUsdCdfRate(
  row: ExchangeRateRow | null | undefined,
): NormalizedUsdCdfRate | null {
  if (!row || !(row.rate > 0)) return null;
  const from = row.fromCurrency.trim().toUpperCase();
  const to = row.toCurrency.trim().toUpperCase();

  let usdToCdf: number;
  if (from === "USD" && to === "CDF") {
    usdToCdf = row.rate;
  } else if (from === "CDF" && to === "USD") {
    usdToCdf = 1 / row.rate;
  } else {
    return {
      ...row,
      fromCurrency: "USD",
      toCurrency: "CDF",
      rate: row.rate,
      configuredFrom: from,
      configuredTo: to,
      configuredRate: row.rate,
    };
  }

  return {
    ...row,
    fromCurrency: "USD",
    toCurrency: "CDF",
    rate: usdToCdf,
    configuredFrom: from,
    configuredTo: to,
    configuredRate: row.rate,
  };
}

/** Affichage principal en CDF si le taux a été saisi CDF → USD. */
export function isCdfPrimary(
  rate?: Pick<NormalizedUsdCdfRate, "configuredFrom"> | null,
) {
  return rate?.configuredFrom?.toUpperCase() === "CDF";
}

export function usdToCdfAmount(amountUsd: number, usdToCdfRate: number) {
  return amountUsd * usdToCdfRate;
}

/** Montant principal selon le sens de taux (prix produit / CA). */
export function formatPrimaryAmount(
  amountUsd: number,
  rate?: Pick<NormalizedUsdCdfRate, "rate" | "configuredFrom"> | null,
) {
  if (isCdfPrimary(rate) && rate && rate.rate > 0) {
    return `${usdToCdfAmount(amountUsd, rate.rate).toLocaleString("fr-FR", {
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
  return `${usdToCdfAmount(amountUsd, rate.rate).toLocaleString("fr-FR", {
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
    "configuredFrom" | "configuredTo" | "configuredRate"
  >,
) {
  return `1 ${rate.configuredFrom} = ${rate.configuredRate} ${rate.configuredTo}`;
}

export function formatInverseRate(usdToCdfRate: number, digits = 6) {
  if (!(usdToCdfRate > 0)) return "—";
  return (1 / usdToCdfRate).toLocaleString("fr-FR", {
    maximumFractionDigits: digits,
    minimumFractionDigits: Math.min(4, digits),
  });
}

/** Toujours les deux sens : 1 USD = … CDF et 1 CDF = … USD. */
export function formatBothRateLabels(
  rate: Pick<
    NormalizedUsdCdfRate,
    "rate" | "configuredFrom" | "configuredTo" | "configuredRate"
  > | null | undefined,
) {
  if (!rate || !(rate.rate > 0)) return null;
  const usdToCdf = `1 USD = ${rate.rate.toLocaleString("fr-FR", {
    maximumFractionDigits: 2,
  })} CDF`;
  const cdfToUsd = `1 CDF = ${formatInverseRate(rate.rate)} USD`;
  return {
    configured: formatConfiguredRateLabel(rate),
    usdToCdf,
    cdfToUsd,
    /** Ex. « Fixé CDF→USD · 1 USD = 2 850 CDF · 1 CDF = 0,000351 USD » */
    both: `Fixé ${rate.configuredFrom}→${rate.configuredTo} · ${usdToCdf} · ${cdfToUsd}`,
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
  return {
    rate: rate.rate,
    configuredFrom: rate.configuredFrom,
    configuredTo: rate.configuredTo,
    configuredRate: rate.configuredRate,
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
    return amountUsd * rate.rate;
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
    return primary / rate.rate;
  }
  return primary;
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
