import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createReservationSchema } from "./schema";

const base = {
  clientId: "11111111-1111-4111-8111-111111111111",
  trajetId: "22222222-2222-4222-8222-222222222222",
  trajetDepartId: "33333333-3333-4333-8333-333333333333",
  dateDepart: new Date("2026-08-10"),
  heureDepart: "08:00",
  modePaiement: "CASH" as const,
  pricing: { totalPassagers: 10000, totalColis: 0, total: 10000 },
};

describe("createReservationSchema — destinataire colis (U03)", () => {
  it("refuse une réservation avec colis sans destinataire", () => {
    const parsed = createReservationSchema.safeParse({
      ...base,
      nombrePlaces: 1,
      passagers: [
        {
          nom: "Doe",
          prenom: "John",
          sexe: "M",
          categorie: "ADULTE",
          prix: 10000,
        },
      ],
      colis: { type: "ORDINAIRE", poids: 10, prix: 0 },
      pricing: { totalPassagers: 10000, totalColis: 0, total: 10000 },
    });
    assert.equal(parsed.success, false);
    if (!parsed.success) {
      const paths = parsed.error.issues.map((i) => i.path.join("."));
      assert.ok(paths.some((p) => p.includes("destinataire")));
    }
  });

  it("accepte une réservation colis seul avec destinataire", () => {
    const parsed = createReservationSchema.safeParse({
      ...base,
      nombrePlaces: 0,
      passagers: [],
      colis: {
        type: "ORDINAIRE",
        poids: 12,
        prix: 5000,
        destinataireNom: "Marie Kabila",
        destinataireTel: "+243900111222",
        destinataireId: "CD-123456",
      },
      pricing: { totalPassagers: 0, totalColis: 5000, total: 5000 },
    });
    assert.equal(parsed.success, true);
  });

  it("n’exige pas de destinataire sans colis", () => {
    const parsed = createReservationSchema.safeParse({
      ...base,
      nombrePlaces: 1,
      passagers: [
        {
          nom: "Doe",
          prenom: "John",
          sexe: "M",
          categorie: "ADULTE",
          prix: 10000,
        },
      ],
      colis: { prix: 0 },
      pricing: { totalPassagers: 10000, totalColis: 0, total: 10000 },
    });
    assert.equal(parsed.success, true);
  });
});
