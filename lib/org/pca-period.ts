export type PcaView = "jour" | "jours" | "mois" | "annee";

export type PcaPeriod = {
  view: PcaView;
  year: number;
  month: number;
  day: number;
  span: number;
  from: Date;
  to: Date;
  includesToday: boolean;
  periodLabel: string;
  rangeLabel: string;
  reportKind: string;
  dayKpiLabel: string;
  periodKpiLabel: string;
  periodColumnLabel: string;
  seriesGrain: "jour" | "mois";
  monthsInPeriod: number;
};

const MONTHS = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];

const MIN_YEAR = 2020;
const MAX_SPAN = 366;

export function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

export function endOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

/** Nombre de jours du mois de `d` (`Date(y, m+1, 0)` = dernier jour du mois courant). */
function daysInMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function inclusiveDays(from: Date, to: Date) {
  const ms = startOfDay(to).getTime() - startOfDay(from).getTime();
  return Math.round(ms / 86_400_000) + 1;
}

function formatRange(from: Date, to: Date) {
  const sameMonth =
    from.getMonth() === to.getMonth() && from.getFullYear() === to.getFullYear();
  if (sameMonth) {
    return `${from.getDate()} – ${to.getDate()} ${MONTHS[to.getMonth()]} ${to.getFullYear()}`;
  }
  if (from.getFullYear() === to.getFullYear()) {
    return `${from.getDate()} ${MONTHS[from.getMonth()]} – ${to.getDate()} ${MONTHS[to.getMonth()]} ${to.getFullYear()}`;
  }
  return `${from.getDate()} ${MONTHS[from.getMonth()]} ${from.getFullYear()} – ${to.getDate()} ${MONTHS[to.getMonth()]} ${to.getFullYear()}`;
}

function parseView(vue?: string | null): PcaView {
  if (vue === "annee" || vue === "jour" || vue === "jours") return vue;
  return "mois";
}

export function resolvePcaPeriod(
  input: {
    vue?: string | null;
    annee?: string | null;
    mois?: string | null;
    jour?: string | null;
    n?: string | null;
  },
  now = new Date(),
): PcaPeriod {
  const today = startOfDay(now);
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;
  const view = parseView(input.vue);

  let year = Number(input.annee);
  if (!Number.isInteger(year) || year < MIN_YEAR || year > currentYear) {
    year = currentYear;
  }

  let month = Number(input.mois);
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    month = year === currentYear ? currentMonth : 12;
  }
  if (year === currentYear && month > currentMonth) month = currentMonth;

  const daysInMonth = new Date(year, month, 0).getDate();
  let day = Number(input.jour);
  const defaultDay =
    year === currentYear && month === currentMonth ? today.getDate() : daysInMonth;
  if (!Number.isInteger(day) || day < 1 || day > daysInMonth) day = defaultDay;
  if (year === currentYear && month === currentMonth && day > today.getDate()) {
    day = today.getDate();
  }

  let requestedSpan = Number(input.n);
  if (!Number.isInteger(requestedSpan) || requestedSpan < 1) requestedSpan = 7;
  if (requestedSpan > MAX_SPAN) requestedSpan = MAX_SPAN;

  let from: Date;
  let to: Date;
  if (view === "annee") {
    from = new Date(year, 0, 1, 0, 0, 0, 0);
    to = endOfDay(new Date(year, 11, 31));
  } else if (view === "mois") {
    from = new Date(year, month - 1, 1, 0, 0, 0, 0);
    to = endOfDay(new Date(year, month, 0));
  } else {
    const end = new Date(year, month - 1, day);
    const span = view === "jour" ? 1 : requestedSpan;
    from = new Date(end.getFullYear(), end.getMonth(), end.getDate() - (span - 1));
    const earliest = new Date(MIN_YEAR, 0, 1);
    if (from < earliest) from = earliest;
    to = endOfDay(end);
  }

  const todayEnd = endOfDay(today);
  if (to.getTime() > todayEnd.getTime()) to = todayEnd;
  if (from.getTime() > startOfDay(to).getTime()) from = startOfDay(to);

  const includesToday =
    today.getTime() >= startOfDay(from).getTime() &&
    today.getTime() <= startOfDay(to).getTime();
  const span = inclusiveDays(from, to);
  const end = startOfDay(to);
  /** Objectif mensuel proratisé sur les jours réellement couverts — peut dépasser 100 %. */
  const monthsInPeriod = Math.round(proratedMonths(from, to) * 1000) / 1000;

  const endLabel = `${end.getDate()} ${MONTHS[end.getMonth()]} ${end.getFullYear()}`;
  const periodLabel =
    view === "annee"
      ? `Année ${year}`
      : view === "mois"
        ? `${capitalize(MONTHS[month - 1]!)} ${year}`
        : view === "jour"
          ? capitalize(endLabel)
          : formatRange(from, to);
  const rangeLabel = view === "jour" ? capitalize(endLabel) : formatRange(from, to);
  const reportKind =
    view === "annee"
      ? "Rapport annuel"
      : view === "mois"
        ? "Rapport mensuel"
        : view === "jour"
          ? "Rapport du jour"
          : "Période";

  return {
    view,
    year: end.getFullYear(),
    month: end.getMonth() + 1,
    day: end.getDate(),
    span,
    from,
    to,
    includesToday,
    periodLabel,
    rangeLabel,
    reportKind,
    dayKpiLabel: span === 1 || includesToday ? "Ventes du jour" : "Dernier jour",
    periodKpiLabel:
      view === "annee"
        ? "Ventes de l'année"
        : view === "mois"
          ? "Ventes du mois"
          : view === "jour"
            ? "Ventes de la journée"
            : "Ventes de la période",
    periodColumnLabel:
      view === "annee" ? "Année" : view === "mois" ? "Mois" : view === "jour" ? "Journée" : "Période",
    seriesGrain: view === "annee" ? "mois" : "jour",
    monthsInPeriod,
  };
}

function proratedMonths(from: Date, to: Date) {
  let factor = 0;
  const cur = startOfDay(from);
  const end = startOfDay(to);
  while (cur <= end) {
    factor += 1 / daysInMonth(cur);
    cur.setDate(cur.getDate() + 1);
  }
  return factor;
}

/**
 * % d’atteinte : ventes / (objectif mensuel × mois proratisés).
 * Sur 1 ou 2 jours la part d’objectif est trop fine : le résultat est
 * plafonné à 100. Sans vente sur cette fenêtre : 0. Au-delà de 2 jours,
 * le dépassement reste visible.
 */
export function pcaTargetPct(
  salesUsd: number,
  monthlyTargetUsd: number | null | undefined,
  monthsInPeriod: number,
  spanDays?: number,
) {
  if (
    monthlyTargetUsd == null ||
    !(monthlyTargetUsd > 0) ||
    !(monthsInPeriod > 0)
  ) {
    return null;
  }
  const short = spanDays === 1 || spanDays === 2;
  if (short && !(salesUsd > 0)) return 0;
  const raw = Math.round((salesUsd / (monthlyTargetUsd * monthsInPeriod)) * 100);
  if (!short) return raw;
  return Math.min(100, Math.max(0, raw));
}
