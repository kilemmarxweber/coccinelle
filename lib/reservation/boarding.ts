/**
 * Domaine embarquement (U16) — scan / pointage passager → `embarqueAt` + statut réservation.
 *
 * Règles :
 * - QR / code `PASS-*` (token U08) résolu vers un passager
 * - Réservation `ANNULE` | `RATE` | `REPORTE` → refus
 * - Mauvais `trajetDepartId` → refus
 * - Déjà embarqué (`embarqueAt`) → refus
 * - Succès → `embarqueAt = now()` ; si tous les passagers embarqués → réservation `EMBARQUE`
 */

import prisma from "@/lib/prisma";
import { parseBoardingQrPayload } from "@/lib/reservation/boarding-token";

export type BoardingFailureReason =
  | "empty"
  | "malformed"
  | "invalid_signature"
  | "unrecognized"
  | "not_found"
  | "wrong_depart"
  | "already_boarded"
  | "reservation_annule"
  | "reservation_rate"
  | "reservation_reporte"
  | "reservation_invalide";

export type BoardPassengerResult =
  | {
      ok: true;
      passager: {
        id: string;
        codeUnique: string;
        nom: string;
        prenom: string;
        categorie: string;
        embarqueAt: Date;
      };
      reservation: {
        id: string;
        codeUnique: string;
        statut: string;
        allBoarded: boolean;
      };
    }
  | { ok: false; reason: BoardingFailureReason; message: string };

const REFUS_MESSAGES: Record<BoardingFailureReason, string> = {
  empty: "Aucun code scanné.",
  malformed: "QR mal formé.",
  invalid_signature: "QR invalide (signature).",
  unrecognized: "Code non reconnu. Utilisez un QR billet ou un code PASS-*.",
  not_found: "Passager introuvable pour ce code.",
  wrong_depart: "Ce billet n’appartient pas au départ sélectionné.",
  already_boarded: "Passager déjà embarqué.",
  reservation_annule: "Réservation annulée — embarquement refusé.",
  reservation_rate: "Réservation marquée « ratée » — embarquement refusé.",
  reservation_reporte: "Réservation reportée — embarquement refusé.",
  reservation_invalide: "Statut de réservation incompatible avec l’embarquement.",
};

function fail(reason: BoardingFailureReason): BoardPassengerResult {
  return { ok: false, reason, message: REFUS_MESSAGES[reason] };
}

type BoardOpts = {
  organizationId: string;
  trajetDepartId: string;
  /** Contenu QR ou code PASS-* (ou token CCNL1). */
  payload?: string;
  /** Pointage manuel par id passager. */
  passagerId?: string;
};

/**
 * Embarque un passager pour un départ donné (transaction courte).
 */
export async function boardPassenger(
  opts: BoardOpts,
): Promise<BoardPassengerResult> {
  let codeUnique: string | null = null;
  let passagerId = opts.passagerId?.trim() || null;

  if (!passagerId) {
    const raw = opts.payload?.trim() ?? "";
    const parsed = parseBoardingQrPayload(raw);
    if (!parsed.ok) return fail(parsed.reason);
    codeUnique = parsed.codeUnique;
  }

  return prisma.$transaction(async (tx) => {
    const passager = await tx.passager.findFirst({
      where: passagerId
        ? { id: passagerId }
        : { codeUnique: codeUnique! },
      include: {
        reservation: {
          select: {
            id: true,
            codeUnique: true,
            statut: true,
            trajetDepartId: true,
            trajet: { select: { organizationId: true } },
            passagers: {
              select: { id: true, embarqueAt: true },
              orderBy: { ordre: "asc" },
            },
          },
        },
      },
    });

    if (!passager) return fail("not_found");

    if (passager.reservation.trajet.organizationId !== opts.organizationId) {
      return fail("not_found");
    }

    if (passager.reservation.trajetDepartId !== opts.trajetDepartId) {
      return fail("wrong_depart");
    }

    const statut = passager.reservation.statut;
    if (statut === "ANNULE") return fail("reservation_annule");
    if (statut === "RATE") return fail("reservation_rate");
    if (statut === "REPORTE") return fail("reservation_reporte");
    if (statut !== "CONFIRME" && statut !== "EMBARQUE") {
      return fail("reservation_invalide");
    }

    if (passager.embarqueAt) return fail("already_boarded");

    const now = new Date();
    const updated = await tx.passager.update({
      where: { id: passager.id },
      data: { embarqueAt: now },
      select: {
        id: true,
        codeUnique: true,
        nom: true,
        prenom: true,
        categorie: true,
        embarqueAt: true,
      },
    });

    const siblings = passager.reservation.passagers.map((p) =>
      p.id === passager.id ? { ...p, embarqueAt: now } : p,
    );
    const allBoarded = siblings.every((p) => p.embarqueAt != null);

    let reservationStatut = passager.reservation.statut;
    if (allBoarded && reservationStatut !== "EMBARQUE") {
      await tx.reservation.update({
        where: { id: passager.reservation.id },
        data: { statut: "EMBARQUE" },
      });
      reservationStatut = "EMBARQUE";
    }

    return {
      ok: true,
      passager: {
        id: updated.id,
        codeUnique: updated.codeUnique,
        nom: updated.nom,
        prenom: updated.prenom,
        categorie: updated.categorie,
        embarqueAt: updated.embarqueAt!,
      },
      reservation: {
        id: passager.reservation.id,
        codeUnique: passager.reservation.codeUnique,
        statut: reservationStatut,
        allBoarded,
      },
    };
  });
}
