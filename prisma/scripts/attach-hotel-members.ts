import "dotenv/config";
import prisma from "@/lib/prisma";
import { hashPassword } from "better-auth/crypto";
import { ORG_ROLE } from "@/lib/permissions";

const SEED_PASSWORD = "Password123!";

const HOTEL_STAFF = [
  {
    id: "user-receptioniste-1",
    name: "Réceptionniste Hôtel",
    email: "receptioniste@test.com",
    role: ORG_ROLE.RECEPTIONISTE,
  },
  {
    id: "user-caissier-1",
    name: "Caissier Hôtel",
    email: "caissier@test.com",
    role: ORG_ROLE.CAISSIER,
  },
  {
    id: "user-serveur-1",
    name: "Serveur Restauration",
    email: "serveur@test.com",
    role: ORG_ROLE.SERVEUR,
  },
] as const;

async function main() {
  const hotels = await prisma.branch.findMany({
    where: { organizationId: "org-1", type: "HOTEL" },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      code: true,
      status: true,
      _count: { select: { members: true } },
    },
  });

  console.log("HOTEL branches:");
  for (const h of hotels) {
    console.log(
      `  ${h.status} ${h.code} — ${h.name} (${h.id}) members=${h._count.members}`,
    );
  }

  // Prefer empty ACTIVE hotel, else HTL-DEMO, else newest ACTIVE
  const target =
    hotels.find((h) => h.status === "ACTIVE" && h._count.members === 0) ??
    hotels.find((h) => h.code === "HTL-DEMO") ??
    hotels.find((h) => h.status === "ACTIVE") ??
    hotels[0];

  if (!target) {
    throw new Error("Aucune branche HOTEL sur org-1");
  }

  // Ensure ACTIVE so staff can use it
  if (target.status !== "ACTIVE") {
    await prisma.branch.update({
      where: { id: target.id },
      data: { status: "ACTIVE" },
    });
    console.log(`Réouvert: ${target.name}`);
  }

  const passwordHash = await hashPassword(SEED_PASSWORD);
  const attached: Array<{ email: string; role: string }> = [];

  for (const m of HOTEL_STAFF) {
    const user = await prisma.user.upsert({
      where: { email: m.email },
      update: { name: m.name, role: "user", emailVerified: true },
      create: {
        id: m.id,
        name: m.name,
        email: m.email,
        emailVerified: true,
        role: "user",
      },
    });

    await prisma.account.upsert({
      where: { id: `${user.id}-credential` },
      update: { password: passwordHash },
      create: {
        id: `${user.id}-credential`,
        accountId: user.id,
        providerId: "credential",
        userId: user.id,
        password: passwordHash,
      },
    });

    const member = await prisma.member.upsert({
      where: { id: `${user.id}-member` },
      update: { role: m.role },
      create: {
        id: `${user.id}-member`,
        userId: user.id,
        organizationId: "org-1",
        role: m.role,
        createdAt: new Date(),
      },
    });

    await prisma.branchMember.upsert({
      where: {
        branchId_memberId: {
          branchId: target.id,
          memberId: member.id,
        },
      },
      update: { status: "ACTIVE" },
      create: {
        id: `bm-${member.id}-${target.code}`,
        branchId: target.id,
        memberId: member.id,
        role: "staff",
        status: "ACTIVE",
      },
    });

    attached.push({ email: m.email, role: m.role });
  }

  console.log(`\nBranchMembers → ${target.name} (${target.code})`);
  for (const a of attached) {
    console.log(`  ${a.role}: ${a.email} / ${SEED_PASSWORD}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
