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
    id: "user-serveur-1",
    name: "Serveur Restauration",
    email: "serveur@test.com",
    role: ORG_ROLE.SERVEUR,
  },
  {
    id: "user-client-1",
    name: "Client Demo",
    email: "client@test.com",
    role: ORG_ROLE.PARENT,
  },
] as const;

const BRANCH_STAFF_ROLES = new Set<string>([
  ORG_ROLE.GUICHETIER,
  ORG_ROLE.SERVEUR,
]);

/** Seeds les rôles produit (owner / gérant / guichetier / serveur / client) pour org-1. */
export async function seedOrgMembers() {
  const passwordHash = await hashPassword(SEED_PASSWORD);
  const branchStaffMemberIds: string[] = [];

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

    if (BRANCH_STAFF_ROLES.has(m.role)) {
      branchStaffMemberIds.push(member.id);
    }

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

  const hotelBranch = await prisma.branch.findFirst({
    where: {
      organizationId: "org-1",
      type: "HOTEL",
      status: "ACTIVE",
    },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true },
  });

  if (hotelBranch) {
    for (const memberId of branchStaffMemberIds) {
      await prisma.branchMember.upsert({
        where: {
          branchId_memberId: {
            branchId: hotelBranch.id,
            memberId,
          },
        },
        update: { status: "ACTIVE" },
        create: {
          id: `bm-${memberId}`,
          branchId: hotelBranch.id,
          memberId,
          role: "staff",
          status: "ACTIVE",
        },
      });
    }
    console.log(
      `✅ BranchMember HOTEL: guichetier + serveur → ${hotelBranch.name} (${hotelBranch.id})`,
    );
  } else {
    console.log(
      "⚠️ Aucune branche HOTEL active sur org-1 — créez-en une en gérant, puis re-seed les membres pour rattacher guichetier/serveur.",
    );
  }

  console.log(
    `✅ Org members seeded (password: ${SEED_PASSWORD}) — owner / gerant / guichetier / serveur / client @test.com`,
  );
}
