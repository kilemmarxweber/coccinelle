import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  draftOptionsAdvanceSchema,
  draftPassengersAdvanceSchema,
  draftPayloadPersistSchema,
} from "./draft-schema";
import { draftExpiresAt, isDraftExpired } from "./draft";

describe("draft-schema (U14)", () => {
  it("persiste un payload incomplet", () => {
    const parsed = draftPayloadPersistSchema.safeParse({
      trajetDepartId: "dep-1",
      trajetId: "tr-1",
      passagers: [{ nom: "", prenom: "", sexe: "M", categorie: "ADULTE" }],
      colis: { include: false },
    });
    assert.equal(parsed.success, true);
  });

  it("refuse d’avancer sans destinataire si colis", () => {
    const parsed = draftOptionsAdvanceSchema.safeParse({
      passagers: [
        { nom: "Doe", prenom: "Jane", sexe: "F", categorie: "ADULTE" },
      ],
      colis: { include: true, type: "ORDINAIRE", poids: 10 },
    });
    assert.equal(parsed.success, false);
    if (!parsed.success) {
      const paths = parsed.error.issues.map((i) => i.path.join("."));
      assert.ok(paths.some((p) => p.includes("destinataire")));
    }
  });

  it("accepte options avec destinataire", () => {
    const parsed = draftOptionsAdvanceSchema.safeParse({
      passagers: [
        { nom: "Doe", prenom: "Jane", sexe: "F", categorie: "ADULTE" },
      ],
      colis: {
        include: true,
        type: "ORDINAIRE",
        poids: 10,
        destinataireNom: "Marie",
        destinataireTel: "+243900",
        destinataireId: "CD-1",
      },
    });
    assert.equal(parsed.success, true);
  });

  it("refuse passagers vides à l’avance", () => {
    const parsed = draftPassengersAdvanceSchema.safeParse({
      passagers: [{ nom: "", prenom: "", sexe: "M", categorie: "ADULTE" }],
    });
    assert.equal(parsed.success, false);
  });
});

describe("draft expiry helpers (U14)", () => {
  it("marque un draft expiré", () => {
    const expiresAt = new Date("2026-01-01T10:00:00Z");
    assert.equal(isDraftExpired(expiresAt, new Date("2026-01-01T10:00:01Z")), true);
    assert.equal(isDraftExpired(expiresAt, new Date("2026-01-01T09:59:59Z")), false);
  });

  it("calcule expiresAt dans le futur", () => {
    const from = new Date("2026-08-04T12:00:00Z");
    const exp = draftExpiresAt(from);
    assert.ok(exp.getTime() > from.getTime());
  });
});
