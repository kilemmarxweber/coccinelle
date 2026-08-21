import "dotenv/config";

import { seedRootAdmin } from "./seeds/admin.seed";
import prisma from "@/lib/prisma";

async function main() {
  console.log("🚀 START SEED");
  await seedRootAdmin();
  console.log("🎉 SEED COMPLETED");
}

main()
  .catch((e) => {
    console.error("❌ SEED ERROR:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
