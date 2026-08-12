/** Caution consommation — salles de réunion / fête */

export const MEETING_PAYMENT_NOTES = {
  locationAcompte: "Acompte location salle",
  locationFull: "Règlement location salle",
  caution: "Caution consommation",
  cautionRefund: "Remboursement caution consommation",
  overrun: "Dépassement caution",
} as const;

export function isCautionPaymentNote(note: string | null | undefined) {
  if (!note) return false;
  const n = note.trim().toLowerCase();
  return (
    n === MEETING_PAYMENT_NOTES.caution.toLowerCase() ||
    n.startsWith("caution consommation")
  );
}

export function isCautionRefundNote(note: string | null | undefined) {
  if (!note) return false;
  return note.trim().toLowerCase().startsWith("remboursement caution");
}

export function isLocationPaymentNote(note: string | null | undefined) {
  if (!note) return false;
  const n = note.trim().toLowerCase();
  return (
    n.includes("location salle") ||
    n === MEETING_PAYMENT_NOTES.locationAcompte.toLowerCase() ||
    n === MEETING_PAYMENT_NOTES.locationFull.toLowerCase()
  );
}

export type FolioLineLike = {
  kind: string;
  amount: number;
};

export type FolioPaymentLike = {
  amountCdf: number;
  amountForeign?: number | null;
  note?: string | null;
};

export function paymentAmountUsd(p: FolioPaymentLike) {
  return p.amountForeign != null && p.amountForeign !== 0
    ? p.amountForeign
    : p.amountCdf;
}

/** Paiements qui entrent dans le solde note (hors encaissement caution brut). */
export function paymentCountsTowardFolioBalance(p: FolioPaymentLike) {
  // La caution cash est représentée par la ligne DEPOSIT (crédit) ;
  // on n’ajoute pas le paiement caution une 2ᵉ fois dans « paid ».
  if (isCautionPaymentNote(p.note)) return false;
  return true;
}

export function sumDepositCredit(lines: FolioLineLike[]) {
  return lines
    .filter((l) => l.kind === "DEPOSIT")
    .reduce((s, l) => s + Math.abs(l.amount), 0);
}

export function sumConsumption(lines: FolioLineLike[]) {
  return lines
    .filter((l) => l.kind === "FNB" || l.kind === "PRODUCT")
    .reduce((s, l) => s + l.amount, 0);
}

export function sumLocationDue(lines: FolioLineLike[]) {
  return lines
    .filter(
      (l) =>
        l.kind === "STAY_FLAT" ||
        l.kind === "STAY_OVERTIME" ||
        l.kind === "NIGHT",
    )
    .reduce((s, l) => s + l.amount, 0);
}

export function sumLocationPaid(payments: FolioPaymentLike[]) {
  return payments
    .filter((p) => isLocationPaymentNote(p.note) && paymentAmountUsd(p) > 0)
    .reduce((s, p) => s + paymentAmountUsd(p), 0);
}

export function sumCautionPaid(payments: FolioPaymentLike[]) {
  return payments
    .filter((p) => isCautionPaymentNote(p.note) && paymentAmountUsd(p) > 0)
    .reduce((s, p) => s + paymentAmountUsd(p), 0);
}

export function sumCautionRefunded(payments: FolioPaymentLike[]) {
  return payments
    .filter((p) => isCautionRefundNote(p.note) && paymentAmountUsd(p) < 0)
    .reduce((s, p) => s + Math.abs(paymentAmountUsd(p)), 0);
}

/** Reliquat caution = caution − conso (après remboursements déjà faits). */
export function depositRemainder(input: {
  lines: FolioLineLike[];
  payments: FolioPaymentLike[];
}) {
  const caution = Math.max(
    sumDepositCredit(input.lines),
    sumCautionPaid(input.payments),
  );
  const conso = sumConsumption(input.lines);
  const alreadyRefunded = sumCautionRefunded(input.payments);
  return caution - conso - alreadyRefunded;
}

export function folioChargesTotal(lines: FolioLineLike[]) {
  return lines.reduce((s, l) => s + l.amount, 0);
}

export function folioPaidTowardBalance(payments: FolioPaymentLike[]) {
  return payments
    .filter(paymentCountsTowardFolioBalance)
    .reduce((s, p) => s + paymentAmountUsd(p), 0);
}

/** Solde note compatible caution (ligne DEPOSIT + paiements hors caution cash). */
export function folioBalanceWithDeposit(input: {
  lines: FolioLineLike[];
  payments: FolioPaymentLike[];
}) {
  return (
    folioChargesTotal(input.lines) - folioPaidTowardBalance(input.payments)
  );
}

export type MeetingCheckoutSettlement = {
  locationDue: number;
  locationPaid: number;
  locationBalance: number;
  cautionAmount: number;
  consumptionAmount: number;
  depositRemainder: number;
  /** > 0 → rembourser */
  refundDeposit: number;
  /** > 0 → encaisser (conso > caution) */
  collectOverrun: number;
  /** Solde folio global (location + caution net) */
  folioBalance: number;
};

export function meetingCheckoutSettlement(input: {
  lines: FolioLineLike[];
  payments: FolioPaymentLike[];
}): MeetingCheckoutSettlement {
  const locationDue = sumLocationDue(input.lines);
  const locationPaid = sumLocationPaid(input.payments);
  const locationBalance = locationDue - locationPaid;
  const cautionAmount = Math.max(
    sumDepositCredit(input.lines),
    sumCautionPaid(input.payments),
  );
  const consumptionAmount = sumConsumption(input.lines);
  const rem = depositRemainder(input);
  const refundDeposit = rem > 0.01 ? rem : 0;
  const collectOverrun = rem < -0.01 ? Math.abs(rem) : 0;
  const folioBalance = folioBalanceWithDeposit(input);

  return {
    locationDue,
    locationPaid,
    locationBalance,
    cautionAmount,
    consumptionAmount,
    depositRemainder: rem,
    refundDeposit,
    collectOverrun,
    folioBalance,
  };
}
