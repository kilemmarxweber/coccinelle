export const STATUT_RESERVATION_LABELS: Record<string, string> = {
  CONFIRME: "Confirmée",
  EMBARQUE: "Embarquée",
  RATE: "Ratée",
  REPORTE: "Reportée",
  ANNULE: "Annulée",
};

export const STATUT_PAIEMENT_LABELS: Record<string, string> = {
  EN_ATTENTE: "En attente",
  PAYE: "Payé",
  ECHOUE: "Échoué",
};

export const SOURCE_RESERVATION_LABELS: Record<string, string> = {
  GUICHET: "Guichet",
  EN_LIGNE: "En ligne",
};

export const METHODE_PAIEMENT_LABELS: Record<string, string> = {
  CASH: "Espèces",
  MOBILE_MONEY: "Mobile Money",
  CARTE: "Carte",
};

export const CATEGORIE_PASSAGER_LABELS: Record<string, string> = {
  ADULTE: "Adulte",
  ENFANT: "Enfant",
  BEBE: "Bébé",
};

export function formatMontantFc(value: number): string {
  return new Intl.NumberFormat("fr-CD", {
    style: "currency",
    currency: "CDF",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDateFr(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTimeFr(date: Date | string, heure?: string): string {
  const base = formatDateFr(date);
  return heure ? `${base} · ${heure}` : base;
}
