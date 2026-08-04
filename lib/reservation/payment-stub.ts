/**
 * Paiement en ligne — mode stub (U15).
 *
 * Aucun prestataire Mobile Money n’est branché pour l’instant.
 * Le checkout simule un encaissement réussi et marque le paiement `PAYE`
 * avec méthode `MOBILE_MONEY` et une référence `STUB-*`.
 *
 * TODO(prestataire): remplacer `simulateStubPayment` par l’API réelle
 * (init intent → redirect / webhook → confirm) avant mise en prod.
 */

export const ONLINE_PAYMENT_MODE = "stub" as const;

export type StubPaymentResult = {
  ok: true;
  mode: typeof ONLINE_PAYMENT_MODE;
  reference: string;
  methode: "MOBILE";
};

/** Simule un paiement Mobile Money réussi (dev / démo). */
export function simulateStubPayment(input: {
  draftToken: string;
  amount: number;
}): StubPaymentResult {
  const short = input.draftToken.replace(/-/g, "").slice(0, 8).toUpperCase();
  const reference = `STUB-${short}-${Math.round(input.amount)}-${Date.now()}`;
  return {
    ok: true,
    mode: ONLINE_PAYMENT_MODE,
    reference,
    methode: "MOBILE",
  };
}
