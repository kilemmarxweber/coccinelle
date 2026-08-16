/**
 * R07 — helpers permission (caisse / hôtel) + gates catalogue.
 * Scénarios : serveur sans encaisser ; caissier ; encaisser-only ; guichetier.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ORG_ROLE_PRESET,
  ORG_ROLE_PRESET_PERMISSIONS,
} from "@/lib/org/role-presets";
import { DASH_CARD } from "@/lib/branch/ops-roles";
import { voirPermissionForDashCard } from "@/lib/branch/dash-card-permissions";
import {
  permissionMapAllows,
  type OrganizationPermissionMap,
} from "./organization-permission";

const serveur = ORG_ROLE_PRESET_PERMISSIONS[ORG_ROLE_PRESET.SERVEUR];
const caissier = ORG_ROLE_PRESET_PERMISSIONS[ORG_ROLE_PRESET.CAISSIER];
const guichetier = ORG_ROLE_PRESET_PERMISSIONS[ORG_ROLE_PRESET.GUICHETIER];
const gerant = ORG_ROLE_PRESET_PERMISSIONS[ORG_ROLE_PRESET.GERANT];

/** Matrice custom : Encaisser sans Ouvrir (checklist Marie). */
const encaisserOnly: OrganizationPermissionMap = {
  caisse: ["voir", "encaisser"],
};

describe("R07 — permissionMapAllows (caisse / hôtel)", () => {
  it("serveur : restauration OK ; ouvrir session / encaisser refusés", () => {
    assert.equal(
      permissionMapAllows(serveur, { restauration: ["voir"] }),
      true,
    );
    assert.equal(
      permissionMapAllows(serveur, { restauration: ["ajouter"] }),
      true,
    );
    assert.equal(
      permissionMapAllows(serveur, { caisse: ["ouvrir"] }),
      false,
      "openCashSessionAction exige caisse.ouvrir",
    );
    assert.equal(
      permissionMapAllows(serveur, { caisse: ["encaisser"] }),
      false,
      "createPaymentAction exige caisse.encaisser",
    );
  });

  it("caissier : ouvrir + encaisser OK ; hub caisse · voir OK", () => {
    assert.equal(
      permissionMapAllows(caissier, { caisse: ["ouvrir"] }),
      true,
    );
    assert.equal(
      permissionMapAllows(caissier, { caisse: ["encaisser"] }),
      true,
    );
    assert.equal(
      permissionMapAllows(caissier, { caisse: ["voir"] }),
      true,
    );
    assert.equal(
      permissionMapAllows(caissier, { caisse: ["ouvrir", "encaisser"] }),
      true,
    );
  });

  it("sans caisse.ouvrir : encaisser seul possible si configuré ainsi", () => {
    assert.equal(
      permissionMapAllows(encaisserOnly, { caisse: ["encaisser"] }),
      true,
    );
    assert.equal(
      permissionMapAllows(encaisserOnly, { caisse: ["ouvrir"] }),
      false,
    );
    assert.equal(
      permissionMapAllows(encaisserOnly, { caisse: ["fermer"] }),
      false,
    );
  });

  it("gérant hôtel : chambres · voir OK ; caisse refusée", () => {
    assert.equal(
      permissionMapAllows(gerant, { chambres: ["voir"] }),
      true,
    );
    assert.equal(
      permissionMapAllows(gerant, { sejours: ["voir"] }),
      true,
    );
    assert.equal(
      permissionMapAllows(gerant, { caisse: ["encaisser"] }),
      false,
    );
    assert.equal(
      permissionMapAllows(gerant, { restauration: ["voir"] }),
      false,
    );
  });

  it("guichetier seed : agence OK ; modules hôtel refusés", () => {
    assert.equal(
      permissionMapAllows(guichetier, { inscription: ["ajouter"] }),
      true,
    );
    assert.equal(
      permissionMapAllows(guichetier, { embarquement: ["scanner"] }),
      true,
    );
    assert.equal(
      permissionMapAllows(guichetier, { caisse: ["voir"] }),
      false,
    );
    assert.equal(
      permissionMapAllows(guichetier, { sejours: ["voir"] }),
      false,
    );
    assert.equal(
      permissionMapAllows(guichetier, { chambres: ["voir"] }),
      false,
    );
  });

  it("sans Équipe · Gérer / sans Contrôle d’accès · Ajouter", () => {
    assert.equal(
      permissionMapAllows(caissier, { equipe: ["gerer"] }),
      false,
    );
    assert.equal(
      permissionMapAllows(serveur, { ac: ["create"] }),
      false,
    );
    assert.equal(
      permissionMapAllows(guichetier, { equipe: ["gerer"] }),
      false,
    );
  });
});

describe("R07 — dash cards hub → catalogue Voir", () => {
  it("carte caisse / chambres / guichet mappées correctement", () => {
    assert.deepEqual(voirPermissionForDashCard(DASH_CARD.CAISSE), {
      caisse: ["voir"],
    });
    assert.deepEqual(voirPermissionForDashCard(DASH_CARD.CHAMBRES), {
      chambres: ["voir"],
    });
    assert.deepEqual(voirPermissionForDashCard(DASH_CARD.GUICHET), {
      inscription: ["ajouter"],
    });
  });

  it("filtre hub : serveur voit restauration, pas caisse", () => {
    const resto = voirPermissionForDashCard(DASH_CARD.RESTAURATION)!;
    const caisse = voirPermissionForDashCard(DASH_CARD.CAISSE)!;
    assert.equal(permissionMapAllows(serveur, resto), true);
    assert.equal(permissionMapAllows(serveur, caisse), false);
  });

  it("filtre hub : guichetier voit guichet, pas séjours hôtel", () => {
    const guichet = voirPermissionForDashCard(DASH_CARD.GUICHET)!;
    const sejours = voirPermissionForDashCard(DASH_CARD.SEJOURS)!;
    assert.equal(permissionMapAllows(guichetier, guichet), true);
    assert.equal(permissionMapAllows(guichetier, sejours), false);
  });
});
