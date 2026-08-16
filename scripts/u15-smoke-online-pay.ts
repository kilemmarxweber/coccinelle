import "dotenv/config";
import prisma from "../lib/prisma";
import {
  consumeCheckoutDraft,
  createCheckoutDraft,
  getCheckoutDraft,
  updateCheckoutDraft,
} from "../lib/reservation/draft";
import { createReservationInDatabase } from "../lib/reservation/create-reservation";
import { draftPayloadToCreateInput } from "../lib/reservation/draft-to-create-input";
import { simulateStubPayment } from "../lib/reservation/payment-stub";
import { getDepartForOrganization } from "../lib/search-departs";
import { ORG_ROLE, organizationRoleStatements } from "../lib/permissions";

/**
 * Smoke test U15 (domaine) — paiement stub → EN_LIGNE + CONFIRME + draft consommé.
 * Usage: pnpm exec tsx scripts/u15-smoke-online-pay.ts
 */
async function main() {
  const org = await prisma.organization.findUnique({
    where: { slug: "default-org" },
  });
  if (!org) throw new Error("org missing");

  const clientUser = await prisma.user.findUnique({
    where: { email: "client@test.com" },
    include: { client: true },
  });
  if (!clientUser?.client) throw new Error("client@test.com missing");

  const candidates = await prisma.trajetDepart.findMany({
    where: {
      statut: "OUVERT",
      trajet: { organizationId: org.id },
    },
    orderBy: { dateDepart: "asc" },
    take: 20,
    select: { id: true, capacitePlaces: true },
  });
  if (!candidates.length) throw new Error("no OUVERT depart");

  let departRow: { id: string } | null = null;
  for (const c of candidates) {
    const occupied = await prisma.passager.count({
      where: {
        occupePlace: true,
        reservation: {
          trajetDepartId: c.id,
          statut: { not: "ANNULE" },
        },
      },
    });
    if (c.capacitePlaces - occupied >= 1) {
      departRow = { id: c.id };
      break;
    }
  }
  if (!departRow) {
    // Ouvre un départ planifié pour le smoke test
    const planifie = await prisma.trajetDepart.findFirst({
      where: {
        statut: "PLANIFIE",
        trajet: { organizationId: org.id },
      },
      orderBy: { dateDepart: "asc" },
      select: { id: true },
    });
    if (!planifie) throw new Error("no usable depart");
    await prisma.trajetDepart.update({
      where: { id: planifie.id },
      data: { statut: "OUVERT" },
    });
    departRow = planifie;
  }

  const created = await createCheckoutDraft({
    organizationId: org.id,
    organizationSlug: org.slug,
    departId: departRow.id,
    userId: clientUser.id,
  });

  const draft = await getCheckoutDraft({
    organizationId: org.id,
    draftToken: created.draftToken,
  });
  if (!draft) throw new Error("draft not found");

  const payload = {
    ...draft.payload,
    step: "paiement" as const,
    passagers: [
      {
        nom: "Demo",
        prenom: "U15",
        sexe: "M" as const,
        categorie: "ADULTE" as const,
        telephone: "+243900000001",
      },
    ],
    colis: { include: false as const },
  };

  await updateCheckoutDraft({
    organizationId: org.id,
    draftToken: created.draftToken,
    payload,
  });

  const depart = await getDepartForOrganization({
    organizationId: org.id,
    departId: departRow.id,
  });
  if (!depart) throw new Error("depart detail missing");

  const createInput = draftPayloadToCreateInput(
    payload,
    clientUser.client.id,
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

  const stub = simulateStubPayment({
    draftToken: created.draftToken,
    amount: createInput.pricing.total,
  });

  const reservation = await createReservationInDatabase(createInput, {
    organizationId: org.id,
    source: "EN_LIGNE",
    paiementStatut: "PAYE",
    paiementReference: stub.reference,
  });

  await consumeCheckoutDraft({
    organizationId: org.id,
    draftToken: created.draftToken,
  });

  const after = await getCheckoutDraft({
    organizationId: org.id,
    draftToken: created.draftToken,
  });

  const pay = await prisma.paiement.findFirst({
    where: { reservationId: reservation.id },
  });

  const userStatements = organizationRoleStatements[ORG_ROLE.USER];
  const canCreate = userStatements.inscription?.includes("create") ?? false;

  console.log(
    JSON.stringify(
      {
        codeUnique: reservation.codeUnique,
        source: reservation.source,
        statut: reservation.statut,
        paiementStatut: pay?.statut,
        paiementMethode: pay?.methode,
        paiementReference: pay?.reference,
        draftConsumed: after === null,
        parentInscriptionCreate: canCreate,
        confirmationUrl: `/${org.slug}/confirmation/${reservation.codeUnique}`,
        mesReservationsUrl: `/${org.slug}/mes-reservations`,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
