/**
 * Paiement en ligne hôtel — mode stub (réutilisé units-07).
 *
 * Même pattern que `lib/reservation/payment-stub.ts`.
 * Aucun prestataire Mobile Money n’est branché pour l’instant.
 *
 * TODO(prestataire): remplacer `simulateHotelStubPayment` par l’API réelle
 * avant mise en prod.
 */

export const HOTEL_ONLINE_PAYMENT_MODE = "stub" as const;

export type HotelStubPaymentResult = {
  ok: true;
  mode: typeof HOTEL_ONLINE_PAYMENT_MODE;
  reference: string;
  methode: "MOBILE_MONEY";
};

/** Simule un paiement Mobile Money réussi (dev / démo client). */
export function simulateHotelStubPayment(input: {
  token: string;
  amount: number;
}): HotelStubPaymentResult {
  const short = input.token.replace(/-/g, "").slice(0, 8).toUpperCase();
  const reference = `HSTUB-${short}-${Math.round(input.amount)}-${Date.now()}`;
  return {
    ok: true,
    mode: HOTEL_ONLINE_PAYMENT_MODE,
    reference,
    methode: "MOBILE_MONEY",
  };
}
