import "dotenv/config";
import prisma from "@/lib/prisma";
import { ORG_ROLE } from "@/lib/permissions";

const EMAIL = "agasajade2000@gmail.com";
const BRANCH_ID = "branch-hotel-demo-1";

async function main() {
  const user = await prisma.user.findUnique({ where: { email: EMAIL } });
  if (!user) throw new Error(`User introuvable: ${EMAIL}`);

  // Un seul rôle org par membre : owner couvre aussi les droits gérant hôtel.
  const existing = await prisma.member.findFirst({
    where: { organizationId: "org-1", userId: user.id },
  });
  const member = existing
    ? await prisma.member.update({
        where: { id: existing.id },
        data: { role: ORG_ROLE.OWNER },
      })
    : await prisma.member.create({
        data: {
          id: `${user.id}-member-org-1`,
          userId: user.id,
          organizationId: "org-1",
          role: ORG_ROLE.OWNER,
          createdAt: new Date(),
        },
      });

  await prisma.branchMember.upsert({
    where: {
      branchId_memberId: { branchId: BRANCH_ID, memberId: member.id },
    },
    update: { status: "ACTIVE", role: "branch_manager", isPrimary: true },
    create: {
      id: `bm-${member.id}-HTL-DEMO`,
      branchId: BRANCH_ID,
      memberId: member.id,
      role: "branch_manager",
      isPrimary: true,
      status: "ACTIVE",
    },
  });

  // Rattacher aussi les comptes seed owner + gérant s’ils existent.
  const seedStaff = await prisma.member.findMany({
    where: {
      organizationId: "org-1",
      role: { in: [ORG_ROLE.OWNER, ORG_ROLE.GESTIONNAIRE] },
      user: { email: { not: EMAIL } },
    },
    include: { user: { select: { email: true } } },
  });

  for (const m of seedStaff) {
    await prisma.branchMember.upsert({
      where: {
        branchId_memberId: { branchId: BRANCH_ID, memberId: m.id },
      },
      update: { status: "ACTIVE" },
      create: {
        id: `bm-${m.id}-HTL-DEMO`,
        branchId: BRANCH_ID,
        memberId: m.id,
        role: m.role === ORG_ROLE.OWNER ? "branch_manager" : "staff",
        status: "ACTIVE",
      },
    });
  }

  const all = await prisma.branchMember.findMany({
    where: { branchId: BRANCH_ID },
    include: {
      member: { include: { user: { select: { email: true, name: true } } } },
    },
    orderBy: { createdAt: "asc" },
  });

  console.log(`✅ ${EMAIL} → owner + BranchMember HTL-DEMO`);
  console.log("Membres branche:");
  for (const bm of all) {
    console.log(
      `  ${bm.member.role.padEnd(14)} ${bm.member.user.email} (${bm.member.user.name})`,
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
