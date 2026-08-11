import type { FolioLineKind, Prisma } from "@/prisma/generated/prisma/client";

export const ORDER_SETTLEMENT = {
  COMPTANT: "COMPTANT",
  NOTE_CHAMBRE: "NOTE_CHAMBRE",
} as const;

export type OrderSettlementMode =
  (typeof ORDER_SETTLEMENT)[keyof typeof ORDER_SETTLEMENT];

export function isNoteChambreMode(mode: string | null | undefined) {
  return mode === ORDER_SETTLEMENT.NOTE_CHAMBRE;
}

export const FOLIO_SECTION_LABEL: Record<FolioLineKind, string> = {
  NIGHT: "Nuitées",
  STAY_FLAT: "Forfait séjour",
  STAY_OVERTIME: "Heures supplémentaires",
  FNB: "Consommations",
  PRODUCT: "Produits",
  TAX: "Taxes",
  OTHER: "Autres",
};

export type FolioStatementLine = {
  id: string;
  kind: FolioLineKind;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  createdAt: Date;
};

export type FolioStatementPayment = {
  id: string;
  receiptNumber: string;
  method: string;
  amountUsd: number;
  amountCdf: number;
  paidAt: Date;
  note: string | null;
};

export type StayFolioStatement = {
  stayId: string;
  folioId: string;
  closed: boolean;
  guestName: string;
  roomNumber: string;
  checkInDate: Date;
  checkOutDate: Date;
  stayStatus: string;
  lines: FolioStatementLine[];
  payments: FolioStatementPayment[];
  sections: {
    kind: FolioLineKind;
    label: string;
    lines: FolioStatementLine[];
    total: number;
  }[];
  charges: number;
  paid: number;
  balance: number;
};

function paymentUsd(p: {
  amountForeign: number | null;
  amountCdf: number;
}) {
  return p.amountForeign != null && p.amountForeign > 0
    ? p.amountForeign
    : p.amountCdf;
}

/** Construit la facture séjour (note de chambre) à partir d’un folio chargé. */
export function buildStayFolioStatement(input: {
  stay: {
    id: string;
    guestName: string;
    checkInDate: Date;
    checkOutDate: Date;
    status: string;
    room: { number: string };
  };
  folio: {
    id: string;
    closed: boolean;
    lines: Array<{
      id: string;
      kind: FolioLineKind;
      description: string;
      quantity: number;
      unitPrice: number;
      amount: number;
      createdAt: Date;
    }>;
    payments: Array<{
      id: string;
      receiptNumber: string;
      method: string;
      amountCdf: number;
      amountForeign: number | null;
      paidAt: Date;
      note: string | null;
    }>;
  };
}): StayFolioStatement {
  const lines: FolioStatementLine[] = [...input.folio.lines]
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .map((l) => ({
      id: l.id,
      kind: l.kind,
      description: l.description,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      amount: l.amount,
      createdAt: l.createdAt,
    }));

  const payments: FolioStatementPayment[] = [...input.folio.payments]
    .sort((a, b) => a.paidAt.getTime() - b.paidAt.getTime())
    .map((p) => ({
      id: p.id,
      receiptNumber: p.receiptNumber,
      method: p.method,
      amountUsd: paymentUsd(p),
      amountCdf: p.amountCdf,
      paidAt: p.paidAt,
      note: p.note,
    }));

  const kindOrder: FolioLineKind[] = [
    "NIGHT",
    "STAY_FLAT",
    "STAY_OVERTIME",
    "FNB",
    "PRODUCT",
    "TAX",
    "OTHER",
  ];
  const byKind = new Map<FolioLineKind, FolioStatementLine[]>();
  for (const line of lines) {
    const list = byKind.get(line.kind) ?? [];
    list.push(line);
    byKind.set(line.kind, list);
  }

  const sections = kindOrder
    .filter((k) => (byKind.get(k)?.length ?? 0) > 0)
    .map((kind) => {
      const sectionLines = byKind.get(kind)!;
      return {
        kind,
        label: FOLIO_SECTION_LABEL[kind],
        lines: sectionLines,
        total: sectionLines.reduce((s, l) => s + l.amount, 0),
      };
    });

  const charges = lines.reduce((s, l) => s + l.amount, 0);
  const paid = payments.reduce((s, p) => s + p.amountUsd, 0);

  return {
    stayId: input.stay.id,
    folioId: input.folio.id,
    closed: input.folio.closed,
    guestName: input.stay.guestName,
    roomNumber: input.stay.room.number,
    checkInDate: input.stay.checkInDate,
    checkOutDate: input.stay.checkOutDate,
    stayStatus: input.stay.status,
    lines,
    payments,
    sections,
    charges,
    paid,
    balance: charges - paid,
  };
}

type Tx = Prisma.TransactionClient;

/** Impute les articles d’une commande Sur note sur le folio (idempotent). */
export async function postOrderToFolio(
  tx: Tx,
  orderId: string,
): Promise<{ posted: boolean; amount: number }> {
  const order = await tx.hotelOrder.findUnique({
    where: { id: orderId },
    include: { items: true },
  });
  if (!order) throw new Error("Commande introuvable.");
  if (!isNoteChambreMode(order.settlementMode)) {
    return { posted: false, amount: 0 };
  }
  if (order.postedToFolioAt) {
    return {
      posted: false,
      amount: order.items.reduce((s, i) => s + i.amount, 0),
    };
  }
  if (!order.folioId) {
    throw new Error("Commande Sur note sans folio.");
  }

  const folio = await tx.folio.findUnique({ where: { id: order.folioId } });
  if (!folio || folio.closed) {
    throw new Error("Note de chambre fermée ou introuvable.");
  }

  const short = order.id.slice(0, 8);
  let amount = 0;
  for (const item of order.items) {
    amount += item.amount;
    await tx.folioLine.create({
      data: {
        folioId: folio.id,
        kind: "FNB",
        description: `${item.name} (#${short})`,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        amount: item.amount,
      },
    });
  }

  await tx.hotelOrder.update({
    where: { id: order.id },
    data: {
      postedToFolioAt: new Date(),
      status: "LIVREE",
      deliveredAt: order.deliveredAt ?? new Date(),
      readyAt: order.readyAt ?? new Date(),
    },
  });

  await tx.folio.update({
    where: { id: folio.id },
    data: { updatedAt: new Date() },
  });

  return { posted: true, amount };
}
