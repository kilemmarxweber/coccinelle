"use server";

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { CapaciteInsuffisanteError } from "@/lib/reservation/capacite";
import { createReservationInDatabase } from "@/lib/reservation/create-reservation";
import {
  DraftExpiredError,
  DraftNotFoundError,
  assertDraftCapacity,
  bindCheckoutDraftUser,
  consumeCheckoutDraft,
  getCheckoutDraft,
} from "@/lib/reservation/draft";
import { draftPayloadToCreateInput } from "@/lib/reservation/draft-to-create-input";
import { ensureClientForOnlineUser } from "@/lib/reservation/ensure-client-for-user";
import { simulateStubPayment } from "@/lib/reservation/payment-stub";
import { getPublicOrganizationBySlug } from "@/lib/pwa/org";
import { getDepartForOrganization } from "@/lib/search-departs";
import { z } from "zod";

const payInputSchema = z.object({
  orgSlug: z.string().trim().min(1),
  draftToken: z.string().trim().min(1),
});

export type OnlinePayResult =
  | { ok: true; codeUnique: string; reservationId: string }
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
 * Paiement stub + création réservation `EN_LIGNE` / `CONFIRME` / paiement `PAYE`.
 * Exige une session Better Auth (pas `inscription:create`).
 */
export async function payAndConfirmOnlineCheckoutAction(
  raw: unknown,
): Promise<OnlinePayResult> {
  const parsed = payInputSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "Données invalides.", code: "VALIDATION" };
  }

  const h = await headers();
  const session = await auth.api.getSession({ headers: h });
  if (!session?.user) {
    return {
      ok: false,
      error: "Connectez-vous pour payer.",
      code: "UNAUTHENTICATED",
    };
  }

  const org = await getPublicOrganizationBySlug(parsed.data.orgSlug);
  if (!org) {
    return { ok: false, error: "Organisation introuvable.", code: "NOT_FOUND" };
  }

  const draft = await getCheckoutDraft({
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
      error: "Complétez les étapes avant le paiement.",
      code: "VALIDATION",
    };
  }

  try {
    await assertDraftCapacity(draft.payload);
  } catch (e) {
    if (e instanceof CapaciteInsuffisanteError) {
      return { ok: false, error: e.message, code: "CAPACITY" };
    }
    throw e;
  }

  const depart = await getDepartForOrganization({
    organizationId: org.id,
    departId: draft.payload.trajetDepartId,
  });
  if (!depart) {
    return { ok: false, error: "Départ introuvable.", code: "NOT_FOUND" };
  }

  const firstTel = draft.payload.passagers[0]?.telephone;
  const clientResult = await ensureClientForOnlineUser({
    userId: session.user.id,
    organizationId: org.id,
    telephone: firstTel,
  });
  if (!clientResult.ok) {
    return { ok: false, error: clientResult.error, code: "FORBIDDEN" };
  }

  let createInput;
  try {
    createInput = draftPayloadToCreateInput(
      draft.payload,
      clientResult.clientId,
      {
        dateDepart: depart.dateDepart,
        heureDepart: depart.heureDepart,
        tarifs: {
          prixBase: depart.prixBase,
          prixParKilo: depart.prixParKilo,
          kilosGratuits: depart.kilosGratuits,
        },
      },
      "MOBILE",
    );
  } catch {
    return {
      ok: false,
      error: "Données de réservation incomplètes.",
      code: "VALIDATION",
    };
  }

  const stub = simulateStubPayment({
    draftToken: draft.draftToken,
    amount: createInput.pricing.total,
  });

  try {
    await bindCheckoutDraftUser({
      organizationId: org.id,
      draftToken: draft.draftToken,
      userId: session.user.id,
    });

    const reservation = await createReservationInDatabase(createInput, {
      organizationId: org.id,
      source: "EN_LIGNE",
      paiementStatut: "PAYE",
      paiementReference: stub.reference,
    });

    await consumeCheckoutDraft({
      organizationId: org.id,
      draftToken: draft.draftToken,
    });

    return {
      ok: true,
      codeUnique: reservation.codeUnique,
      reservationId: reservation.id,
    };
  } catch (e) {
    if (e instanceof CapaciteInsuffisanteError) {
      return { ok: false, error: e.message, code: "CAPACITY" };
    }
    if (e instanceof DraftExpiredError) {
      return { ok: false, error: e.message, code: "EXPIRED" };
    }
    if (e instanceof DraftNotFoundError) {
      return { ok: false, error: e.message, code: "NOT_FOUND" };
    }
    throw e;
  }
}
