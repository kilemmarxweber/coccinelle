/**
 * Critères U02 #1 et #3 — capacité 2 + concurrence.
 * Usage: npx tsx scripts/test-capacite-concurrence.ts
 */
import "dotenv/config";
import {
  CapaciteInsuffisanteError,
  placesRestantes,
} from "../lib/reservation/capacite";
import { createReservationInDatabase } from "../lib/reservation/create-reservation";
import prisma from "../lib/prisma";

async function main() {
  const depart = await prisma.trajetDepart.findFirst({
    where: { capacitePlaces: 2 },
    include: { trajet: { select: { id: true, organizationId: true } } },
  });
  const client = await prisma.client.findFirst();
  if (!depart || !client) {
    throw new Error("Besoin d'un départ capacité 2 (seed bus) et d'un client.");
  }

  // Annule les réservations actives sur ce départ pour un test propre
  await prisma.reservation.updateMany({
    where: { trajetDepartId: depart.id, statut: { not: "ANNULE" } },
    data: { statut: "ANNULE" },
  });

  const base = {
    clientId: client.id,
    trajetId: depart.trajetId,
    trajetDepartId: depart.id,
    dateDepart: depart.dateDepart,
    heureDepart: depart.heureDepart,
    colis: { prix: 0 },
    modePaiement: "CASH" as const,
    statutReservation: "CONFIRME" as const,
  };

  const adulte = (n: number) => ({
    nom: `Adult${n}`,
    prenom: "Test",
    sexe: "M" as const,
    categorie: "ADULTE" as const,
    prix: 100,
  });

  const opts = {
    organizationId: depart.trajet.organizationId,
    paiementStatut: "PAYE" as const,
  };

  // Critère 1 : 2 adultes OK
  const r1 = await createReservationInDatabase(
    {
      ...base,
      nombrePlaces: 2,
      passagers: [adulte(1), adulte(2)],
      pricing: { totalPassagers: 200, totalColis: 0, total: 200 },
    },
    opts,
  );
  console.log("OK 2 adultes:", r1.codeUnique);

  // 3e place refusée
  try {
    await createReservationInDatabase(
      {
        ...base,
        nombrePlaces: 1,
        passagers: [adulte(3)],
        pricing: { totalPassagers: 100, totalColis: 0, total: 100 },
      },
      opts,
    );
    throw new Error("ÉCHEC: 3e place aurait dû être refusée");
  } catch (e) {
    if (!(e instanceof CapaciteInsuffisanteError)) throw e;
    console.log("OK refus 3e place:", e.message);
  }

  // Critère 2 : bébé n'occupe pas
  await prisma.reservation.updateMany({
    where: { trajetDepartId: depart.id, statut: { not: "ANNULE" } },
    data: { statut: "ANNULE" },
  });
  await prisma.trajetDepart.update({
    where: { id: depart.id },
    data: { capacitePlaces: 1 },
  });

  await createReservationInDatabase(
    {
      ...base,
      nombrePlaces: 2,
      passagers: [
        adulte(1),
        {
          nom: "Bebe",
          prenom: "Test",
          sexe: "F" as const,
          categorie: "BEBE" as const,
          prix: 0,
        },
      ],
      pricing: { totalPassagers: 100, totalColis: 0, total: 100 },
    },
    opts,
  );
  console.log("OK adulte+bébé sur capacité 1");

  // Critère 5 : colis seul
  const restantesAvantColis = await placesRestantes(depart.id);
  await createReservationInDatabase(
    {
      ...base,
      nombrePlaces: 0,
      passagers: [],
      colis: {
        type: "ORDINAIRE",
        kilosGratuits: 0,
        kilosSupplement: 0,
        prix: 50,
        poids: 5,
      },
      pricing: { totalPassagers: 0, totalColis: 50, total: 50 },
    },
    opts,
  );
  const restantesApresColis = await placesRestantes(depart.id);
  if (restantesAvantColis !== restantesApresColis) {
    throw new Error("ÉCHEC: colis seul a consommé une place");
  }
  console.log("OK colis seul ne consomme pas");

  // Critère 3 : concurrence
  await prisma.reservation.updateMany({
    where: { trajetDepartId: depart.id, statut: { not: "ANNULE" } },
    data: { statut: "ANNULE" },
  });
  await prisma.trajetDepart.update({
    where: { id: depart.id },
    data: { capacitePlaces: 1 },
  });

  const payload = {
    ...base,
    nombrePlaces: 1,
    passagers: [adulte(9)],
    pricing: { totalPassagers: 100, totalColis: 0, total: 100 },
  };
  const results = await Promise.allSettled([
    createReservationInDatabase(payload, opts),
    createReservationInDatabase(payload, opts),
  ]);
  const ok = results.filter((r) => r.status === "fulfilled").length;
  const ko = results.filter((r) => r.status === "rejected").length;
  console.log({ concurrencyOk: ok, concurrencyKo: ko });
  if (ok !== 1 || ko !== 1) {
    for (const r of results) {
      if (r.status === "rejected") console.log("reject:", (r.reason as Error)?.message);
    }
    throw new Error("ÉCHEC concurrence: attendu 1 succès / 1 refus");
  }
  console.log("OK anti-surbooking concurrent");

  // Restore capacité bus test
  await prisma.trajetDepart.update({
    where: { id: depart.id },
    data: { capacitePlaces: 2 },
  });

  console.log("TOUS LES CRITÈRES DOMAINE OK");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
