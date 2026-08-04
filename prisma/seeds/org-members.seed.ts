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
    id: "user-gerant-1",
    name: "Gérant Agence",
    email: "gerant@test.com",
    role: ORG_ROLE.GESTIONNAIRE,
  },
  {
    id: "user-guichetier-1",
    name: "Guichetier Comptoir",
    email: "guichetier@test.com",
    role: ORG_ROLE.GUICHETIER,
  },
  {
    id: "user-client-1",
    name: "Client Demo",
    email: "client@test.com",
    role: ORG_ROLE.PARENT,
  },
] as const;

/** Seeds les 4 rôles produit (owner / gérant / guichetier / client) pour org-1. */
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

    if (m.role === ORG_ROLE.PARENT) {
      await prisma.client.upsert({
        where: { userId: user.id },
        update: {},
        create: {
          id: `client-${user.id}`,
          userId: user.id,
          telephone: "+243900000001",
          societe: null,
        },
      });
    }
  }

  console.log(
    `✅ Org members seeded (password: ${SEED_PASSWORD}) — owner / gerant / guichetier / client @test.com`,
  );
}
