import type { FolioLineKind } from "@/prisma/generated/prisma/client";
import { paymentAmountUsd } from "@/lib/hotel/meeting-deposit";
import { FOLIO_SECTION_LABEL } from "@/lib/hotel/folio-note";
import { stayGroupSettlement } from "@/lib/hotel/stay-group-settlement";

export type StayGroupInvoiceLine = {
  roomNumber: string;
  roomTypeName: string;
  guestName: string;
  kind: FolioLineKind;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  cancelled?: boolean;
};

export type StayGroupInvoice = {
  bookingId: string;
  code: string;
  label: string | null;
  status: string;
  payTiming: string;
  invoiceNumber: string | null;
  invoiceIssuedAt: Date | null;
  invoiceHandedOverAt: Date | null;
  isProforma: boolean;
  billedTo: {
    kind: "partner" | "booker";
    name: string;
    address: string | null;
    city: string | null;
    phone: string | null;
    email: string | null;
    taxId: string | null;
  };
  checkInDate: Date | null;
  checkOutDate: Date | null;
  lines: StayGroupInvoiceLine[];
  subtotalStay: number;
  subtotalConsumption: number;
  subtotalOther: number;
  charges: number;
  paid: number;
  balance: number;
  /** À encaisser auprès du client */
  dueFromClient: number;
  /** Trop-perçu à rembourser */
  refundDue: number;
  stayCount: number;
  cancelledStayCount: number;
};

type BookingForInvoice = {
  id: string;
  code: string;
  label: string | null;
  status: string;
  payTiming: string;
  bookerName: string | null;
  bookerPhone: string | null;
  bookerEmail: string | null;
  invoiceNumber: string | null;
  invoiceIssuedAt: Date | null;
  invoiceHandedOverAt?: Date | null;
  partner: {
    name: string;
    address: string;
    city: string;
    phone: string | null;
    email: string | null;
    taxId: string | null;
  } | null;
  stays: {
    guestName: string;
    status: string;
    checkInDate: Date;
    checkOutDate: Date;
    room: { number: string; roomType: { name: string } };
    folio: {
      closed?: boolean;
      lines: {
        kind: FolioLineKind;
        description: string;
        quantity: number;
        unitPrice: number;
        amount: number;
      }[];
      payments: {
        amountCdf: number;
        amountForeign: number | null;
        note: string | null;
      }[];
    } | null;
  }[];
};

export function buildStayGroupInvoice(
  booking: BookingForInvoice,
): StayGroupInvoice {
  const lines: StayGroupInvoiceLine[] = [];
  let checkInDate: Date | null = null;
  let checkOutDate: Date | null = null;
  let cancelledStayCount = 0;

  const settlement = stayGroupSettlement(
    booking.stays.map((s) => ({
      id: s.guestName,
      status: s.status,
      guestName: s.guestName,
      room: { number: s.room.number },
      folio: s.folio
        ? {
            id: "x",
            closed: Boolean(s.folio.closed),
            lines: s.folio.lines,
            payments: s.folio.payments,
          }
        : null,
    })),
  );

  for (const stay of booking.stays) {
    const cancelled =
      stay.status === "CANCELLED" || stay.status === "NO_SHOW";
    if (cancelled) cancelledStayCount += 1;

    if (!cancelled) {
      if (
        !checkInDate ||
        stay.checkInDate.getTime() < checkInDate.getTime()
      ) {
        checkInDate = stay.checkInDate;
      }
      if (
        !checkOutDate ||
        stay.checkOutDate.getTime() > checkOutDate.getTime()
      ) {
        checkOutDate = stay.checkOutDate;
      }
    }

    if (!stay.folio) continue;

    if (cancelled) {
      lines.push({
        roomNumber: stay.room.number,
        roomTypeName: stay.room.roomType.name,
        guestName: stay.guestName,
        kind: "OTHER",
        description: "Chambre annulée (avant check-in) — charges annulées",
        quantity: 0,
        unitPrice: 0,
        amount: 0,
        cancelled: true,
      });
      continue;
    }

    for (const line of stay.folio.lines) {
      if (Math.abs(line.amount) < 0.005 && line.quantity === 0) continue;
      lines.push({
        roomNumber: stay.room.number,
        roomTypeName: stay.room.roomType.name,
        guestName: stay.guestName,
        kind: line.kind,
        description: line.description,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        amount: line.amount,
        cancelled: false,
      });
    }
  }

  const activeLines = lines.filter((l) => !l.cancelled);
  const subtotalStay = activeLines
    .filter(
      (l) =>
        l.kind === "NIGHT" ||
        l.kind === "STAY_FLAT" ||
        l.kind === "STAY_OVERTIME",
    )
    .reduce((s, l) => s + l.amount, 0);
  const subtotalConsumption = activeLines
    .filter((l) => l.kind === "FNB" || l.kind === "PRODUCT")
    .reduce((s, l) => s + l.amount, 0);
  const subtotalOther = activeLines
    .filter(
      (l) =>
        l.kind !== "NIGHT" &&
        l.kind !== "STAY_FLAT" &&
        l.kind !== "STAY_OVERTIME" &&
        l.kind !== "FNB" &&
        l.kind !== "PRODUCT",
    )
    .reduce((s, l) => s + l.amount, 0);

  const activeStays = booking.stays.filter(
    (s) => s.status !== "CANCELLED" && s.status !== "NO_SHOW",
  );
  const allClosed =
    activeStays.length === 0 ||
    activeStays.every((s) => s.status === "CHECKED_OUT");
  const isProforma = booking.status !== "CLOSED" && !allClosed;

  const billedTo = booking.partner
    ? {
        kind: "partner" as const,
        name: booking.partner.name,
        address: booking.partner.address,
        city: booking.partner.city,
        phone: booking.partner.phone,
        email: booking.partner.email,
        taxId: booking.partner.taxId,
      }
    : {
        kind: "booker" as const,
        name: booking.bookerName?.trim() || "Booker",
        address: null,
        city: null,
        phone: booking.bookerPhone,
        email: booking.bookerEmail,
        taxId: null,
      };

  return {
    bookingId: booking.id,
    code: booking.code,
    label: booking.label,
    status: booking.status,
    payTiming: booking.payTiming,
    invoiceNumber: booking.invoiceNumber,
    invoiceIssuedAt: booking.invoiceIssuedAt,
    invoiceHandedOverAt: booking.invoiceHandedOverAt ?? null,
    isProforma,
    billedTo,
    checkInDate,
    checkOutDate,
    lines,
    subtotalStay,
    subtotalConsumption,
    subtotalOther,
    charges: settlement.charges,
    paid: settlement.paid,
    balance: settlement.balance,
    dueFromClient: settlement.dueFromClient,
    refundDue: settlement.refundDue,
    stayCount: activeStays.length,
    cancelledStayCount,
  };
}

export function stayGroupSectionLabel(kind: FolioLineKind): string {
  return FOLIO_SECTION_LABEL[kind] ?? kind;
}

export function sumPaymentUsd(
  payments: { amountCdf: number; amountForeign: number | null }[],
) {
  return payments.reduce((s, p) => s + paymentAmountUsd(p), 0);
}
