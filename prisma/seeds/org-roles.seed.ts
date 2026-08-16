"use server";
import "dotenv/config";
import { bootstrapOrganizationRolesForExistingOrgs } from "@/lib/org/seed-org-roles";

/** Seed presets OrganizationRole + migration slugs pour toutes les orgs. */
export async function seedOrgRoles() {
  const { seeds, migration } = await bootstrapOrganizationRolesForExistingOrgs();
  const created = seeds.reduce((n, s) => n + s.created.length, 0);
  console.log(
    `✅ Org roles seeded (${created} new) — members legacy=${migration.memberLegacyUpdated} ops=${migration.memberFromBranchOpsUpdated}`,
  );
}
