import "dotenv/config";
import { randomUUID } from "crypto";
import { hashPassword } from "better-auth/crypto";
import prisma from "@/lib/prisma";
import { APP_ROLE } from "@/lib/permissions";

const ROOT_EMAIL = "kilemmarxweber@gmail.com";
const ROOT_PASSWORD = "123456789";
const ROOT_NAME = "Kilem Marx Weber";

/** Admin plateforme (root) : peut créer les organisations. */
export async function seedRootAdmin() {
  const passwordHash = await hashPassword(ROOT_PASSWORD);

  const user = await prisma.user.upsert({
    where: { email: ROOT_EMAIL },
    update: {
      name: ROOT_NAME,
      role: APP_ROLE.ADMIN,
      emailVerified: true,
      banned: false,
    },
    create: {
      id: randomUUID(),
      name: ROOT_NAME,
      email: ROOT_EMAIL,
      emailVerified: true,
      role: APP_ROLE.ADMIN,
    },
  });

  const credential = await prisma.account.findFirst({
    where: { userId: user.id, providerId: "credential" },
    select: { id: true },
  });

  if (credential) {
    await prisma.account.update({
      where: { id: credential.id },
      data: { password: passwordHash },
    });
  } else {
    await prisma.account.create({
      data: {
        id: `${user.id}-credential`,
        accountId: user.id,
        providerId: "credential",
        userId: user.id,
        password: passwordHash,
      },
    });
  }

  console.log(
    `✅ Root admin seeded: ${ROOT_EMAIL} (role=${APP_ROLE.ADMIN})`,
  );
}
