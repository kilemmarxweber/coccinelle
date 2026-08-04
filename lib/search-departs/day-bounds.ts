/**
 * Bornes [start, end) du jour calendaire local pour filtrer `dateDepart`.
 * Accepte `YYYY-MM-DD` (input date HTML) ou un `Date`.
 */
export function dayBounds(date: string | Date): { start: Date; end: Date } {
  if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date.trim())) {
    const [y, m, d] = date.trim().split("-").map(Number);
    const start = new Date(y, m - 1, d, 0, 0, 0, 0);
    const end = new Date(y, m - 1, d + 1, 0, 0, 0, 0);
    return { start, end };
  }

  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) {
    throw new Error("Date invalide.");
  }
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
  const end = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 0, 0, 0);
  return { start, end };
}

/** Début du jour calendaire local « aujourd'hui ». */
export function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
}

/** Date du jour locale au format `YYYY-MM-DD` (input date HTML). */
export function todayIsoLocal(date: Date = new Date()): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
