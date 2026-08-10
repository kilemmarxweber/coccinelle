"use server";
import "dotenv/config";
import prisma from "@/lib/prisma";

export async function seedOrganization() {
  const org = await prisma.organization.upsert({
    where: { slug: "default-org" },
    update: {
      name: "Coccinelle Demo",
    },
    create: {
      id: "org-1",
      name: "Coccinelle Demo",
      slug: "default-org",
      createdAt: new Date(),
    },
  });

  return org;
}
