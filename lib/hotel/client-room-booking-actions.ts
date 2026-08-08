"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "@/lib/auth";
import {
  assertRoomTypeAvailable,
  listAvailableRoomTypes,
  parseBookingDateRange,
  type AvailableRoomType,
} from "@/lib/hotel/availability";
import { getPublicHotelBranchForOrg } from "@/lib/hotel/client-online-order";
import { buildNightFolioLines } from "@/lib/hotel/folio-nights";
import { simulateHotelStubPayment } from "@/lib/hotel/payment-stub";
import {
  advanceHotelStayDraftInputSchema,
  createHotelStayDraftInputSchema,
  hotelDraftGuestAdvanceSchema,
  payHotelStayDraftInputSchema,
  updateHotelStayDraftInputSchema,
} from "@/lib/hotel/stay-draft-schema";
import {
  HotelDraftExpiredError,
  HotelDraftNotFoundError,
  bindHotelStayDraftUser,
  consumeHotelStayDraft,
  createHotelStayDraft,
  getHotelStayDraft,
  updateHotelStayDraft,
} from "@/lib/hotel/stay-draft";
import { clientHotelRoutes } from "@/lib/branch/paths";
import { getPublicOrganizationBySlug } from "@/lib/pwa/org";
import { ensureClientForOnlineUser } from "@/lib/reservation/ensure-client-for-user";
import { reservationUniqueCode } from "@/lib/reservation/unique-code";
import prisma from "@/lib/prisma";

export type SearchRoomAvailabilityResult =
  | { ok: true; types: AvailableRoomType[]; nights: number }
  | { ok: false; error: string };

export async function searchHotelRoomAvailabilityAction(raw: unknown): Promise<SearchRoomAvailabilityResult> {
  const schema = z.object({
    orgSlug: z.string().trim().min(1),
    checkInDate: z.string().trim().min(1),
    checkOutDate: z.string().trim().min(1),
  });
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "Données invalides." };
  }

  const org = await getPublicOrganizationBySlug(parsed.data.orgSlug);
  if (!org) return { ok: false, error: "Organisation introuvable." };

  const hotel = await getPublicHotelBranchForOrg(org.id);
  if (!hotel) return { ok: false, error: "Hôtel introuvable." };

  const range = parseBookingDateRange(
    parsed.data.checkInDate,
    parsed.data.checkOutDate,
  );
  if (!range.ok) return { ok: false, error: range.error };

  const types = await listAvailableRoomTypes({
    branchId: hotel.id,
    checkInDate: range.checkInDate,
    checkOutDate: range.checkOutDate,
  });

  return { ok: true, types, nights: range.nights };
}

export async function createHotelStayDraftAction(
  raw: unknown,
): Promise<{ ok: true; draftToken: string } | { ok: false; error: string }> {
  const parsed = createHotelStayDraftInputSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Données invalides." };
  }

  const org = await getPublicOrganizationBySlug(parsed.data.orgSlug);
  if (!org) return { ok: false, error: "Organisation introuvable." };

  const hotel = await getPublicHotelBranchForOrg(org.id);
  if (!hotel) return { ok: false, error: "Hôtel introuvable." };

  const session = await auth.api.getSession({ headers: await headers() });

  try {
    const { draftToken } = await createHotelStayDraft({
      organizationId: org.id,
      branchId: hotel.id,
      roomTypeId: parsed.data.roomTypeId,
      checkInRaw: parsed.data.checkInDate,
      checkOutRaw: parsed.data.checkOutDate,
      userId: session?.user?.id ?? null,
    });
    return { ok: true, draftToken };
  } catch (e) {
    if (e instanceof HotelDraftNotFoundError) {
      return { ok: false, error: e.message };
    }
    throw e;
  }
}

/** Crée le brouillon puis redirige vers le checkout (formulaire recherche). */
export async function startHotelRoomCheckoutAction(
  formData: FormData,
): Promise<void> {
  const orgSlug = String(formData.get("orgSlug") ?? "");
  const roomTypeId = String(formData.get("roomTypeId") ?? "");
  const checkInDate = String(formData.get("checkInDate") ?? "");
  const checkOutDate = String(formData.get("checkOutDate") ?? "");

  const result = await createHotelStayDraftAction({
    orgSlug,
    roomTypeId,
    checkInDate,
    checkOutDate,
  });
  if (!result.ok) {
    redirect(
      `${clientHotelRoutes.recherche(orgSlug)}?error=${encodeURIComponent(result.error)}&checkIn=${encodeURIComponent(checkInDate)}&checkOut=${encodeURIComponent(checkOutDate)}`,
    );
  }
  redirect(clientHotelRoutes.checkout(orgSlug, result.draftToken));
}

export async function updateHotelStayDraftAction(
  raw: unknown,
): Promise<{ ok: true } | { ok: false; error: string; code?: "EXPIRED" | "NOT_FOUND" | "VALIDATION" }> {
  const parsed = updateHotelStayDraftInputSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "Données invalides.", code: "VALIDATION" };
  }

  const org = await getPublicOrganizationBySlug(parsed.data.orgSlug);
  if (!org) return { ok: false, error: "Organisation introuvable.", code: "NOT_FOUND" };

  try {
    await updateHotelStayDraft({
      organizationId: org.id,
      draftToken: parsed.data.draftToken,
      payload: parsed.data.payload,
    });
    return { ok: true };
  } catch (e) {
    if (e instanceof HotelDraftExpiredError) {
      return { ok: false, error: e.message, code: "EXPIRED" };
    }
    if (e instanceof HotelDraftNotFoundError) {
      return { ok: false, error: e.message, code: "NOT_FOUND" };
    }
    throw e;
  }
}

export async function advanceHotelStayDraftStepAction(
  raw: unknown,
): Promise<{ ok: true } | { ok: false; error: string; code?: "EXPIRED" | "NOT_FOUND" | "VALIDATION" }> {
  const parsed = advanceHotelStayDraftInputSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "Données invalides.", code: "VALIDATION" };
  }

  const org = await getPublicOrganizationBySlug(parsed.data.orgSlug);
  if (!org) return { ok: false, error: "Organisation introuvable.", code: "NOT_FOUND" };

  const guest = hotelDraftGuestAdvanceSchema.safeParse(parsed.data.payload);
  if (!guest.success) {
    return {
      ok: false,
      error: guest.error.issues[0]?.message ?? "Complétez les informations client.",
      code: "VALIDATION",
    };
  }

  try {
    await updateHotelStayDraft({
      organizationId: org.id,
      draftToken: parsed.data.draftToken,
      payload: { ...guest.data, step: "paiement" },
    });
    return { ok: true };
  } catch (e) {
    if (e instanceof HotelDraftExpiredError) {
      return { ok: false, error: e.message, code: "EXPIRED" };
    }
    if (e instanceof HotelDraftNotFoundError) {
      return { ok: false, error: e.message, code: "NOT_FOUND" };
    }
    throw e;
  }
}

export type HotelOnlinePayResult =
  | { ok: true; codeUnique: string; stayId: string }
  | {
      ok: false;
      error: string;
      code?:
        | "UNAUTHENTICATED"
        | "EXPIRED"
        | "CAPACITY"
        | "VALIDATION"
        | "NOT_FOUND"
        | "FORBIDDEN";
    };

/**
 * Auth obligatoire → stub paiement → séjour BOOKED + folio + HotelPayment PAYE, lié au user.
 */
export async function payAndConfirmHotelStayDraftAction(
  raw: unknown,
): Promise<HotelOnlinePayResult> {
  const parsed = payHotelStayDraftInputSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "Données invalides.", code: "VALIDATION" };
  }

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return {
      ok: false,
      error: "Connectez-vous pour confirmer la réservation.",
      code: "UNAUTHENTICATED",
    };
  }

  const org = await getPublicOrganizationBySlug(parsed.data.orgSlug);
  if (!org) {
    return { ok: false, error: "Organisation introuvable.", code: "NOT_FOUND" };
  }

  const draft = await getHotelStayDraft({
    organizationId: org.id,
    draftToken: parsed.data.draftToken,
  });
  if (!draft) {
    return { ok: false, error: "Brouillon introuvable.", code: "NOT_FOUND" };
  }
  if (draft.expired) {
    return {
      ok: false,
      error: "Ce brouillon de réservation a expiré.",
      code: "EXPIRED",
    };
  }
  if (draft.payload.step !== "paiement") {
    return {
      ok: false,
      error: "Complétez les informations client avant le paiement.",
      code: "VALIDATION",
    };
  }

  const guest = hotelDraftGuestAdvanceSchema.safeParse(draft.payload);
  if (!guest.success) {
    return {
      ok: false,
      error: "Informations client incomplètes.",
      code: "VALIDATION",
    };
  }

  const range = parseBookingDateRange(
    guest.data.checkInDate,
    guest.data.checkOutDate,
  );
  if (!range.ok) {
    return { ok: false, error: range.error, code: "VALIDATION" };
  }

  const avail = await assertRoomTypeAvailable({
    branchId: draft.branchId,
    roomTypeId: guest.data.roomTypeId,
    checkInDate: range.checkInDate,
    checkOutDate: range.checkOutDate,
  });
  if (!avail.ok) {
    return { ok: false, error: avail.error, code: "CAPACITY" };
  }

  const clientResult = await ensureClientForOnlineUser({
    userId: session.user.id,
    organizationId: org.id,
    telephone: guest.data.guestPhone,
  });
  if (!clientResult.ok) {
    return { ok: false, error: clientResult.error, code: "FORBIDDEN" };
  }

  const folio = buildNightFolioLines(
    range.checkInDate,
    range.checkOutDate,
    avail.priceNight,
  );
  if (folio.nights < 1) {
    return {
      ok: false,
      error: "Le départ doit être après l’arrivée (au moins une nuit).",
      code: "VALIDATION",
    };
  }

  const stub = simulateHotelStubPayment({
    token: draft.draftToken,
    amount: folio.totalAmount,
  });

  try {
    await bindHotelStayDraftUser({
      organizationId: org.id,
      draftToken: draft.draftToken,
      userId: session.user.id,
    });

    const stay = await prisma.$transaction(async (tx) => {
      // Re-check capacity inside transaction
      const overlapping = await tx.hotelStay.count({
        where: {
          branchId: draft.branchId,
          roomTypeId: guest.data.roomTypeId,
          status: { in: ["BOOKED", "IN_HOUSE"] },
          checkInDate: { lt: range.checkOutDate },
          checkOutDate: { gt: range.checkInDate },
        },
      });
      const bookable = await tx.hotelRoom.count({
        where: {
          roomTypeId: guest.data.roomTypeId,
          status: { not: "OUT_OF_ORDER" },
          roomType: { branchId: draft.branchId },
        },
      });
      if (bookable - overlapping < 1) {
        throw new CapacityError();
      }

      const created = await tx.hotelStay.create({
        data: {
          codeUnique: reservationUniqueCode("STAY"),
          branchId: draft.branchId,
          roomTypeId: guest.data.roomTypeId,
          userId: session.user.id,
          guestPrenom: guest.data.guestPrenom,
          guestNom: guest.data.guestNom,
          guestPhone: guest.data.guestPhone,
          checkInDate: range.checkInDate,
          checkOutDate: range.checkOutDate,
          status: "BOOKED",
          priceNight: avail.priceNight,
          totalAmount: folio.totalAmount,
          folioLines: {
            create: folio.lines.map((line) => ({
              label: line.label,
              amount: line.amount,
              kind: line.kind,
            })),
          },
          payments: {
            create: {
              branchId: draft.branchId,
              amount: folio.totalAmount,
              method: stub.methode,
              status: "PAYE",
              reference: stub.reference,
            },
          },
        },
        select: { id: true, codeUnique: true },
      });

      return created;
    });

    await consumeHotelStayDraft({
      organizationId: org.id,
      draftToken: draft.draftToken,
    });

    return {
      ok: true,
      codeUnique: stay.codeUnique,
      stayId: stay.id,
    };
  } catch (e) {
    if (e instanceof CapacityError) {
      return {
        ok: false,
        error: "Plus de disponibilité pour ces dates.",
        code: "CAPACITY",
      };
    }
    if (e instanceof HotelDraftExpiredError) {
      return { ok: false, error: e.message, code: "EXPIRED" };
    }
    if (e instanceof HotelDraftNotFoundError) {
      return { ok: false, error: e.message, code: "NOT_FOUND" };
    }
    throw e;
  }
}

class CapacityError extends Error {
  constructor() {
    super("CAPACITY");
    this.name = "CapacityError";
  }
}
