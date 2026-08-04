"use server";

import { z } from "zod";
import type { ZodError } from "zod";
import {
  OrganizationScopeError,
  resolveOrganizationScope,
  searchDeparts,
} from "@/lib/search-departs";
import type { SearchDepartResult } from "@/lib/search-departs/types";

type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string };

function zodFirstMessage(err: ZodError): string {
  return err.issues[0]?.message ?? "Données invalides.";
}

const demoSearchSchema = z.object({
  villeDepart: z.string().trim().min(1, "Ville de départ requise."),
  villeArrivee: z.string().trim().min(1, "Ville d'arrivée requise."),
  date: z.string().trim().min(1, "Date requise."),
  modeTransport: z.enum(["BUS", "AVION"]).optional(),
  includeComplets: z.boolean().optional(),
});

export type SearchDepartsDemoData = {
  organizationId: string;
  results: SearchDepartResult[];
};

/**
 * Recherche départs pour la page démo design-system (U06).
 * Scope figé sur l’org seed `default-org` — pas d’auth (hors admin).
 */
export async function searchDepartsDemoAction(
  input: unknown,
): Promise<ActionResult<SearchDepartsDemoData>> {
  const parsed = demoSearchSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: zodFirstMessage(parsed.error) };
  }

  try {
    const org = await resolveOrganizationScope({
      organizationSlug: "default-org",
    });
    const data = await searchDeparts({
      organizationId: org.id,
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
