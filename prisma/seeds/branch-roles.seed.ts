import "dotenv/config";
import { randomUUID } from "crypto";
import prisma from "@/lib/prisma";
import {
  expandRolePrivileges,
  SEED_BRANCH_ROLES,
} from "@/lib/branch/privilege-seed";

/** Seed / upsert catalogue BranchRole + privileges. */
export async function seedBranchRoles() {
  console.log("🔐 Seeding BranchRole privileges…");
  for (const def of SEED_BRANCH_ROLES) {
    const now = new Date();
    const role = await prisma.branchRole.upsert({
      where: { slug: def.slug },
      create: {
        id: randomUUID(),
        slug: def.slug,
        label: def.label,
        description: def.description,
        isSystem: true,
        sortOrder: def.sortOrder,
        updatedAt: now,
      },
      update: {
        label: def.label,
        description: def.description,
        sortOrder: def.sortOrder,
        updatedAt: now,
      },
    });

    const privCount = await prisma.branchRolePrivilege.count({
      where: { roleId: role.id },
    });
    if (privCount > 0) continue;

    const rows = expandRolePrivileges(def);
    if (!rows.length) continue;
    await prisma.branchRolePrivilege.createMany({
      data: rows.map((p) => ({
        id: randomUUID(),
        roleId: role.id,
        resource: p.resource,
        action: p.action,
        allowed: true,
        updatedAt: now,
      })),
    });
  }
  console.log("✅ BranchRole seed OK");
}
