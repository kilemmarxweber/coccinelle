"use server";

import { redirect } from "next/navigation";
import { CapaciteInsuffisanteError } from "@/lib/reservation/capacite";
import {
  DraftExpiredError,
  DraftNotFoundError,
  assertDraftCapacity,
  createCheckoutDraft,
  updateCheckoutDraft,
} from "@/lib/reservation/draft";
import {
  createDraftInputSchema,
  draftOptionsAdvanceSchema,
  draftPassengersAdvanceSchema,
  updateDraftInputSchema,
  type DraftPayload,
} from "@/lib/reservation/draft-schema";
import { getPublicOrganizationBySlug } from "@/lib/pwa/org";

export type DraftActionResult =
  | { ok: true; placesRestantes?: number }
  | { ok: false; error: string; code?: "EXPIRED" | "CAPACITY" | "VALIDATION" | "NOT_FOUND" };

export async function createCheckoutDraftAction(
  raw: unknown,
): Promise<DraftActionResult> {
  const parsed = createDraftInputSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "Données invalides.", code: "VALIDATION" };
  }

  const org = await getPublicOrganizationBySlug(parsed.data.orgSlug);
  if (!org) {
    return { ok: false, error: "Organisation introuvable.", code: "NOT_FOUND" };
  }

  let draftToken: string;
  try {
    const created = await createCheckoutDraft({
      organizationId: org.id,
      organizationSlug: org.slug,
      departId: parsed.data.departId,
    });
    draftToken = created.draftToken;
  } catch (e) {
    if (e instanceof CapaciteInsuffisanteError) {
      return { ok: false, error: e.message, code: "CAPACITY" };
    }
    if (e instanceof DraftNotFoundError) {
      return { ok: false, error: e.message, code: "NOT_FOUND" };
    }
    throw e;
  }

  redirect(`/${org.slug}/checkout/${draftToken}`);
}

export async function updateCheckoutDraftAction(
  raw: unknown,
): Promise<DraftActionResult> {
  const parsed = updateDraftInputSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Données invalides.",
      code: "VALIDATION",
    };
  }

  const org = await getPublicOrganizationBySlug(parsed.data.orgSlug);
  if (!org) {
    return { ok: false, error: "Organisation introuvable.", code: "NOT_FOUND" };
  }

  try {
    const view = await updateCheckoutDraft({
      organizationId: org.id,
      draftToken: parsed.data.draftToken,
      payload: parsed.data.payload,
    });
    return { ok: true, placesRestantes: view.placesRestantes };
  } catch (e) {
    if (e instanceof DraftExpiredError) {
      return { ok: false, error: e.message, code: "EXPIRED" };
    }
    if (e instanceof DraftNotFoundError) {
      return { ok: false, error: e.message, code: "NOT_FOUND" };
    }
    if (e instanceof CapaciteInsuffisanteError) {
      return { ok: false, error: e.message, code: "CAPACITY" };
    }
    throw e;
  }
}

export async function advanceCheckoutStepAction(input: {
  orgSlug: string;
  draftToken: string;
  payload: DraftPayload;
  toStep: "options" | "paiement";
}): Promise<DraftActionResult> {
  const org = await getPublicOrganizationBySlug(input.orgSlug);
  if (!org) {
    return { ok: false, error: "Organisation introuvable.", code: "NOT_FOUND" };
  }

  if (input.toStep === "options") {
    const v = draftPassengersAdvanceSchema.safeParse({
      passagers: input.payload.passagers,
    });
    if (!v.success) {
      return {
        ok: false,
        error: v.error.issues[0]?.message ?? "Passagers incomplets.",
        code: "VALIDATION",
      };
    }
  }

  if (input.toStep === "paiement") {
    const v = draftOptionsAdvanceSchema.safeParse({
      passagers: input.payload.passagers,
      colis: input.payload.colis,
    });
    if (!v.success) {
      return {
        ok: false,
        error: v.error.issues[0]?.message ?? "Options invalides.",
        code: "VALIDATION",
      };
    }
  }

  try {
    await assertDraftCapacity(input.payload);
    const nextPayload: DraftPayload = {
      ...input.payload,
      step: input.toStep,
    };
    const view = await updateCheckoutDraft({
      organizationId: org.id,
      draftToken: input.draftToken,
      payload: nextPayload,
    });
    return { ok: true, placesRestantes: view.placesRestantes };
  } catch (e) {
    if (e instanceof DraftExpiredError) {
      return { ok: false, error: e.message, code: "EXPIRED" };
    }
    if (e instanceof DraftNotFoundError) {
      return { ok: false, error: e.message, code: "NOT_FOUND" };
    }
    if (e instanceof CapaciteInsuffisanteError) {
      return { ok: false, error: e.message, code: "CAPACITY" };
    }
    throw e;
  }
}
