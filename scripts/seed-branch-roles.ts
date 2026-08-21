import "dotenv/config";
import { seedBranchRoles } from "../prisma/seeds/branch-roles.seed";

seedBranchRoles()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
