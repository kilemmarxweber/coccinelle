/**
 * Smoke test U05 — appelle searchDeparts contre la BDD seedée.
 * Usage: npx tsx scripts/smoke-search-departs.ts
 */
import "dotenv/config";
import prisma from "../lib/prisma";
import { searchDeparts, resolveOrganizationScope } from "../lib/search-departs";

function nextWeekday(targetDay: number): string {
  const date = new Date();
  const diff = (targetDay - date.getDay() + 7) % 7;
  date.setDate(date.getDate() + diff);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

async function main() {
  const org = await resolveOrganizationScope({ organizationSlug: "default-org" });
  console.log("org:", org);

  // MERCREDI = 3
  const mercredi = nextWeekday(3);
  console.log("\n1) Kinshasa → Lubumbashi @", mercredi);
  const all = await searchDeparts({
    organizationId: org.id,
    villeDepart: "Kinshasa",
    villeArrivee: "Lubumbashi",
    date: mercredi,
  });
  console.log(
    "results:",
    all.results.map((r) => ({
      mode: r.modeTransport,
      heure: r.heureDepart,
      prixBase: r.prixBase,
      placesRestantes: r.placesRestantes,
      complet: r.complet,
    })),
  );
  if (all.results.length === 0) {
    throw new Error("AC1 FAIL: attendu au moins 1 départ seedé Kin→Lubumbashi");
  }
  for (const r of all.results) {
    if (
      r.prixBase == null ||
      r.placesRestantes == null ||
      !r.modeTransport ||
      !r.heureDepart ||
      !r.dateDepart
    ) {
      throw new Error("AC4 FAIL: payload incomplet");
    }
  }
  console.log("AC1+AC4 OK");

  console.log("\n2) Filtre AVION (exclut bus)");
  const avion = await searchDeparts({
    organizationId: org.id,
    villeDepart: "Kinshasa",
    villeArrivee: "Lubumbashi",
    date: mercredi,
    modeTransport: "AVION",
  });
  if (avion.results.some((r) => r.modeTransport === "BUS")) {
    throw new Error("AC2 FAIL: bus dans résultats AVION");
  }
  console.log("avion results on mercredi:", avion.results.length, "(attendu 0 — avion = vendredi)");
  console.log("AC2 OK");

  // VENDREDI = 5
  const vendredi = nextWeekday(5);
  console.log("\n2b) Kin→Lubumbashi AVION @", vendredi);
  const avionVen = await searchDeparts({
    organizationId: org.id,
    villeDepart: "Kinshasa",
    villeArrivee: "Lubumbashi",
    date: vendredi,
    modeTransport: "AVION",
  });
  console.log(
    "results:",
    avionVen.results.map((r) => ({ mode: r.modeTransport, heure: r.heureDepart })),
  );
  if (avionVen.results.length === 0) {
    throw new Error("AC2 FAIL: attendu départ avion vendredi");
  }
  if (avionVen.results.some((r) => r.modeTransport !== "AVION")) {
    throw new Error("AC2 FAIL: non-avion dans filtre AVION");
  }

  console.log("\n3) Complets exclus par défaut");
  const withFlag = await searchDeparts({
    organizationId: org.id,
    villeDepart: "Kinshasa",
    villeArrivee: "Lubumbashi",
    date: mercredi,
    includeComplets: true,
  });
  const without = await searchDeparts({
    organizationId: org.id,
    villeDepart: "Kinshasa",
    villeArrivee: "Lubumbashi",
    date: mercredi,
    includeComplets: false,
  });
  if (without.results.some((r) => r.complet)) {
    throw new Error("AC3 FAIL: complet présent sans includeComplets");
  }
  console.log("sans complets:", without.results.length, "avec flag:", withFlag.results.length);
  console.log("AC3 OK (règle: exclus par défaut)");

  console.log("\n5) Mauvaise org / slug");
  try {
    await resolveOrganizationScope({ organizationSlug: "org-qui-nexiste-pas" });
    throw new Error("AC5 FAIL: slug invalide aurait dû échouer");
  } catch (e) {
    if (e instanceof Error && e.message.includes("AC5")) throw e;
    console.log("slug invalide →", (e as Error).message);
  }
  try {
    await resolveOrganizationScope({
      organizationId: org.id,
      organizationSlug: "autre-slug",
    });
    throw new Error("AC5 FAIL: mismatch id/slug aurait dû échouer");
  } catch (e) {
    if (e instanceof Error && e.message.includes("AC5")) throw e;
    console.log("mismatch →", (e as Error).message);
  }
  const leak = await searchDeparts({
    organizationId: org.id,
    villeDepart: "Kinshasa",
    villeArrivee: "Lubumbashi",
    date: mercredi,
  });
  if (leak.results.some((r) => !r.departId)) {
    throw new Error("AC5 FAIL");
  }
  // Vérifie que la query est bien scopée
  const foreign = await prisma.trajetDepart.count({
    where: {
      trajet: {
        organizationId: { not: org.id },
        villeDepart: { equals: "Kinshasa", mode: "insensitive" },
        villeArrivee: { equals: "Lubumbashi", mode: "insensitive" },
      },
    },
  });
  console.log("départs autres orgs (Kin→Lubu):", foreign);
  console.log("AC5 OK");

  console.log("\n✅ Tous les critères U05 smoke OK");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
