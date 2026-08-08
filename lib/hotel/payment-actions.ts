"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import type { ZodError } from "zod";
import { hotelRoutes } from "@/lib/branch/paths";
import { canAccessBranch } from "@/lib/branch/user-branches";
import {
  assertHotelFnbPermission,
  assertHotelStayPermission,
} from "@/lib/hotel/hotel-permission";
import {
  HOTEL_PAYMENT_METHODS,
  computeBalance,
  roundMoney,
} from "@/lib/hotel/payment-method";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; message: string };

function zodFirstMessage(err: ZodError): string {
  return err.issues[0]?.message ?? "Données invalides.";
}

async function assertHotelBranchAccess(
  organizationId: string,
  branchId: string,
): Promise<ActionResult<{ branchId: string }>> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return { ok: false, message: "Non authentifié." };
  }
  const branch = await canAccessBranch(
    session.user.id,
    session.user.role,
    branchId,
  );
  if (!branch || branch.organizationId !== organizationId) {
    return { ok: false, message: "Branche introuvable." };
  }
  if (branch.type !== "HOTEL") {
    return { ok: false, message: "Cette branche n’est pas un hôtel." };
  }
  return { ok: true, data: { branchId: branch.id } };
}

function revalidateStayPayment(
  organizationId: string,
  branchId: string,
  stayId: string,
) {
  revalidatePath(hotelRoutes.sejour(organizationId, branchId, stayId), "page");
  revalidatePath(hotelRoutes.sejours(organizationId, branchId), "page");
}

function revalidateFnbPayment(organizationId: string, branchId: string) {
  revalidatePath(hotelRoutes.restauration(organizationId, branchId), "page");
}

const orgBranchSchema = z.object({
  organizationId: z.string().min(1),
  branchId: z.string().uuid(),
});

const recordStayPaymentSchema = orgBranchSchema.extend({
  stayId: z.string().uuid(),
  amount: z.coerce.number().positive("Montant invalide."),
  method: z.enum(HOTEL_PAYMENT_METHODS),
  reference: z.string().trim().max(120).optional(),
});

const recordFoodOrderPaymentSchema = orgBranchSchema.extend({
  foodOrderId: z.string().uuid(),
  amount: z.coerce.number().positive("Montant invalide."),
  method: z.enum(HOTEL_PAYMENT_METHODS),
  reference: z.string().trim().max(120).optional(),
});

/** Encaissement folio séjour (staff) — pas de CashSession. */
export async function recordStayPaymentAction(
  input: z.infer<typeof recordStayPaymentSchema>,
): Promise<ActionResult<{ id: string }>> {
  const parsed = recordStayPaymentSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: zodFirstMessage(parsed.error) };
  }
  const { organizationId, branchId, stayId, amount, method, reference } =
    parsed.data;

  const perm = await assertHotelStayPermission(organizationId, "update");
  if (!perm.ok) return { ok: false, message: perm.message };

  const access = await assertHotelBranchAccess(organizationId, branchId);
  if (!access.ok) return access;

  const stay = await prisma.hotelStay.findFirst({
    where: { id: stayId, branchId },
    select: { id: true, totalAmount: true },
  });
  if (!stay) {
    return { ok: false, message: "Séjour introuvable." };
  }

  const paidAgg = await prisma.hotelPayment.aggregate({
    where: { stayId, branchId, status: "PAYE" },
    _sum: { amount: true },
  });
  const paid = roundMoney(paidAgg._sum.amount ?? 0);
  const balance = computeBalance(stay.totalAmount, paid);
  const payAmount = roundMoney(amount);

  if (payAmount > balance + 0.001) {
    return {
      ok: false,
      message: `Montant supérieur au solde (${balance.toFixed(0)} CDF).`,
    };
  }

  const payment = await prisma.hotelPayment.create({
    data: {
      branchId,
      stayId,
      amount: payAmount,
      method,
      status: "PAYE",
      reference: reference?.trim() || null,
    },
    select: { id: true },
  });

  revalidateStayPayment(organizationId, branchId, stayId);
  return { ok: true, data: { id: payment.id } };
}

/**
 * Encaissement commande F&B sans séjour (ticket restauration).
 * Les commandes liées à un séjour se règlent via le folio.
 */
export async function recordFoodOrderPaymentAction(
  input: z.infer<typeof recordFoodOrderPaymentSchema>,
): Promise<ActionResult<{ id: string }>> {
  const parsed = recordFoodOrderPaymentSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: zodFirstMessage(parsed.error) };
  }
  const { organizationId, branchId, foodOrderId, amount, method, reference } =
    parsed.data;

  const perm = await assertHotelFnbPermission(organizationId, "update");
  if (!perm.ok) return { ok: false, message: perm.message };

  const access = await assertHotelBranchAccess(organizationId, branchId);
  if (!access.ok) return access;

  const order = await prisma.hotelFoodOrder.findFirst({
    where: { id: foodOrderId, branchId },
    include: { lines: { select: { unitPrice: true, quantity: true } } },
  });
  if (!order) {
    return { ok: false, message: "Commande introuvable." };
  }
  if (order.stayId) {
    return {
      ok: false,
      message:
        "Cette commande est facturée au folio du séjour — encaisser depuis le séjour.",
    };
  }

  const total = roundMoney(
    order.lines.reduce(
      (sum, line) => sum + line.unitPrice * line.quantity,
      0,
    ),
  );
  const paidAgg = await prisma.hotelPayment.aggregate({
    where: { foodOrderId, branchId, status: "PAYE" },
    _sum: { amount: true },
  });
  const paid = roundMoney(paidAgg._sum.amount ?? 0);
  const balance = computeBalance(total, paid);
  const payAmount = roundMoney(amount);

  if (payAmount > balance + 0.001) {
    return {
      ok: false,
      message: `Montant supérieur au solde (${balance.toFixed(0)} CDF).`,
    };
  }

  const payment = await prisma.hotelPayment.create({
    data: {
      branchId,
      foodOrderId,
      amount: payAmount,
      method,
      status: "PAYE",
      reference: reference?.trim() || null,
    },
    select: { id: true },
  });

  revalidateFnbPayment(organizationId, branchId);
  return { ok: true, data: { id: payment.id } };
}
