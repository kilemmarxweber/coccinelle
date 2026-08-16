import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ORG_ROLE,
  normalizeOrgRole,
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

describe("Org roles — owner / admin / user", () => {
  it("expose les 3 rôles dans organizationRoles", () => {
    assert.ok(organizationRoles[ORG_ROLE.OWNER]);
    assert.ok(organizationRoles[ORG_ROLE.ADMIN]);
    assert.ok(organizationRoles[ORG_ROLE.USER]);
  });

  it("normalizeOrgRole mappe le legacy", () => {
    assert.equal(normalizeOrgRole("gestionnaire"), ORG_ROLE.ADMIN);
    assert.equal(normalizeOrgRole("guichetier"), ORG_ROLE.USER);
    assert.equal(normalizeOrgRole("parent"), ORG_ROLE.USER);
    assert.equal(normalizeOrgRole("member"), ORG_ROLE.USER);
    assert.equal(normalizeOrgRole(""), ORG_ROLE.USER);
  });

  it("user : inscription:create → true", () => {
    assert.equal(allows(ORG_ROLE.USER, "inscription", "create"), true);
  });

  it("admin : trajet + rapport + inscription create", () => {
    assert.equal(allows(ORG_ROLE.ADMIN, "trajet", "create"), true);
    assert.equal(allows(ORG_ROLE.ADMIN, "depart", "create"), true);
    assert.equal(allows(ORG_ROLE.ADMIN, "rapport", "read"), true);
    assert.equal(allows(ORG_ROLE.ADMIN, "inscription", "create"), true);
    assert.equal(allows(ORG_ROLE.ADMIN, "inscription", "share"), true);
  });

  it("owner : droits métier complets", () => {
    assert.equal(allows(ORG_ROLE.OWNER, "inscription", "create"), true);
    assert.equal(allows(ORG_ROLE.OWNER, "inscription", "delete"), true);
    assert.equal(allows(ORG_ROLE.OWNER, "trajet", "create"), true);
    assert.equal(allows(ORG_ROLE.OWNER, "rapport", "read"), true);
    assert.equal(allows(ORG_ROLE.OWNER, "equipe", "manage"), true);
  });

  it("user : pas de rapport:read ni trajet:create", () => {
    assert.equal(allows(ORG_ROLE.USER, "rapport", "read"), false);
    assert.equal(allows(ORG_ROLE.USER, "trajet", "create"), false);
    assert.equal(allows(ORG_ROLE.USER, "equipe", "manage"), false);
    assert.equal(allows(ORG_ROLE.USER, "embarquement", "scan"), true);
  });
});
