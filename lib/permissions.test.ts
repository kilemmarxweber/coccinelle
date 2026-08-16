/**
 * R01 — catalogue permissions FR (99) + caisse split.
 * MCP Better Auth (organization DAC / createAccessControl) consulté avant édition.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ORG_ROLE,
  ORGANIZATION_PRODUCT_CATALOG,
  accessControlStatements,
  businessAccessControlStatements,
  countOrganizationProductPermissions,
  organizationRoleStatements,
  organizationRoles,
  ownerOrganizationStatements,
} from "./permissions";
import {
  CATALOG_PERMISSIONS_FR,
  permissionLabelFr,
} from "./permission-labels-fr";

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

describe("R01 — catalogue permissions FR", () => {
  it("expose exactement 99 permissions produit", () => {
    assert.equal(countOrganizationProductPermissions(), 99);
    assert.equal(CATALOG_PERMISSIONS_FR.length, 99);
    assert.equal(ORGANIZATION_PRODUCT_CATALOG.length > 0, true);
  });

  it("caisse : ouvrir / fermer / encaisser / voir / modifier (pas ajouter)", () => {
    const caisse = businessAccessControlStatements.caisse;
    assert.deepEqual(
      [...caisse],
      ["voir", "ouvrir", "fermer", "encaisser", "modifier"],
    );
    assert.equal(caisse.includes("ajouter" as never), false);
    assert.ok(accessControlStatements.caisse.includes("ouvrir"));
    assert.ok(accessControlStatements.caisse.includes("fermer"));
    assert.ok(accessControlStatements.caisse.includes("encaisser"));
  });

  it("libellés FR pour chaque permission du catalogue", () => {
    for (const entry of CATALOG_PERMISSIONS_FR) {
      assert.match(entry.label, / · /);
      assert.equal(
        permissionLabelFr(entry.resource, entry.action),
        entry.label,
      );
    }
    assert.equal(permissionLabelFr("caisse", "encaisser"), "Caisse · Encaisser");
    assert.equal(permissionLabelFr("ac", "create"), "Contrôle d’accès · Ajouter");
  });

  it("owner couvre le catalogue métier (caisse + ressources FR)", () => {
    assert.deepEqual(
      [...ownerOrganizationStatements.caisse],
      ["voir", "ouvrir", "fermer", "encaisser", "modifier"],
    );
    assert.ok(allows(ORG_ROLE.OWNER, "caisse", "encaisser"));
    assert.ok(allows(ORG_ROLE.OWNER, "inscription", "ajouter"));
    assert.ok(allows(ORG_ROLE.OWNER, "boutique_produits", "supprimer"));
    assert.ok(allows(ORG_ROLE.OWNER, "equipe", "gerer"));
  });
});

describe("U04 compat — grille organizationRoleStatements (dépréciée)", () => {
  it("expose le rôle guichetier dans organizationRoles", () => {
    assert.ok(organizationRoles[ORG_ROLE.GUICHETIER]);
  });

  it("guichetier : inscription:ajouter → true", () => {
    assert.equal(allows(ORG_ROLE.GUICHETIER, "inscription", "ajouter"), true);
  });

  it("parent : inscription:ajouter → false", () => {
    assert.equal(allows(ORG_ROLE.PARENT, "inscription", "ajouter"), false);
  });

  it("gestionnaire : trajet + rapport_agence ; pas besoin vente ajouter", () => {
    assert.equal(allows(ORG_ROLE.GESTIONNAIRE, "trajet", "ajouter"), true);
    assert.equal(allows(ORG_ROLE.GESTIONNAIRE, "depart", "ajouter"), true);
    assert.equal(allows(ORG_ROLE.GESTIONNAIRE, "rapport_agence", "voir"), true);
    assert.equal(allows(ORG_ROLE.GESTIONNAIRE, "inscription", "ajouter"), false);
    assert.equal(allows(ORG_ROLE.GESTIONNAIRE, "inscription", "partager"), true);
  });

  it("owner : droits métier complets", () => {
    assert.equal(allows(ORG_ROLE.OWNER, "inscription", "ajouter"), true);
    assert.equal(allows(ORG_ROLE.OWNER, "inscription", "supprimer"), true);
    assert.equal(allows(ORG_ROLE.OWNER, "trajet", "ajouter"), true);
    assert.equal(allows(ORG_ROLE.OWNER, "rapport_agence", "voir"), true);
    assert.equal(allows(ORG_ROLE.OWNER, "equipe", "gerer"), true);
  });

  it("guichetier : pas de rapport_agence:voir ni trajet:ajouter", () => {
    assert.equal(allows(ORG_ROLE.GUICHETIER, "rapport_agence", "voir"), false);
    assert.equal(allows(ORG_ROLE.GUICHETIER, "trajet", "ajouter"), false);
    assert.equal(allows(ORG_ROLE.GUICHETIER, "equipe", "gerer"), false);
    assert.equal(allows(ORG_ROLE.GUICHETIER, "embarquement", "scanner"), true);
  });
});
