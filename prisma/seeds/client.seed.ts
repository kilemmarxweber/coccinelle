"use server";
import "dotenv/config";
import prisma from "@/lib/prisma";
import { ORG_ROLE } from "@/lib/permissions";

export async function seedClients() {
  const users = [
    { id: "user-1", name: "Jean Kabasele", email: "jean@test.com" },
    { id: "user-2", name: "Amina Mbuyi", email: "amina@test.com" },
  ];

  for (const u of users) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: {
        id: u.id,
        name: u.name,
        email: u.email,
        role: "user",
      },
    });

    // 🔗 MEMBER (organization) — client = slug Better Auth `client`
    await prisma.member.upsert({
      where: {
        id: `${u.id}-member`,
      },
      update: { role: ORG_ROLE.CLIENT },
      create: {
        id: `${u.id}-member`,
        userId: user.id,
        organizationId: "org-1",
        role: ORG_ROLE.CLIENT,
        createdAt: new Date(),
      },
    });

    // 👤 CLIENT
    await prisma.client.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        id: `client-${u.id}`,
        userId: user.id,
        telephone: "+243900000000",
        societe: "Test Company",
      },
    });
  }
}
