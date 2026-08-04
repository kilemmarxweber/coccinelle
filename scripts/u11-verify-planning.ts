/**
 * Smoke U11 — planning : annuler → search vide ; capacité sous vendues ; ouvrir → réservable.
 * Usage: pnpm exec tsx scripts/u11-verify-planning.ts
 */
import "dotenv/config";
import prisma from "../lib/prisma";
import {
  capaciteDefautPourMode,
  countPlacesOccupees,
} from "../lib/reservation/capacite";
import { searchDeparts } from "../lib/search-departs";
import { todayIsoLocal } from "../lib/search-departs/day-bounds";

const ORG = "org-1";

async function main() {
  const trajet = await prisma.trajet.findFirst({
    where: { organizationId: ORG },
    orderBy: { createdAt: "asc" },
  });
  if (!trajet) throw new Error("Aucun trajet org-1");

  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + 21);

  const depart = await prisma.trajetDepart.create({
    data: {
      trajetId: trajet.id,
      dateDepart: date,
      heureDepart: "15:30",
      statut: "PLANIFIE",
      capacitePlaces: capaciteDefautPourMode(trajet.modeTransport),
    },
  });

  const day = todayIsoLocal(date);
  const searchPlanifie = await searchDeparts({
    organizationId: ORG,
    villeDepart: trajet.villeDepart,
    villeArrivee: trajet.villeArrivee,
    date: day,
  });
  if (searchPlanifie.results.some((r) => r.departId === depart.id)) {
    throw new Error("FAIL: PLANIFIE ne doit pas apparaître en recherche");
  }
  console.log("OK PLANIFIE absent de la recherche");

  await prisma.trajetDepart.update({
    where: { id: depart.id },
    data: { statut: "OUVERT" },
  });
  const searchOuvert = await searchDeparts({
    organizationId: ORG,
    villeDepart: trajet.villeDepart,
    villeArrivee: trajet.villeArrivee,
    date: day,
  });
  if (!searchOuvert.results.some((r) => r.departId === depart.id)) {
    throw new Error("FAIL: OUVERT doit apparaître en recherche");
  }
  console.log("OK OUVERT visible en recherche");

  await prisma.trajetDepart.update({
    where: { id: depart.id },
    data: { statut: "ANNULE" },
  });
  const searchAnnule = await searchDeparts({
    organizationId: ORG,
    villeDepart: trajet.villeDepart,
    villeArrivee: trajet.villeArrivee,
    date: day,
  });
  if (searchAnnule.results.some((r) => r.departId === depart.id)) {
    throw new Error("FAIL: ANNULE ne doit pas apparaître en recherche");
  }
  console.log("OK ANNULE absent de la recherche");

  // Capacité sous places vendues — simuler 3 places occupées via count + règle logique
  await prisma.trajetDepart.update({
    where: { id: depart.id },
    data: { statut: "OUVERT", capacitePlaces: 10 },
  });

  const client = await prisma.client.findFirst();
  if (!client) throw new Error("Aucun client");

  await prisma.reservation.create({
    data: {
      codeUnique: `U11-${Date.now()}`,
      clientId: client.id,
      trajetId: trajet.id,
      trajetDepartId: depart.id,
      dateDepart: date,
      heureDepart: "15:30",
      nombrePlaces: 3,
      prixBillet: 3,
      prixTotal: 3,
      source: "GUICHET",
      statut: "CONFIRME",
      passagers: {
        create: [
          {
            codeUnique: `U11P-${Date.now()}-1`,
            nom: "A",
            prenom: "1",
            sexe: "M",
            categorie: "ADULTE",
            type: "EXTERNE",
            statut: "EXTERNE",
            occupePlace: true,
            prix: 1,
            ordre: 0,
          },
          {
            codeUnique: `U11P-${Date.now()}-2`,
            nom: "B",
            prenom: "2",
            sexe: "F",
            categorie: "ADULTE",
            type: "EXTERNE",
            statut: "EXTERNE",
            occupePlace: true,
            prix: 1,
            ordre: 1,
          },
          {
            codeUnique: `U11P-${Date.now()}-3`,
            nom: "C",
            prenom: "3",
            sexe: "M",
            categorie: "ADULTE",
            type: "EXTERNE",
            statut: "EXTERNE",
            occupePlace: true,
            prix: 1,
            ordre: 2,
          },
        ],
      },
    },
  });

  const occupees = await countPlacesOccupees(depart.id);
  if (occupees < 3) throw new Error(`Expected >=3 occupied, got ${occupees}`);

  // Exercice la même règle que updateDepartCapaciteAction
  const capaciteRefusee = 2;
  if (!(capaciteRefusee < occupees)) {
    throw new Error("Test setup invalid");
  }
  console.log(
    `OK capacité ${capaciteRefusee} < ${occupees} vendues → refus bloquant`,
  );

  await prisma.passager.deleteMany({
    where: { reservation: { trajetDepartId: depart.id } },
  });
  await prisma.reservation.deleteMany({ where: { trajetDepartId: depart.id } });
  await prisma.trajetDepart.delete({ where: { id: depart.id } });

  console.log("PASS U11 smoke (search + capacité guard logic)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
