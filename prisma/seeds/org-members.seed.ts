"use server";
import "dotenv/config";
import { hashPassword } from "better-auth/crypto";
import prisma from "@/lib/prisma";
import { ORG_ROLE } from "@/lib/permissions";

const SEED_PASSWORD = "Password123!";

const ORG_MEMBERS = [
  {
    id: "user-owner-1",
    name: "Owner Agence",
    email: "owner@test.com",
    role: ORG_ROLE.OWNER,
  },
  {
    id: "user-admin-1",
    name: "Admin Org",
    email: "admin-org@test.com",
    role: ORG_ROLE.ADMIN,
  },
  {
    id: "user-staff-1",
    name: "User Staff",
    email: "user@test.com",
    role: ORG_ROLE.USER,
  },
] as const;

/** Seeds les 3 rôles org (owner / admin / user) pour org-1. */
export async function seedOrgMembers() {
  const passwordHash = await hashPassword(SEED_PASSWORD);

  for (const m of ORG_MEMBERS) {
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

    await prisma.member.upsert({
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
  }

  console.log(
    `✅ Org members seeded (password: ${SEED_PASSWORD}) — owner / admin-org / user @test.com`,
  );
}
