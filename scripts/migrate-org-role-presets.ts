/**
 * One-shot : seed OrganizationRole presets + migration slugs legacy (R02).
 * Idempotent — safe to re-run.
 *
 *   npx tsx scripts/migrate-org-role-presets.ts
 */
import "dotenv/config";
import { bootstrapOrganizationRolesForExistingOrgs } from "../lib/org/seed-org-roles";

async function main() {
  const { seeds, migration } = await bootstrapOrganizationRolesForExistingOrgs();

  let createdTotal = 0;
  let skippedTotal = 0;
  for (const s of seeds) {
    createdTotal += s.created.length;
    skippedTotal += s.skipped.length;
    if (s.created.length > 0) {
      console.log(
        `org ${s.organizationId}: created [${s.created.join(", ")}]`,
      );
    }
  }

  console.log(
    `✅ Presets: ${createdTotal} created, ${skippedTotal} already present (${seeds.length} org(s))`,
  );
  console.log(
    `✅ Members: ${migration.memberLegacyUpdated} legacy slug(s), ${migration.memberFromBranchOpsUpdated} from BranchMember ops, ${migration.ownerSkipped} owner touch(es) skipped`,
  );
}

main().catch((err) => {
  console.error("❌ migrate-org-role-presets:", err);
  process.exit(1);
});
