/**
 * Purge toutes les données sauf le user app admin (role = admin) + son account.
 *
 * Usage: pnpm exec tsx prisma/scripts/purge-keep-admin.ts
 */
import "dotenv/config";
import prisma from "@/lib/prisma";

async function main() {
  const admins = await prisma.user.findMany({
    where: { role: "admin" },
    select: { id: true, email: true, name: true },
  });

  if (admins.length === 0) {
    throw new Error("Aucun user role=admin trouvé. Abandon pour éviter une DB vide.");
  }

  const keepIds = admins.map((a) => a.id);
  console.log(
    "🔒 Conservés:",
    admins.map((a) => `${a.email} (${a.id})`).join(", "),
  );

  // Ordre respectant les FK métier
  await prisma.$transaction(async (tx) => {
    await tx.penalite.deleteMany();
    await tx.paiement.deleteMany();
    await tx.colis.deleteMany();
    await tx.passager.deleteMany();
    await tx.reservation.deleteMany();
    await tx.reservationDraft.deleteMany();
    await tx.trajetDepart.deleteMany();
    await tx.trajetProgramme.deleteMany();
    await tx.trajet.deleteMany();
    await tx.client.deleteMany();

    await tx.shopProduct.deleteMany();
    await tx.shopCategory.deleteMany();
    await tx.hotelRoom.deleteMany();
    await tx.hotelRoomType.deleteMany();
    await tx.branchMember.deleteMany();
    await tx.branch.deleteMany();

    await tx.invitation.deleteMany();
    await tx.organizationRole.deleteMany();
    await tx.member.deleteMany();
    await tx.organization.deleteMany();

    await tx.session.deleteMany({ where: { userId: { notIn: keepIds } } });
    await tx.account.deleteMany({ where: { userId: { notIn: keepIds } } });
    await tx.verification.deleteMany();
    await tx.user.deleteMany({ where: { id: { notIn: keepIds } } });
  });

  const remaining = await prisma.user.findMany({
    select: { email: true, role: true },
  });
  console.log("✅ Purge terminée. Users restants:", remaining);
}

main()
  .catch((e) => {
    console.error("❌ Purge failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
