"use server";

import { z } from "zod";
import type { ZodError } from "zod";
import { assertOrganizationPermission } from "@/lib/auth/organization-permission";
import { organizationIdSchema } from "@/lib/reservation/schema";
import {
  OrganizationScopeError,
  listDepartsDuJour,
  resolveOrganizationScope,
  searchDeparts,
} from "./search-departs";
import type { SearchDepartResult } from "./types";

type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string };

function zodFirstMessage(err: ZodError): string {
  return err.issues[0]?.message ?? "Données invalides.";
}

const searchDepartsSchema = z
  .object({
    organizationId: organizationIdSchema.optional(),
    organizationSlug: z.string().trim().min(1).optional(),
    villeDepart: z.string().trim().min(1, "Ville de départ requise."),
    villeArrivee: z.string().trim().min(1, "Ville d'arrivée requise."),
    date: z.string().trim().min(1, "Date requise."),
    modeTransport: z.enum(["BUS", "AVION", "BATEAU"]).optional(),
    includeComplets: z.boolean().optional(),
  })
  .refine((v) => Boolean(v.organizationId || v.organizationSlug), {
    message: "Organisation requise (id ou slug).",
    path: ["organizationId"],
  });

const listDepartsDuJourSchema = z
  .object({
    organizationId: organizationIdSchema.optional(),
    organizationSlug: z.string().trim().min(1).optional(),
    date: z.string().trim().min(1).optional(),
    modeTransport: z.enum(["BUS", "AVION", "BATEAU"]).optional(),
    includeComplets: z.boolean().optional(),
  })
  .refine((v) => Boolean(v.organizationId || v.organizationSlug), {
    message: "Organisation requise (id ou slug).",
    path: ["organizationId"],
  });

export type SearchDepartsActionData = {
  organizationId: string;
  results: SearchDepartResult[];
};

/**
 * Server Action — recherche de départs scopée org (`depart:read`).
 * Mauvaise org / slug → erreur métier, aucun résultat d'une autre org.
 */
export async function searchDepartsAction(
  input: unknown,
): Promise<ActionResult<SearchDepartsActionData>> {
  const parsed = searchDepartsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: zodFirstMessage(parsed.error) };
  }

  let organizationId: string;
  try {
    const org = await resolveOrganizationScope({
      organizationId: parsed.data.organizationId,
      organizationSlug: parsed.data.organizationSlug,
    });
    organizationId = org.id;
  } catch (e) {
    if (e instanceof OrganizationScopeError) {
      return { ok: false, message: e.message };
    }
    throw e;
  }

  const perm = await assertOrganizationPermission(organizationId, {
    depart: ["voir"],
  });
  if (!perm.ok) return { ok: false, message: perm.message };

  try {
    const data = await searchDeparts({
      organizationId,
      villeDepart: parsed.data.villeDepart,
      villeArrivee: parsed.data.villeArrivee,
      date: parsed.data.date,
      modeTransport: parsed.data.modeTransport,
      includeComplets: parsed.data.includeComplets,
    });
    return { ok: true, data };
  } catch (e) {
    if (e instanceof OrganizationScopeError) {
      return { ok: false, message: e.message };
    }
    const message = e instanceof Error ? e.message : "Recherche impossible.";
    return { ok: false, message };
  }
}

/**
 * Server Action — départs du jour (vente express guichet, `depart:read`).
 */
export async function listDepartsDuJourAction(
  input: unknown,
): Promise<ActionResult<SearchDepartsActionData>> {
  const parsed = listDepartsDuJourSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: zodFirstMessage(parsed.error) };
  }

  let organizationId: string;
  try {
    const org = await resolveOrganizationScope({
      organizationId: parsed.data.organizationId,
      organizationSlug: parsed.data.organizationSlug,
    });
    organizationId = org.id;
  } catch (e) {
    if (e instanceof OrganizationScopeError) {
      return { ok: false, message: e.message };
    }
    throw e;
  }

  const perm = await assertOrganizationPermission(organizationId, {
    depart: ["voir"],
  });
  if (!perm.ok) return { ok: false, message: perm.message };

  try {
    const data = await listDepartsDuJour({
      organizationId,
      date: parsed.data.date,
      modeTransport: parsed.data.modeTransport,
      includeComplets: parsed.data.includeComplets,
    });
    return { ok: true, data };
  } catch (e) {
    if (e instanceof OrganizationScopeError) {
      return { ok: false, message: e.message };
    }
    const message = e instanceof Error ? e.message : "Chargement impossible.";
    return { ok: false, message };
  }
}
