import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ALL_ORG_ROLE_SLUGS,
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

const HOTEL_RESOURCES = ["hotel_room", "hotel_stay", "hotel_fnb"] as const;
const HOTEL_ACTIONS = ["create", "update", "delete", "read"] as const;

describe("U04 — grille organizationRoleStatements", () => {
  it("expose le rôle guichetier dans organizationRoles", () => {
    assert.ok(organizationRoles[ORG_ROLE.GUICHETIER]);
  });

  it("guichetier : inscription:create → true", () => {
    assert.equal(allows(ORG_ROLE.GUICHETIER, "inscription", "create"), true);
  });

  it("client : inscription:create → false", () => {
    assert.equal(allows(ORG_ROLE.CLIENT, "inscription", "create"), false);
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
});

describe("units-09 — rôles hôtel", () => {
  it("slugs receptioniste / caissier / client présents ; parent retiré", () => {
    assert.ok(organizationRoles[ORG_ROLE.RECEPTIONISTE]);
    assert.ok(organizationRoles[ORG_ROLE.CAISSIER]);
    assert.ok(organizationRoles[ORG_ROLE.CLIENT]);
    assert.ok(ALL_ORG_ROLE_SLUGS.includes(ORG_ROLE.RECEPTIONISTE));
    assert.ok(ALL_ORG_ROLE_SLUGS.includes(ORG_ROLE.CAISSIER));
    assert.ok(ALL_ORG_ROLE_SLUGS.includes(ORG_ROLE.CLIENT));
    assert.equal(
      (ALL_ORG_ROLE_SLUGS as readonly string[]).includes("parent"),
      false,
    );
    assert.equal(organizationRoleStatements.parent, undefined);
  });

  it("guichetier : aucune permission hotel_*", () => {
    for (const resource of HOTEL_RESOURCES) {
      for (const action of HOTEL_ACTIONS) {
        assert.equal(
          allows(ORG_ROLE.GUICHETIER, resource, action),
          false,
          `guichetier ne doit pas avoir ${resource}:${action}`,
        );
      }
    }
  });

  it("receptioniste ≠ caissier (matrices hôtel)", () => {
    assert.equal(allows(ORG_ROLE.RECEPTIONISTE, "hotel_room", "read"), true);
    assert.equal(allows(ORG_ROLE.RECEPTIONISTE, "hotel_room", "update"), true);
    assert.equal(allows(ORG_ROLE.RECEPTIONISTE, "hotel_room", "create"), false);
    assert.equal(allows(ORG_ROLE.RECEPTIONISTE, "hotel_stay", "create"), true);
    assert.equal(allows(ORG_ROLE.RECEPTIONISTE, "hotel_stay", "update"), true);
    assert.equal(allows(ORG_ROLE.RECEPTIONISTE, "hotel_stay", "read"), true);
    assert.equal(allows(ORG_ROLE.RECEPTIONISTE, "hotel_fnb", "read"), false);

    assert.equal(allows(ORG_ROLE.CAISSIER, "hotel_stay", "read"), true);
    assert.equal(allows(ORG_ROLE.CAISSIER, "hotel_stay", "update"), true);
    assert.equal(allows(ORG_ROLE.CAISSIER, "hotel_stay", "create"), false);
    assert.equal(allows(ORG_ROLE.CAISSIER, "hotel_room", "read"), true);
    assert.equal(allows(ORG_ROLE.CAISSIER, "hotel_room", "update"), false);
    assert.equal(allows(ORG_ROLE.CAISSIER, "hotel_fnb", "read"), false);
  });

  it("owner / gérant / serveur / client — matrices hôtel", () => {
    assert.equal(allows(ORG_ROLE.OWNER, "hotel_room", "create"), true);
    assert.equal(allows(ORG_ROLE.OWNER, "hotel_stay", "create"), true);
    assert.equal(allows(ORG_ROLE.OWNER, "hotel_fnb", "create"), true);

    assert.equal(allows(ORG_ROLE.GESTIONNAIRE, "hotel_room", "create"), true);
    assert.equal(allows(ORG_ROLE.GESTIONNAIRE, "hotel_stay", "update"), true);
    assert.equal(allows(ORG_ROLE.GESTIONNAIRE, "hotel_fnb", "read"), true);
    assert.equal(allows(ORG_ROLE.GESTIONNAIRE, "rapport", "read"), true);

    assert.ok(organizationRoles[ORG_ROLE.SERVEUR]);
    assert.equal(allows(ORG_ROLE.SERVEUR, "hotel_fnb", "create"), true);
    assert.equal(allows(ORG_ROLE.SERVEUR, "hotel_stay", "read"), false);
    assert.equal(allows(ORG_ROLE.SERVEUR, "hotel_room", "read"), false);

    assert.equal(allows(ORG_ROLE.CLIENT, "hotel_stay", "read"), false);
    assert.equal(allows(ORG_ROLE.CLIENT, "hotel_room", "read"), false);
    assert.equal(allows(ORG_ROLE.CLIENT, "hotel_fnb", "read"), false);
  });

  it("rôles hôtel-only : aucune permission agence (inscription/trajet/depart/embarquement)", () => {
    const hotelOnly = [
      ORG_ROLE.RECEPTIONISTE,
      ORG_ROLE.CAISSIER,
      ORG_ROLE.SERVEUR,
      ORG_ROLE.CLIENT,
    ] as const;
    const agenceResources = [
      "inscription",
      "trajet",
      "depart",
      "embarquement",
    ] as const;

    for (const role of hotelOnly) {
      for (const resource of agenceResources) {
        const actions =
          organizationRoleStatements[role]?.[
            resource as keyof (typeof organizationRoleStatements)[string]
          ];
        assert.equal(
          actions,
          undefined,
          `${role} ne doit pas avoir de statement ${resource}`,
        );
      }
    }
  });
});
