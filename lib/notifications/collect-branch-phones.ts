import prisma from "@/lib/prisma";
import { resolveWhatsAppTo } from "@/lib/zindua";

/** Téléphones clients / occupants / partenaires d’une branche (E.164 uniques). */
export async function collectBranchPhones(
  branchId: string,
  opts?: { monthsBack?: number },
): Promise<string[]> {
  const months = opts?.monthsBack ?? 12;
  const since = new Date();
  since.setMonth(since.getMonth() - months);

  const [stays, partners] = await Promise.all([
    prisma.hotelStay.findMany({
      where: {
        branchId,
        guestPhone: { not: null },
        createdAt: { gte: since },
      },
      select: { guestPhone: true },
      take: 2000,
    }),
    prisma.branchPartner.findMany({
      where: { branchId, status: "ACTIVE", phone: { not: null } },
      select: { phone: true },
    }),
  ]);

  const set = new Set<string>();
  for (const s of stays) {
    const e164 = resolveWhatsAppTo(s.guestPhone);
    if (e164) set.add(e164);
  }
  for (const p of partners) {
    const e164 = resolveWhatsAppTo(p.phone);
    if (e164) set.add(e164);
  }
  return [...set];
}
