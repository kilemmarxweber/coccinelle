/** Helpers temps de préparation / décompte commande cuisine. */

export function elapsedLabel(from: string | Date | null | undefined, now: number) {
  if (!from) return "—";
  const ms = Math.max(0, now - new Date(from).getTime());
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "< 1 min";
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h} h ${m} min`;
}

export function urgencyTone(from: string | Date | null | undefined, now: number) {
  if (!from) return "normal" as const;
  const mins = (now - new Date(from).getTime()) / 60000;
  if (mins >= 20) return "critical" as const;
  if (mins >= 10) return "warn" as const;
  return "normal" as const;
}

export type PrepCountdown = {
  totalMinutes: number;
  remainingSeconds: number;
  remainingLabel: string;
  overdue: boolean;
  overdueMinutes: number;
  progress: number; // 0..1
};

export function prepCountdown(
  estimatedMinutes: number | null | undefined,
  prepStartedAt: string | Date | null | undefined,
  now: number,
): PrepCountdown | null {
  if (
    estimatedMinutes == null ||
    estimatedMinutes <= 0 ||
    !prepStartedAt
  ) {
    return null;
  }
  const started = new Date(prepStartedAt).getTime();
  const totalMs = estimatedMinutes * 60_000;
  const elapsed = Math.max(0, now - started);
  const remainingMs = totalMs - elapsed;
  const overdue = remainingMs < 0;
  const absSec = Math.ceil(Math.abs(remainingMs) / 1000);
  const mins = Math.floor(absSec / 60);
  const secs = absSec % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    totalMinutes: estimatedMinutes,
    remainingSeconds: Math.floor(remainingMs / 1000),
    remainingLabel: overdue
      ? `+${mins}:${pad(secs)}`
      : `${mins}:${pad(secs)}`,
    overdue,
    overdueMinutes: overdue ? Math.ceil(Math.abs(remainingMs) / 60_000) : 0,
    progress: Math.min(1, elapsed / totalMs),
  };
}

export function formatCountdownBanner(cd: PrepCountdown) {
  if (cd.overdue) return `En retard ${cd.remainingLabel}`;
  return `Reste ${cd.remainingLabel}`;
}
