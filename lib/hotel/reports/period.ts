/** Helpers période pour les rapports hôtel. */

export function toIsoDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function startOfLocalDay(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1, 0, 0, 0, 0);
}

export function endOfLocalDay(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1, 23, 59, 59, 999);
}

export function defaultReportRange(days = 30) {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - (days - 1));
  return { from: toIsoDate(from), to: toIsoDate(to) };
}

export function currentMonthRange(d = new Date()) {
  const from = new Date(d.getFullYear(), d.getMonth(), 1);
  return { from: toIsoDate(from), to: toIsoDate(d) };
}

/** Période précédente de même durée (juste avant `from`). */
export function previousRange(fromIso: string, toIso: string) {
  const from = startOfLocalDay(fromIso);
  const to = endOfLocalDay(toIso);
  const ms = to.getTime() - from.getTime() + 1;
  const prevTo = new Date(from.getTime() - 1);
  const prevFrom = new Date(prevTo.getTime() - ms + 1);
  return { from: toIsoDate(prevFrom), to: toIsoDate(prevTo) };
}

export function eachDayIso(fromIso: string, toIso: string): string[] {
  const out: string[] = [];
  const cur = startOfLocalDay(fromIso);
  const end = startOfLocalDay(toIso);
  while (cur <= end) {
    out.push(toIsoDate(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

export function dayKey(d: Date | string) {
  const x = d instanceof Date ? d : new Date(d);
  return toIsoDate(x);
}

export function pctDelta(current: number, previous: number) {
  if (previous === 0) return current === 0 ? 0 : 100;
  return Math.round(((current - previous) / Math.abs(previous)) * 1000) / 10;
}

export function paymentAmountUsd(
  p: { amountCdf: number; amountForeign?: number | null },
  usdToCdfRate: number | null,
) {
  // Inclure montants négatifs (sorties / remboursements).
  if (p.amountForeign != null && p.amountForeign !== 0) return p.amountForeign;
  if (usdToCdfRate && usdToCdfRate > 0) return p.amountCdf / usdToCdfRate;
  return p.amountCdf;
}
