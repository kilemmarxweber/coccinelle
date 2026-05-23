"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ZodError } from "zod";
import { assertInscriptionPermission } from "@/lib/auth/inscription-permission";
import { organizationIdSchema } from "@/lib/reservation/schema";
import prisma from "@/lib/prisma";

type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string };

function zodFirstMessage(err: ZodError): string {
  return err.issues[0]?.message ?? "Données invalides.";
}

function trajetsPath(organizationId: string) {
  return `/admin/organizations/${organizationId}/agences/trajets`;
}

function revalidateTrajets(organizationId: string) {
  revalidatePath(trajetsPath(organizationId), "page");
  revalidatePath(
    `/admin/organizations/${organizationId}/agences/reservations/guichet`,
    "page",
  );
}

export async function getTrajetsForOrganizationAction(organizationId: string) {
  const perm = await assertInscriptionPermission(organizationId, "share");
  if (!perm.ok) return { ok: false as const, message: perm.message };

  const now = new Date();
  const trajets = await prisma.trajet.findMany({
    where: { organizationId },
    include: {
      trajetDepart: {
        where: {
          statut: { not: "ANNULE" },
          dateDepart: { gte: now },
        },
        orderBy: { dateDepart: "asc" },
      },
      _count: { select: { trajetDepart: true } },
    },
    orderBy: [{ villeDepart: "asc" }, { villeArrivee: "asc" }],
  });

  return {
    ok: true as const,
    data: trajets.map((t) => ({
      id: t.id,
      villeDepart: t.villeDepart,
      villeArrivee: t.villeArrivee,
      prixBase: t.prixBase,
      prixParKilo: t.prixParKilo,
      kilosGratuits: t.kilosGratuits,
      dureeEstimee: t.dureeEstimee,
      departsCount: t._count.trajetDepart,
      departs: t.trajetDepart.map((d) => ({
        id: d.id,
        dateDepart: d.dateDepart.toISOString(),
        heureDepart: d.heureDepart,
        statut: d.statut,
      })),
    })),
  };
}

const createTrajetSchema = z.object({
  organizationId: organizationIdSchema,
  villeDepart: z.string().trim().min(1, "Ville de départ requise."),
  villeArrivee: z.string().trim().min(1, "Ville d'arrivée requise."),
  prixBase: z.coerce.number().min(0),
  prixParKilo: z.coerce.number().min(0),
  kilosGratuits: z.coerce.number().min(0),
  dureeEstimee: z.coerce.number().int().positive().optional(),
});

export async function createTrajetAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = createTrajetSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: zodFirstMessage(parsed.error) };

  const perm = await assertInscriptionPermission(parsed.data.organizationId, "create");
  if (!perm.ok) return { ok: false, message: perm.message };

  const trajet = await prisma.trajet.create({
    data: {
      organizationId: parsed.data.organizationId,
      villeDepart: parsed.data.villeDepart,
      villeArrivee: parsed.data.villeArrivee,
      prixBase: parsed.data.prixBase,
      prixParKilo: parsed.data.prixParKilo,
      kilosGratuits: parsed.data.kilosGratuits,
      dureeEstimee: parsed.data.dureeEstimee ?? null,
    },
  });

  revalidateTrajets(parsed.data.organizationId);
  return { ok: true, data: { id: trajet.id } };
}

const createDepartSchema = z.object({
  organizationId: organizationIdSchema,
  trajetId: z.string().uuid("Trajet invalide."),
  dateDepart: z.coerce.date({ message: "Date invalide." }),
  heureDepart: z.string().trim().min(1, "Heure requise."),
});

export async function createTrajetDepartAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = createDepartSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: zodFirstMessage(parsed.error) };

  const perm = await assertInscriptionPermission(parsed.data.organizationId, "create");
  if (!perm.ok) return { ok: false, message: perm.message };

  const trajet = await prisma.trajet.findFirst({
    where: {
      id: parsed.data.trajetId,
      organizationId: parsed.data.organizationId,
    },
  });
  if (!trajet) return { ok: false, message: "Trajet introuvable pour cette agence." };

  const depart = await prisma.trajetDepart.create({
    data: {
      trajetId: parsed.data.trajetId,
      dateDepart: parsed.data.dateDepart,
      heureDepart: parsed.data.heureDepart,
      statut: "OUVERT",
    },
  });

  revalidateTrajets(parsed.data.organizationId);
  return { ok: true, data: { id: depart.id } };
}

/** Crée 2 trajets + départs à venir (démo / première config). */
export async function provisionDemoTrajetsAction(
  organizationId: string,
): Promise<ActionResult<{ count: number }>> {
  const parsed = organizationIdSchema.safeParse(organizationId);
  if (!parsed.success) return { ok: false, message: zodFirstMessage(parsed.error) };

  const perm = await assertInscriptionPermission(parsed.data, "create");
  if (!perm.ok) return { ok: false, message: perm.message };

  const existing = await prisma.trajet.count({
    where: { organizationId: parsed.data },
  });
  if (existing > 0) {
    return { ok: false, message: "Cette agence a déjà des trajets. Ajoutez des départs depuis la page Trajets." };
  }

  const templates = [
    {
      villeDepart: "Kinshasa",
      villeArrivee: "Paris",
      kilosGratuits: 30,
      prixParKilo: 8,
      prixBase: 120_000,
      heureDepart: "08:00",
    },
    {
      villeDepart: "Kinshasa",
      villeArrivee: "Bruxelles",
      kilosGratuits: 25,
      prixParKilo: 7,
      prixBase: 100_000,
      heureDepart: "10:00",
    },
  ];

  await prisma.$transaction(async (tx) => {
    for (const tpl of templates) {
      const trajet = await tx.trajet.create({
        data: {
          organizationId: parsed.data,
          villeDepart: tpl.villeDepart,
          villeArrivee: tpl.villeArrivee,
          kilosGratuits: tpl.kilosGratuits,
          prixParKilo: tpl.prixParKilo,
          prixBase: tpl.prixBase,
        },
      });

      for (let i = 1; i <= 4; i++) {
        const date = new Date();
        date.setHours(12, 0, 0, 0);
        date.setDate(date.getDate() + i * 7);
        await tx.trajetDepart.create({
          data: {
            trajetId: trajet.id,
            dateDepart: date,
            heureDepart: tpl.heureDepart,
            statut: i === 1 ? "OUVERT" : "PLANIFIE",
          },
        });
      }
    }
  });

  revalidateTrajets(parsed.data);
  return { ok: true, data: { count: templates.length } };
}
