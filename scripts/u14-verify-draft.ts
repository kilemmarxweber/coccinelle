import "dotenv/config";
import prisma from "../lib/prisma";
import { createCheckoutDraft, getCheckoutDraft, updateCheckoutDraft, draftExpiresAt } from "../lib/reservation/draft";
import { CapaciteInsuffisanteError } from "../lib/reservation/capacite";

async function main() {
  const depart = await prisma.trajetDepart.findFirst({
    where: {
      statut: { not: "ANNULE" },
      trajet: { organizationId: "org-1" },
      capacitePlaces: { gte: 2 },
    },
    include: { trajet: true },
    orderBy: { dateDepart: "asc" },
  });
  if (!depart) throw new Error("no depart");

  const { draftToken } = await createCheckoutDraft({
    organizationId: "org-1",
    organizationSlug: "default-org",
    departId: depart.id,
  });
  console.log("CREATED", draftToken, "depart", depart.id);

  const loaded = await getCheckoutDraft({ organizationId: "org-1", draftToken });
  console.log("LOADED", { expired: loaded?.expired, step: loaded?.payload.step, pax: loaded?.payload.passagers.length });

  const updated = await updateCheckoutDraft({
    organizationId: "org-1",
    draftToken,
    payload: {
      ...loaded!.payload,
      passagers: [
        { nom: "Mbala", prenom: "Alice", sexe: "F", categorie: "ADULTE", telephone: "+243900" },
      ],
    },
  });
  console.log("UPDATED", updated.payload.passagers[0].nom);

  const many = Array.from({ length: updated.placesRestantes + 2 }, (_, i) => ({
    nom: `P${i}`,
    prenom: "X",
    sexe: "M" as const,
    categorie: "ADULTE" as const,
  }));
  try {
    await updateCheckoutDraft({
      organizationId: "org-1",
      draftToken,
      payload: { ...updated.payload, passagers: many },
    });
    console.log("FAIL expected capacity error");
    process.exit(1);
  } catch (e) {
    if (e instanceof CapaciteInsuffisanteError) {
      console.log("OK capacity blocked", e.message);
    } else {
      throw e;
    }
  }

  await prisma.reservationDraft.update({
    where: { draftToken },
    data: { expiresAt: new Date(Date.now() - 1000) },
  });
  const expired = await getCheckoutDraft({ organizationId: "org-1", draftToken });
  console.log("EXPIRED_FLAG", expired?.expired);
  console.log("EXPIRED_URL", `http://localhost:3000/default-org/checkout/${draftToken}`);

  const fresh = await createCheckoutDraft({
    organizationId: "org-1",
    organizationSlug: "default-org",
    departId: depart.id,
  });
  console.log("BROWSER_URL", `http://localhost:3000/default-org/checkout/${fresh.draftToken}`);
  console.log("DEPART_URL", `http://localhost:3000/default-org/departs/${depart.id}`);
  console.log("TTL_HELPER", draftExpiresAt().toISOString());
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
