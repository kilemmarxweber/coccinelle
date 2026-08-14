"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { canAccessBranch } from "@/lib/branch/user-branches";
import { branchBasePath, hotelRoutes } from "@/lib/branch/paths";
import prisma from "@/lib/prisma";
import { integerUsdCdfRate, normalizeUsdCdfRate } from "@/lib/cash/exchange";
import {
  folioBalanceWithDeposit,
  MEETING_PAYMENT_NOTES,
} from "@/lib/hotel/meeting-deposit";
import { isNonSalesPaymentNote } from "@/lib/cash/cashier-report";

async function ctx(organizationId: string, branchId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) throw new Error("Non authentifié.");
  const branch = await canAccessBranch(
    session.user.id,
    session.user.role,
    branchId,
  );
  if (!branch || branch.organizationId !== organizationId) {
    throw new Error("Branche inaccessible.");
  }
  return { user: session.user, branch };
}

function revalidateBranch(organizationId: string, branchId: string) {
  const base = branchBasePath(organizationId, branchId);
  revalidatePath(base);
  revalidatePath(`${base}/caisse`);
  revalidatePath(`${base}/taux-change`);
  revalidatePath(`${base}/hotel/sejours`);
  revalidatePath(`${base}/hotel/chambres`);
  revalidatePath(`${base}/hotel/restauration`);
  revalidatePath(`${base}/hotel/cuisine`);
  revalidatePath(hotelRoutes.serviceStock(organizationId, branchId));
  revalidatePath(`${base}/rapports/tableau-bord`);
}

export async function getActiveExchangeRate(branchId: string) {
  const row = await prisma.exchangeRate.findFirst({
    where: { branchId },
    orderBy: { validFrom: "desc" },
  });
  return normalizeUsdCdfRate(row);
}

export async function listExchangeRatesAction(
  organizationId: string,
  branchId: string,
) {
  await ctx(organizationId, branchId);
  return prisma.exchangeRate.findMany({
    where: { branchId },
    orderBy: { validFrom: "desc" },
    take: 30,
  });
}

export async function setExchangeRateAction(input: {
  organizationId: string;
  branchId: string;
  fromCurrency: string;
  toCurrency: string;
  rate: number;
}) {
  await ctx(input.organizationId, input.branchId);
  const from = input.fromCurrency.trim().toUpperCase() || "USD";
  const to = input.toCurrency.trim().toUpperCase() || "CDF";
  const pairOk =
    (from === "USD" && to === "CDF") || (from === "CDF" && to === "USD");
  if (!pairOk) {
    throw new Error("Choisissez USD → CDF ou CDF → USD.");
  }
  // Toujours un entier : N FC = 1 $ (ex. 2250). Jamais de fraction.
  const rate = integerUsdCdfRate(input.rate);
  const row = await prisma.exchangeRate.create({
    data: {
      branchId: input.branchId,
      fromCurrency: from,
      toCurrency: to,
      rate,
      validFrom: new Date(),
    },
  });
  revalidateBranch(input.organizationId, input.branchId);
  return row;
}

/** Session de caisse OPEN du caissier courant (jamais celle d’un autre). */
export async function getOpenCashSession(branchId: string, userId: string) {
  return prisma.cashSession.findFirst({
    where: { branchId, status: "OPEN", openedByUserId: userId },
    orderBy: { openedAt: "desc" },
  });
}

/** Sessions OPEN laissées par d’autres caissiers (oubli de clôture) — lecture seule. */
export async function getForeignOpenCashSessions(
  branchId: string,
  userId: string,
) {
  const rows = await prisma.cashSession.findMany({
    where: { branchId, status: "OPEN", openedByUserId: { not: userId } },
    orderBy: { openedAt: "desc" },
    select: {
      id: true,
      openedAt: true,
      openingFloat: true,
      openedByUserId: true,
    },
  });
  if (rows.length === 0) return [];
  const users = await prisma.user.findMany({
    where: { id: { in: [...new Set(rows.map((r) => r.openedByUserId))] } },
    select: { id: true, name: true, email: true },
  });
  const byId = new Map(
    users.map((u) => [
      u.id,
      (u.name?.trim() || u.email || "Caissier").trim(),
    ]),
  );
  return rows.map((r) => ({
    id: r.id,
    openedAt: r.openedAt,
    openingFloat: r.openingFloat,
    openedByUserId: r.openedByUserId,
    openedByName: byId.get(r.openedByUserId) ?? "Caissier",
  }));
}

/** Situation caisse ouverte : fond + mouvements → solde théorique (session du user). */
export async function getOpenCashDrawerSummary(
  branchId: string,
  userId: string,
) {
  const session = await getOpenCashSession(branchId, userId);
  if (!session) return null;

  const [rateRow, payments] = await Promise.all([
    getActiveExchangeRate(branchId),
    prisma.payment.findMany({
      where: { cashSessionId: session.id },
      select: { amountCdf: true, amountForeign: true, method: true },
    }),
  ]);

  const usdRate = rateRow?.rate && rateRow.rate > 0 ? rateRow.rate : null;
  let movementsUsd = 0;
  for (const p of payments) {
    // Virement / banque : hors float cash physique
    if (p.method === "BANK") continue;
    if (p.amountForeign != null && p.amountForeign !== 0) {
      movementsUsd += p.amountForeign;
    } else if (usdRate) {
      movementsUsd += p.amountCdf / usdRate;
    } else {
      movementsUsd += p.amountCdf;
    }
  }
  movementsUsd = Math.round(movementsUsd * 100) / 100;
  const openingFloatUsd = Math.round(session.openingFloat * 100) / 100;
  const balanceUsd =
    Math.round((openingFloatUsd + movementsUsd) * 100) / 100;

  return {
    sessionId: session.id,
    openedAt: session.openedAt,
    openingFloatUsd,
    movementsUsd,
    balanceUsd,
    movementsCount: payments.length,
  };
}

export async function openCashSessionAction(input: {
  organizationId: string;
  branchId: string;
  openingFloat?: number;
}) {
  const { user } = await ctx(input.organizationId, input.branchId);
  const open = await getOpenCashSession(input.branchId, user.id);
  if (open) throw new Error("Vous avez déjà une session de caisse ouverte.");
  const session = await prisma.cashSession.create({
    data: {
      branchId: input.branchId,
      openedByUserId: user.id,
      openingFloat: input.openingFloat ?? 0,
      status: "OPEN",
    },
  });
  revalidateBranch(input.organizationId, input.branchId);
  return session;
}

export async function closeCashSessionAction(input: {
  organizationId: string;
  branchId: string;
  closingCash?: number;
}) {
  const { user } = await ctx(input.organizationId, input.branchId);
  const open = await getOpenCashSession(input.branchId, user.id);
  if (!open) {
    throw new Error(
      "Aucune session de caisse ouverte pour vous. Une session d’un autre caissier reste la sienne jusqu’à sa clôture.",
    );
  }
  const session = await prisma.cashSession.update({
    where: { id: open.id },
    data: {
      status: "CLOSED",
      closedAt: new Date(),
      closedByUserId: user.id,
      closingCash: input.closingCash ?? undefined,
    },
  });
  revalidateBranch(input.organizationId, input.branchId);
  return session;
}

async function nextReceiptNumber(branchId: string) {
  const count = await prisma.payment.count({ where: { branchId } });
  const n = String(count + 1).padStart(5, "0");
  return `RC-${n}`;
}

export async function createPaymentAction(input: {
  organizationId: string;
  branchId: string;
  amountCdf: number;
  method: "CASH" | "MOBILE_MONEY" | "CARTE" | "BANK";
  folioId?: string;
  orderId?: string;
  amountForeign?: number;
  note?: string;
  /** Remboursement (montants négatifs) — solde note < 0 après départ anticipé */
  isRefund?: boolean;
}) {
  const { user } = await ctx(input.organizationId, input.branchId);
  const isRefund = Boolean(input.isRefund);
  if (isRefund) {
    if (!(input.amountCdf < -0.01)) {
      throw new Error("Montant de remboursement invalide.");
    }
    if (input.amountForeign != null && !(input.amountForeign < -0.01)) {
      throw new Error("Montant devises de remboursement invalide.");
    }
  } else if (!(input.amountCdf > 0)) {
    throw new Error("Montant invalide.");
  }

  const cashSession = await getOpenCashSession(input.branchId, user.id);
  if (!cashSession) throw new Error("Ouvrez une session de caisse d’abord.");

  const rate = await getActiveExchangeRate(input.branchId);
  const receiptNumber = await nextReceiptNumber(input.branchId);

  const payment = await prisma.$transaction(async (tx) => {
    const p = await tx.payment.create({
      data: {
        branchId: input.branchId,
        cashSessionId: cashSession.id,
        folioId: input.folioId ?? null,
        orderId: input.orderId ?? null,
        receiptNumber,
        method: input.method,
        amountCdf: input.amountCdf,
        amountForeign: input.amountForeign ?? null,
        foreignCurrency: rate?.fromCurrency ?? "USD",
        exchangeRateUsed: rate?.rate ?? null,
        cashierUserId: user.id,
        note:
          input.note ??
          (isRefund ? MEETING_PAYMENT_NOTES.cautionRefund : null),
      },
    });

    if (input.orderId) {
      if (isRefund) {
        throw new Error("Remboursement commande non pris en charge ici.");
      }
      const existing = await tx.hotelOrder.findFirst({
        where: { id: input.orderId, branchId: input.branchId },
        select: { deliveredAt: true, tableLabel: true },
      });
      const alreadyDelivered = existing?.deliveredAt != null;
      await tx.hotelOrder.update({
        where: { id: input.orderId },
        data: {
          status: alreadyDelivered ? "LIVREE" : "PAYEE",
          paidAt: new Date(),
        },
      });
      await tx.branchNotification.create({
        data: {
          branchId: input.branchId,
          title: alreadyDelivered
            ? "Commande encaissée"
            : "Commande payée",
          body: alreadyDelivered
            ? `Encaissée (${receiptNumber}) — déjà livrée.`
            : `Commande encaissée (${receiptNumber}). À livrer.`,
          kind: alreadyDelivered ? "order_paid_delivered" : "order_paid",
          href: alreadyDelivered
            ? `/admin/organizations/${input.organizationId}/branches/${input.branchId}/caisse/recu/${p.id}`
            : `/admin/organizations/${input.organizationId}/branches/${input.branchId}/hotel/restauration?view=suivi&orderId=${input.orderId}`,
        },
      });
    }

    if (input.folioId) {
      const folio = await tx.folio.findFirst({
        where: { id: input.folioId, branchId: input.branchId },
        include: {
          stay: { include: { room: { include: { roomType: true } } } },
          lines: true,
          payments: true,
        },
      });
      if (folio) {
        const folioBalance = folioBalanceWithDeposit({
          lines: folio.lines,
          payments: folio.payments,
        });
        if (Math.abs(folioBalance) <= 0.01) {
          // Note soldée (payée ou remboursée) — clôturer + check-out si besoin
          await tx.folio.update({
            where: { id: folio.id },
            data: { closed: true, checkoutQueuedAt: null },
          });
          if (folio.stay && folio.stay.status === "CHECKED_IN") {
            const freeStatus =
              folio.stay.room.roomType.kind === "MEETING"
                ? "AVAILABLE"
                : "CLEANING";
            await tx.hotelStay.update({
              where: { id: folio.stay.id },
              data: {
                status: "CHECKED_OUT",
                checkedOutAt: new Date(),
              },
            });
            await tx.hotelRoom.update({
              where: { id: folio.stay.roomId },
              data: { status: freeStatus },
            });
            await tx.branchNotification.create({
              data: {
                branchId: input.branchId,
                title: isRefund
                  ? "Check-out après remboursement"
                  : "Check-out après encaissement",
                body: `${folio.stay.guestName} · note soldée (${receiptNumber})`,
                kind: "stay_checkout",
                href: `/admin/organizations/${input.organizationId}/branches/${input.branchId}/hotel/sejours`,
              },
            });
          }
        } else if (folio.checkoutQueuedAt) {
          // Solde partiel : garder en file, compteur reste figé
          await tx.folio.update({
            where: { id: folio.id },
            data: { updatedAt: new Date() },
          });
        }
      }
    }

    return p;
  });

  revalidateBranch(input.organizationId, input.branchId);
  return payment;
}

export async function getFolioBalance(folioId: string) {
  const [lines, payments] = await Promise.all([
    prisma.folioLine.findMany({ where: { folioId } }),
    prisma.payment.findMany({ where: { folioId } }),
  ]);
  return folioBalanceWithDeposit({ lines, payments });
}

export async function listOpenFoliosAction(
  organizationId: string,
  branchId: string,
) {
  const { user } = await ctx(organizationId, branchId);
  const cash = await getOpenCashSession(branchId, user.id);
  if (!cash) return [];
  const folios = await prisma.folio.findMany({
    where: {
      branchId,
      closed: false,
      OR: [
        { createdAt: { gte: cash.openedAt } },
        { checkoutQueuedAt: { gte: cash.openedAt } },
        { payments: { some: { cashSessionId: cash.id } } },
      ],
    },
    include: {
      stay: { include: { room: true } },
      lines: true,
      payments: true,
    },
    orderBy: [{ checkoutQueuedAt: "asc" }, { updatedAt: "desc" }],
  });
  return folios.map((f) => {
    const balance = folioBalanceWithDeposit({
      lines: f.lines,
      payments: f.payments,
    });
    return {
      ...f,
      balance,
      inCheckoutQueue: f.checkoutQueuedAt != null,
    };
  });
}

export async function listReadyOrdersAction(
  organizationId: string,
  branchId: string,
) {
  const { user } = await ctx(organizationId, branchId);
  const cash = await getOpenCashSession(branchId, user.id);
  if (!cash) return [];
  const orders = await prisma.hotelOrder.findMany({
    where: {
      branchId,
      status: {
        in: ["ENVOYEE", "EN_PREPARATION", "PRETE", "EN_CAISSE", "PAYEE"],
      },
      // Sur note : hors file encaissement F&B (réglé via note de chambre)
      NOT: { settlementMode: "NOTE_CHAMBRE" },
      OR: [
        { createdAt: { gte: cash.openedAt } },
        { readyAt: { gte: cash.openedAt } },
        { paidAt: { gte: cash.openedAt } },
        { payments: { some: { cashSessionId: cash.id } } },
      ],
    },
    include: {
      items: true,
      stay: { include: { room: true } },
    },
    orderBy: [{ readyAt: "asc" }, { updatedAt: "asc" }],
  });
  const ids = [...new Set(orders.map((o) => o.createdByUserId).filter(Boolean))];
  const users =
    ids.length === 0
      ? []
      : await prisma.user.findMany({
          where: { id: { in: ids } },
          select: { id: true, name: true, email: true },
        });
  const names = new Map(
    users.map((u) => [
      u.id,
      (u.name?.trim() || u.email || "Serveur").trim(),
    ]),
  );
  return orders.map((o) => ({
    ...o,
    createdByName: names.get(o.createdByUserId) ?? "Serveur",
  }));
}

/** Paiements de la session caisse du caissier courant (pas le total du jour). */
export async function getTodayPaymentsAction(
  organizationId: string,
  branchId: string,
) {
  const { user } = await ctx(organizationId, branchId);
  const cash = await getOpenCashSession(branchId, user.id);
  if (!cash) return [];
  return prisma.payment.findMany({
    where: {
      branchId,
      cashSessionId: cash.id,
      cashierUserId: user.id,
    },
    orderBy: { paidAt: "desc" },
    take: 200,
  });
}

function paymentUsdAmount(
  p: { amountCdf: number; amountForeign: number | null },
  cdfPerUsd: number | null,
) {
  if (p.amountForeign != null && p.amountForeign !== 0) return p.amountForeign;
  if (cdfPerUsd && cdfPerUsd > 0) return p.amountCdf / cdfPerUsd;
  return p.amountCdf;
}

/** Snapshot imprimable de la session caisse ouverte (avant clôture). */
export async function getCashierShiftReportAction(
  organizationId: string,
  branchId: string,
) {
  const { user, branch } = await ctx(organizationId, branchId);
  const cash = await getOpenCashSession(branchId, user.id);
  if (!cash) {
    throw new Error("Aucune session de caisse ouverte pour vous.");
  }
  const rate = await getActiveExchangeRate(branchId);
  const cdfPerUsd = rate?.rate && rate.rate > 0 ? rate.rate : null;

  const payments = await prisma.payment.findMany({
    where: { cashSessionId: cash.id, cashierUserId: user.id },
    include: {
      folio: {
        include: {
          stay: { include: { room: true } },
        },
      },
      order: {
        include: {
          items: true,
          stay: { include: { room: true } },
        },
      },
      shopSale: { include: { items: true } },
    },
    orderBy: { paidAt: "asc" },
  });

  const leftoverFolios = await prisma.folio.findMany({
    where: {
      branchId,
      closed: false,
      OR: [
        { createdAt: { gte: cash.openedAt } },
        { checkoutQueuedAt: { gte: cash.openedAt } },
      ],
    },
    include: {
      stay: { include: { room: true } },
      lines: true,
      payments: true,
    },
  });
  const leftoverOrders = await prisma.hotelOrder.findMany({
    where: {
      branchId,
      status: { in: ["PRETE", "EN_CAISSE"] },
      createdAt: { gte: cash.openedAt },
      NOT: { settlementMode: "NOTE_CHAMBRE" },
    },
    include: { items: true, stay: { include: { room: true } } },
  });

  const roomsMap = new Map<
    string,
    { guestName: string; roomNumber: string; receipts: string[]; amountUsd: number }
  >();
  const fnbTickets: {
    label: string;
    items: string;
    amountUsd: number;
  }[] = [];
  const productsMap = new Map<string, { name: string; quantity: number; amountUsd: number }>();

  const mappedPayments = payments.map((p) => {
    const usd = paymentUsdAmount(p, cdfPerUsd);
    const guestName = p.folio?.stay?.guestName ?? p.order?.stay?.guestName ?? null;
    const roomNumber =
      p.folio?.stay?.room?.number ?? p.order?.stay?.room?.number ?? null;
    if (p.folioId && p.folio && !isNonSalesPaymentNote(p.note)) {
      const key = p.folioId;
      const cur = roomsMap.get(key) ?? {
        guestName: guestName || p.folio.label || "Note",
        roomNumber: roomNumber || "—",
        receipts: [],
        amountUsd: 0,
      };
      cur.receipts.push(p.receiptNumber);
      cur.amountUsd += usd;
      roomsMap.set(key, cur);
    }
    if (p.order) {
      const itemsLabel = p.order.items
        .map((i) => `${i.quantity}× ${i.name}`)
        .join(", ");
      fnbTickets.push({
        label:
          p.order.tableLabel ||
          (roomNumber ? `Ch. ${roomNumber}` : p.receiptNumber),
        items: itemsLabel || "—",
        amountUsd: usd,
      });
      for (const item of p.order.items) {
        const cur = productsMap.get(item.name) ?? {
          name: item.name,
          quantity: 0,
          amountUsd: 0,
        };
        cur.quantity += item.quantity;
        cur.amountUsd += item.amount;
        productsMap.set(item.name, cur);
      }
    }
    if (p.shopSale) {
      for (const item of p.shopSale.items) {
        const cur = productsMap.get(item.name) ?? {
          name: item.name,
          quantity: 0,
          amountUsd: 0,
        };
        cur.quantity += item.quantity;
        cur.amountUsd += item.quantity * item.unitPrice;
        productsMap.set(item.name, cur);
      }
    }
    return {
      id: p.id,
      receiptNumber: p.receiptNumber,
      method: p.method,
      amountCdf: p.amountCdf,
      amountForeign: p.amountForeign,
      paidAt: p.paidAt,
      note: p.note,
      folioLabel: p.folio?.label ?? null,
      roomNumber,
      guestName,
      orderLabel: p.order?.tableLabel ?? null,
      orderItems: (p.order?.items ?? []).map((i) => ({
        name: i.name,
        quantity: i.quantity,
        amount: i.amount,
      })),
    };
  });

  const leftoverNotes = leftoverFolios
    .map((f) => {
      const balance = folioBalanceWithDeposit({
        lines: f.lines,
        payments: f.payments,
      });
      if (Math.abs(balance) <= 0.01) return null;
      const label = f.stay
        ? `${f.stay.guestName} · ch. ${f.stay.room.number}`
        : f.label || "Note";
      return { label, balanceUsd: balance };
    })
    .filter((x): x is { label: string; balanceUsd: number } => x != null);

  const leftoverFnb = leftoverOrders.map((o) => ({
    label:
      o.tableLabel ||
      (o.stay ? `${o.stay.guestName} · ch. ${o.stay.room.number}` : o.id.slice(0, 8)),
    amountUsd: o.items.reduce((s, i) => s + i.amount, 0),
  }));

  return {
    branchName: branch.name,
    cashierName: user.name?.trim() || user.email || "Caissier",
    openedAt: cash.openedAt,
    openingFloat: cash.openingFloat,
    cdfPerUsd,
    payments: mappedPayments,
    rooms: [...roomsMap.values()].map((r) => ({
      guestName: r.guestName,
      roomNumber: r.roomNumber,
      receipts: r.receipts.join(", "),
      amountUsd: r.amountUsd,
    })),
    fnbTickets,
    products: [...productsMap.values()].sort((a, b) => b.amountUsd - a.amountUsd),
    leftoverNotes,
    leftoverFnb,
  };
}

export async function getPaymentByIdAction(
  organizationId: string,
  branchId: string,
  paymentId: string,
) {
  await ctx(organizationId, branchId);
  const payment = await prisma.payment.findFirst({
    where: { id: paymentId, branchId },
    include: {
      folio: {
        include: {
          lines: { orderBy: { createdAt: "asc" } },
          stay: { include: { room: true } },
        },
      },
      order: {
        include: {
          items: { orderBy: { name: "asc" } },
        },
      },
      shopSale: {
        include: {
          items: { orderBy: { name: "asc" } },
        },
      },
    },
  });
  if (!payment) return payment;
  if (!payment.order?.createdByUserId) {
    return {
      ...payment,
      order: payment.order
        ? { ...payment.order, createdByName: null as string | null }
        : payment.order,
    };
  }
  const server = await prisma.user.findUnique({
    where: { id: payment.order.createdByUserId },
    select: { name: true, email: true },
  });
  return {
    ...payment,
    order: {
      ...payment.order,
      createdByName:
        server?.name?.trim() || server?.email?.trim() || "Serveur",
    },
  };
}
