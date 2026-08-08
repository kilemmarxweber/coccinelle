import "dotenv/config";
import { seedOrganization } from "../seeds/organization.seed";
import { seedOrgMembers } from "../seeds/org-members.seed";

async function main() {
  await seedOrganization();
  await seedOrgMembers();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
