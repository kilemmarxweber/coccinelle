import {
  folioPaidTowardBalance,
  paymentAmountUsd,
  paymentCountsTowardFolioBalance,
} from "@/lib/hotel/meeting-deposit";
import {
  isCdfPrimary,
  type NormalizedUsdCdfRate,
} from "@/lib/cash/exchange";

export const STAY_GROUP_PAYMENT_NOTES = {
  payment: "Paiement dossier",
  refund: "Remboursement dossier groupe",
  cancelCredit: "Annulation chambre · crédit dossier",
} as const;

export type StayGroupSettlementStay = {
  id: string;
  status: string;
  guestName: string;
  room: { number: string };
  folio: {
    id: string;
    closed: boolean;
    lines: {
      kind: string;
      amount: number;
      quantity?: number;
      unitPrice?: number;
    }[];
    payments: {
      amountCdf: number;
      amountForeign?: number | null;
      note?: string | null;
    }[];
  } | null;
};

/** Charges actives (hors chambres annulées / no-show) — USD. */
export function stayGroupActiveCharges(
  stays: StayGroupSettlementStay[],
): number {
  let charges = 0;
  for (const s of stays) {
    if (s.status === "CANCELLED" || s.status === "NO_SHOW") continue;
    if (!s.folio) continue;
    charges += s.folio.lines.reduce((sum, l) => sum + l.amount, 0);
  }
  return Math.round(charges * 100) / 100;
}

/**
 * Tous les paiements du dossier (y compris folios de chambres annulées),
 * pour que le trop-perçu après annulation reste visible.
 */
export function stayGroupNetPaid(stays: StayGroupSettlementStay[]): number {
  let paid = 0;
  for (const s of stays) {
    if (!s.folio) continue;
    paid += folioPaidTowardBalance(s.folio.payments);
  }
  return Math.round(paid * 100) / 100;
}

export function stayGroupSettlement(stays: StayGroupSettlementStay[]) {
  const charges = stayGroupActiveCharges(stays);
  const paid = stayGroupNetPaid(stays);
  const balance = Math.round((charges - paid) * 100) / 100;
  return {
    charges,
    paid,
    balance,
    dueFromClient: balance > 0.01 ? balance : 0,
    refundDue: balance < -0.01 ? Math.abs(balance) : 0,
  };
}

/**
 * Totaux dossier en devise d’affichage.
 * En CDF : somme qté × round(P.U.×taux) pour éviter 150 000 → 150 008.
 */
export function stayGroupSettlementDisplay(
  stays: StayGroupSettlementStay[],
  rate?: Pick<NormalizedUsdCdfRate, "rate" | "configuredFrom"> | null,
) {
  if (isCdfPrimary(rate) && rate && rate.rate > 0) {
    const r = Math.round(rate.rate);
    let charges = 0;
    let paid = 0;
    for (const s of stays) {
      if (s.folio) {
        for (const p of s.folio.payments) {
          if (!paymentCountsTowardFolioBalance(p)) continue;
          // CDF encaissé stocké à la caisse (entier) — source de vérité
          if (Number.isFinite(p.amountCdf)) {
            paid += Math.round(p.amountCdf);
          } else {
            paid += Math.round(paymentAmountUsd(p) * r);
          }
        }
      }
      if (s.status === "CANCELLED" || s.status === "NO_SHOW") continue;
      if (!s.folio) continue;
      for (const l of s.folio.lines) {
        const q = Number(l.quantity);
        const unit = Number(l.unitPrice);
        if (Number.isFinite(q) && q !== 0 && Number.isFinite(unit)) {
          charges += Math.round(q) * Math.round(unit * r);
        } else {
          charges += Math.round(Number(l.amount) * r);
        }
      }
    }
    const balance = charges - paid;
    return {
      charges,
      paid,
      balance,
      dueFromClient: balance > 0 ? balance : 0,
      refundDue: balance < 0 ? Math.abs(balance) : 0,
      /** Montants déjà en CDF — ne pas re-convertir via formatPrimaryAmount */
      amountsArePrimary: true as const,
    };
  }

  const s = stayGroupSettlement(stays);
  return { ...s, amountsArePrimary: false as const };
}

export function isStayGroupRefundNote(note: string | null | undefined) {
  if (!note) return false;
  const n = note.trim().toLowerCase();
  return (
    n.startsWith(STAY_GROUP_PAYMENT_NOTES.refund.toLowerCase()) ||
    n.includes("remboursement dossier")
  );
}

export function sumStayGroupRefunded(
  payments: {
    amountCdf: number;
    amountForeign?: number | null;
    note?: string | null;
  }[],
) {
  return payments
    .filter((p) => isStayGroupRefundNote(p.note) && paymentAmountUsd(p) < 0)
    .reduce((s, p) => s + Math.abs(paymentAmountUsd(p)), 0);
}
