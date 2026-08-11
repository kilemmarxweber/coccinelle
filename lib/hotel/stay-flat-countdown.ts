/** Décompte forfait / au temps (séjour FLAT). */

export type FlatStayCountdown = {
  totalMinutes: number;
  slotHours: number;
  slots: number;
  remainingSeconds: number;
  remainingLabel: string;
  elapsedLabel: string;
  overdue: boolean;
  overdueMinutes: number;
  /** 0..1 temps écoulé / alloué */
  progress: number;
  /** normal | warn (<30 min) | critical (<15 min ou dépassé) */
  tone: "normal" | "warn" | "critical";
  endsAt: Date;
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function formatClock(totalSeconds: number) {
  const abs = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(abs / 3600);
  const m = Math.floor((abs % 3600) / 60);
  const s = abs % 60;
  if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
  return `${m}:${pad(s)}`;
}

function formatElapsed(ms: number) {
  const mins = Math.floor(Math.max(0, ms) / 60_000);
  if (mins < 1) return "< 1 min";
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h} h ${m} min` : `${h} h`;
}

/**
 * Décompte depuis le check-in pour un forfait.
 * `slots` = nombre de créneaux facturés (1 + prolongations STAY_FLAT).
 * Si `frozenAt` est fourni (file caisse / check-out), le compteur est figé.
 */
export function flatStayCountdown(input: {
  plannedHours: number | null | undefined;
  checkedInAt: string | Date | null | undefined;
  /** Nombre de créneaux forfait (lignes STAY_FLAT). Défaut 1. */
  slots?: number | null;
  now?: number | null;
  /** Instant de gel (encaissement / file check-out) — arrête le compteur. */
  frozenAt?: string | Date | null;
}): FlatStayCountdown | null {
  const hours = input.plannedHours;
  const startedAt = input.checkedInAt;
  const slots = Math.max(1, Math.round(input.slots ?? 1));
  if (hours == null || !(hours > 0) || !startedAt) return null;

  const started = new Date(startedAt).getTime();
  if (!Number.isFinite(started)) return null;

  const frozen = input.frozenAt ? new Date(input.frozenAt).getTime() : NaN;
  const now = Number.isFinite(frozen)
    ? frozen
    : (input.now ?? Date.now());

  const totalMinutes = hours * 60 * slots;
  const totalMs = totalMinutes * 60_000;
  const endsAt = new Date(started + totalMs);
  const elapsed = Math.max(0, now - started);
  const remainingMs = totalMs - elapsed;
  const overdue = remainingMs < 0;
  const remainingSeconds = Math.floor(remainingMs / 1000);
  const absSec = Math.ceil(Math.abs(remainingMs) / 1000);
  const remainingLabel = overdue
    ? `+${formatClock(absSec)}`
    : formatClock(absSec);

  const remainingMins = remainingMs / 60_000;
  let tone: FlatStayCountdown["tone"] = "normal";
  if (overdue || remainingMins <= 15) tone = "critical";
  else if (remainingMins <= 30) tone = "warn";

  return {
    totalMinutes,
    slotHours: hours,
    slots,
    remainingSeconds,
    remainingLabel,
    elapsedLabel: formatElapsed(elapsed),
    overdue,
    overdueMinutes: overdue ? Math.ceil(Math.abs(remainingMs) / 60_000) : 0,
    progress: Math.min(1, elapsed / totalMs),
    tone,
    endsAt,
  };
}

export function formatFlatCountdownBanner(
  cd: FlatStayCountdown,
  opts?: { frozen?: boolean },
) {
  if (opts?.frozen) {
    if (cd.overdue) {
      return `Forfait clôturé · dépassé ${cd.remainingLabel} · en attente d’encaissement`;
    }
    return `Forfait clôturé · compteur arrêté · en attente d’encaissement`;
  }
  if (cd.overdue) {
    return `Temps dépassé ${cd.remainingLabel} · heures supp. à facturer`;
  }
  if (cd.tone === "critical") {
    return `Reste ${cd.remainingLabel} · prévenir le client`;
  }
  if (cd.tone === "warn") {
    return `Reste ${cd.remainingLabel} · bientôt la fin`;
  }
  return `Reste ${cd.remainingLabel}`;
}
