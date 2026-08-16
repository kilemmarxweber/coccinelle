/**
 * R02 — presets OrganizationRole + critères d’acceptation.
 * MCP Better Auth (createOrgRole / organizationRole.permission JSON) consulté.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ORG_ROLE_PRESET,
  ORG_ROLE_PRESET_PERMISSIONS,
  ORG_ROLE_PRESET_SLUGS,
  serializeOrgRolePermission,
} from "./role-presets";

describe("R02 — role presets", () => {
  it("expose les 6 presets seedés", () => {
    assert.deepEqual([...ORG_ROLE_PRESET_SLUGS], [
      "caissier",
      "serveur",
      "receptionniste",
      "gerant",
      "guichetier",
      "client",
    ]);
  });

  it("caissier inclut caisse.encaisser et caisse.ouvrir", () => {
    const caisse = ORG_ROLE_PRESET_PERMISSIONS[ORG_ROLE_PRESET.CAISSIER].caisse;
    assert.ok(caisse?.includes("encaisser"));
    assert.ok(caisse?.includes("ouvrir"));
    assert.ok(caisse?.includes("fermer"));
    assert.ok(caisse?.includes("voir"));
    assert.ok(caisse?.includes("modifier"));
  });

  it("guichetier : permissions agence sans hôtel", () => {
    const g = ORG_ROLE_PRESET_PERMISSIONS[ORG_ROLE_PRESET.GUICHETIER];
    assert.ok(g.inscription?.includes("partager"));
    assert.ok(g.inscription?.includes("ajouter"));
    assert.deepEqual([...(g.depart ?? [])], ["voir"]);
    assert.ok(g.embarquement?.includes("scanner"));
    assert.ok(g.colis?.includes("ajouter"));
    assert.equal(g.caisse, undefined);
    assert.equal(g.restauration, undefined);
    assert.equal(g.sejours, undefined);
  });

  it("gerant : hôtel sans caisse / restauration / cuisine / mes commandes", () => {
    const g = ORG_ROLE_PRESET_PERMISSIONS[ORG_ROLE_PRESET.GERANT];
    assert.equal(g.caisse, undefined);
    assert.equal(g.restauration, undefined);
    assert.equal(g.cuisine, undefined);
    assert.equal(g.rapport_mes_commandes, undefined);
    assert.ok(g.sejours?.includes("voir"));
    assert.ok(g.chambres?.includes("modifier"));
    assert.ok(g.rapport_tableau?.includes("voir"));
  });

  it("client : aucune permission", () => {
    assert.deepEqual(
      ORG_ROLE_PRESET_PERMISSIONS[ORG_ROLE_PRESET.CLIENT],
      {},
    );
  });

  it("serializeOrgRolePermission produit du JSON BA-compatible", () => {
    const json = serializeOrgRolePermission(
      ORG_ROLE_PRESET_PERMISSIONS[ORG_ROLE_PRESET.CAISSIER],
    );
    const parsed = JSON.parse(json) as Record<string, string[]>;
    assert.ok(parsed.caisse.includes("encaisser"));
    assert.ok(parsed.caisse.includes("ouvrir"));
  });
});
