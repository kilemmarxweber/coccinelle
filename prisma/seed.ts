import "dotenv/config";

import { seedTrajets } from "./seeds/trajet.seed";
import { seedClients } from "./seeds/client.seed";
import { seedReservations } from "./seeds/reservation.seed";
import { seedColis } from "./seeds/colis.seed";
import { seedPaiements } from "./seeds/paiement.seed";
import { seedPenalites } from "./seeds/penalite.seed";
import { seedPassagers } from "./seeds/passages.seed";

async function main() {
  console.log("🚀 START FULL SEED");

  await seedTrajets();
  await seedClients();
  await seedReservations();
  await seedPassagers();
  await seedColis();
  await seedPaiements();
  await seedPenalites();

  console.log("🎉 ALL SEEDS COMPLETED");
}

main().catch((e) => {
  console.error("❌ SEED ERROR:", e);
  process.exit(1);
});
