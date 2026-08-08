import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ORG_ROLE,
  organizationRoleStatements,
  organizationRoles,
} from "./permissions";

function allows(
  role: string,
  resource: string,
  action: string,
): boolean {
  const perms = organizationRoleStatements[role]?.[
    resource as keyof (typeof organizationRoleStatements)[string]
  ] as readonly string[] | undefined;
  return perms?.includes(action) ?? false;
}

describe("U04 — grille organizationRoleStatements", () => {
  it("expose le rôle guichetier dans organizationRoles", () => {
    assert.ok(organizationRoles[ORG_ROLE.GUICHETIER]);
  });

  it("guichetier : inscription:create → true", () => {
    assert.equal(allows(ORG_ROLE.GUICHETIER, "inscription", "create"), true);
  });

  it("parent : inscription:create → false", () => {
    assert.equal(allows(ORG_ROLE.PARENT, "inscription", "create"), false);
  });

  it("gestionnaire : trajet + rapport ; pas besoin vente create", () => {
    assert.equal(allows(ORG_ROLE.GESTIONNAIRE, "trajet", "create"), true);
    assert.equal(allows(ORG_ROLE.GESTIONNAIRE, "depart", "create"), true);
    assert.equal(allows(ORG_ROLE.GESTIONNAIRE, "rapport", "read"), true);
    assert.equal(allows(ORG_ROLE.GESTIONNAIRE, "inscription", "create"), false);
    assert.equal(allows(ORG_ROLE.GESTIONNAIRE, "inscription", "share"), true);
  });

  it("owner : droits métier complets", () => {
    assert.equal(allows(ORG_ROLE.OWNER, "inscription", "create"), true);
    assert.equal(allows(ORG_ROLE.OWNER, "inscription", "delete"), true);
    assert.equal(allows(ORG_ROLE.OWNER, "trajet", "create"), true);
    assert.equal(allows(ORG_ROLE.OWNER, "rapport", "read"), true);
    assert.equal(allows(ORG_ROLE.OWNER, "equipe", "manage"), true);
  });

  it("guichetier : pas de rapport:read ni trajet:create", () => {
    assert.equal(allows(ORG_ROLE.GUICHETIER, "rapport", "read"), false);
    assert.equal(allows(ORG_ROLE.GUICHETIER, "trajet", "create"), false);
    assert.equal(allows(ORG_ROLE.GUICHETIER, "equipe", "manage"), false);
    assert.equal(allows(ORG_ROLE.GUICHETIER, "embarquement", "scan"), true);
  });

  it("units-03 — hôtel : owner / gérant / réception / serveur", () => {
    assert.equal(allows(ORG_ROLE.OWNER, "hotel_room", "create"), true);
    assert.equal(allows(ORG_ROLE.OWNER, "hotel_stay", "create"), true);
    assert.equal(allows(ORG_ROLE.OWNER, "hotel_fnb", "create"), true);

    assert.equal(allows(ORG_ROLE.GESTIONNAIRE, "hotel_room", "create"), true);
    assert.equal(allows(ORG_ROLE.GESTIONNAIRE, "hotel_stay", "update"), true);
    assert.equal(allows(ORG_ROLE.GESTIONNAIRE, "hotel_fnb", "read"), true);

    assert.equal(allows(ORG_ROLE.GUICHETIER, "hotel_room", "read"), true);
    assert.equal(allows(ORG_ROLE.GUICHETIER, "hotel_room", "update"), true);
    assert.equal(allows(ORG_ROLE.GUICHETIER, "hotel_room", "create"), false);
    assert.equal(allows(ORG_ROLE.GUICHETIER, "hotel_stay", "create"), true);
    assert.equal(allows(ORG_ROLE.GUICHETIER, "hotel_fnb", "read"), false);

    assert.ok(organizationRoles[ORG_ROLE.SERVEUR]);
    assert.equal(allows(ORG_ROLE.SERVEUR, "hotel_fnb", "create"), true);
    assert.equal(allows(ORG_ROLE.SERVEUR, "hotel_stay", "read"), false);
    assert.equal(allows(ORG_ROLE.SERVEUR, "hotel_room", "read"), false);

    assert.equal(allows(ORG_ROLE.PARENT, "hotel_stay", "read"), false);
  });
});
