"use server";

import "dotenv/config";
import prisma from "@/lib/prisma";

export async function seedClients() {
  console.log("👤 Seeding clients...");

  const clientsData = [
    { name: "Jean Kabasele", email: "jean@test.com" },
    { name: "Amina Mbuyi", email: "amina@test.com" },
  ];

  for (const c of clientsData) {
    const user = await prisma.user.upsert({
      where: { email: c.email },
      update: {},
      create: {
        id: crypto.randomUUID(),
        name: c.name,
        email: c.email,
        role: "client",
      },
    });

    const existing = await prisma.client.findFirst({
      where: { userId: user.id },
    });

    if (!existing) {
      await prisma.client.create({
        data: {
          id: crypto.randomUUID(),
          userId: user.id,
        },
      });
    }
  }

  console.log("✅ Clients OK");
}
