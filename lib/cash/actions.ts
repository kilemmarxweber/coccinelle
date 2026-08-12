"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { canAccessBranch } from "@/lib/branch/user-branches";
import { branchBasePath } from "@/lib/branch/paths";
import prisma from "@/lib/prisma";
import { normalizeUsdCdfRate } from "@/lib/cash/exchange";

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
  if (!(input.rate > 0)) throw new Error("Taux invalide.");
  const from = input.fromCurrency.trim().toUpperCase() || "USD";
  const to = input.toCurrency.trim().toUpperCase() || "CDF";
  const pairOk =
    (from === "USD" && to === "CDF") || (from === "CDF" && to === "USD");
  if (!pairOk) {
    throw new Error("Choisissez USD → CDF ou CDF → USD.");
  }
  const row = await prisma.exchangeRate.create({
    data: {
      branchId: input.branchId,
      fromCurrency: from,
      toCurrency: to,
      rate: input.rate,
      validFrom: new Date(),
    },
  });
  revalidateBranch(input.organizationId, input.branchId);
  return row;
}

export async function getOpenCashSession(branchId: string) {
  return prisma.cashSession.findFirst({
    where: { branchId, status: "OPEN" },
    orderBy: { openedAt: "desc" },
  });
}

export async function openCashSessionAction(input: {
  organizationId: string;
  branchId: string;
  openingFloat?: number;
}) {
  const { user } = await ctx(input.organizationId, input.branchId);
  const open = await getOpenCashSession(input.branchId);
  if (open) throw new Error("Une session de caisse est déjà ouverte.");
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
  const open = await getOpenCashSession(input.branchId);
  if (!open) throw new Error("Aucune session ouverte.");
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
  method: "CASH" | "MOBILE_MONEY" | "CARTE";
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

  const cashSession = await getOpenCashSession(input.branchId);
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
          (isRefund ? "Remboursement départ anticipé" : null),
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
        const charges = folio.lines.reduce((s, l) => s + l.amount, 0);
        const paid = folio.payments.reduce(
          (s, pay) =>
            s +
            (pay.amountForeign != null && pay.amountForeign !== 0
              ? pay.amountForeign
              : pay.amountCdf),
          0,
        );
        const folioBalance = charges - paid;
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
  const charges = lines.reduce((s, l) => s + l.amount, 0);
  // Folio hôtel en USD : priorité amountForeign
  const paid = payments.reduce(
    (s, p) =>
      s +
      (p.amountForeign != null && p.amountForeign !== 0
        ? p.amountForeign
        : p.amountCdf),
    0,
  );
  return charges - paid;
}

export async function listOpenFoliosAction(
  organizationId: string,
  branchId: string,
) {
  await ctx(organizationId, branchId);
  const folios = await prisma.folio.findMany({
    where: { branchId, closed: false },
    include: {
      stay: { include: { room: true } },
      lines: true,
      payments: true,
    },
    orderBy: [{ checkoutQueuedAt: "asc" }, { updatedAt: "desc" }],
  });
  return folios.map((f) => {
    const charges = f.lines.reduce((s, l) => s + l.amount, 0);
    const paid = f.payments.reduce(
      (s, p) =>
        s +
        (p.amountForeign != null && p.amountForeign !== 0
          ? p.amountForeign
          : p.amountCdf),
      0,
    );
    return {
      ...f,
      balance: charges - paid,
      inCheckoutQueue: f.checkoutQueuedAt != null,
    };
  });
}

export async function listReadyOrdersAction(
  organizationId: string,
  branchId: string,
) {
  await ctx(organizationId, branchId);
  return prisma.hotelOrder.findMany({
    where: {
      branchId,
      status: {
        in: ["ENVOYEE", "EN_PREPARATION", "PRETE", "EN_CAISSE", "PAYEE"],
      },
      // Sur note : hors file encaissement F&B (réglé via note de chambre)
      NOT: { settlementMode: "NOTE_CHAMBRE" },
    },
    include: {
      items: true,
      stay: { include: { room: true } },
    },
    orderBy: [{ readyAt: "asc" }, { updatedAt: "asc" }],
  });
}

export async function getTodayPaymentsAction(
  organizationId: string,
  branchId: string,
) {
  await ctx(organizationId, branchId);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return prisma.payment.findMany({
    where: { branchId, paidAt: { gte: start } },
    orderBy: { paidAt: "desc" },
    take: 50,
  });
}

export async function getPaymentByIdAction(
  organizationId: string,
  branchId: string,
  paymentId: string,
) {
  await ctx(organizationId, branchId);
  return prisma.payment.findFirst({
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
}
