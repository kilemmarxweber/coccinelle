import type { MethodePaiement, StatutPaiement } from "@/prisma/generated/prisma/client";

export const HOTEL_PAYMENT_METHODS = [
  "CASH",
  "MOBILE_MONEY",
  "CARTE",
] as const satisfies ReadonlyArray<MethodePaiement>;

export type HotelPaymentMethod = (typeof HOTEL_PAYMENT_METHODS)[number];

export const HOTEL_PAYMENT_METHOD_LABELS: Record<HotelPaymentMethod, string> = {
  CASH: "Espèces",
  MOBILE_MONEY: "Mobile Money",
  CARTE: "Carte",
};

export const HOTEL_PAYMENT_STATUS_LABELS: Record<StatutPaiement, string> = {
  EN_ATTENTE: "En attente",
  PAYE: "Payé",
  ECHOUE: "Échoué",
};

/** Arrondi monétaire CDF (2 décimales). */
export function roundMoney(amount: number): number {
  return Math.round(amount * 100) / 100;
}

export function computeBalance(total: number, paid: number): number {
  return roundMoney(Math.max(0, total - paid));
}
