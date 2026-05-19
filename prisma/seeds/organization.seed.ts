"use server";
import "dotenv/config";
import prisma from "@/lib/prisma";

export async function seedOrganization() {
  const org = await prisma.organization.upsert({
    where: { slug: "default-org" },
    update: {},
    create: {
      id: "org-1",
      name: "Mon Agence",
      slug: "default-org",
      createdAt: new Date(),
    },
  });

  return org;
}
