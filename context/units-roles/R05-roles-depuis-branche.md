# R05 — Créer / éditer des rôles depuis la branche

| | |
|---|---|
| **Phase** | UI branche |
| **Status** | `done` |
| **Dépend de** | R03 |
| **Débloque** | R07 |

---

## Objectif visible

Depuis le hub branche (section Équipe / Rôles), on peut **créer et éditer** un rôle custom (matrice FR). Le rôle est stocké en **`OrganizationRole`** (partagé à toute l’org), pas isolé à la branche.

## Inclus

1. UI dans le contexte branche : liste des rôles org + créer / éditer (réutiliser composants matrice de R03).
2. APIs identiques à R03 (`createOrgRole` / `updateOrgRole` / `deleteOrgRole`).
3. Gates : Contrôle d’accès · Voir / Ajouter / Modifier / Supprimer.
4. Owner toujours verrouillé.
5. Après création d’un rôle depuis branche A, il apparaît dans la liste org et sur branche B.
6. Lien vers `/roles` org pour vue complète.

## Hors scope

- Rôles privés à une branche uniquement
- Gestion users (R04)

## Critères d’acceptation

1. Depuis Hôtel A : créer « Caissier nuit » avec permissions → visible aussi sur org `/roles` et Hôtel B. ✅ (même `listOrgRolesAction` / `OrganizationRole` org-wide)
2. Sans Contrôle d’accès · Ajouter : pas de création. ✅ (`capabilities.canCreate` + `assertOrganizationPermission` `ac:create`)
3. Impossible de supprimer `owner` depuis la branche. ✅ (UI `isSystem` + actions refusent)
4. Matrice FR identique à R03 (pas de second catalogue). ✅ (`RolePermissionMatrix` + `PERMISSION_MATRIX_SECTIONS`)

MCP Better Auth consulté : DAC `createOrgRole` / `updateOrgRole` / `deleteOrgRole` + gates `ac`.

## Fichiers livrés

- `app/admin/organizations/.../branches/[branchId]/equipe/roles/page.tsx`
- `app/admin/organizations/.../branches/[branchId]/equipe/equipe-section-nav.tsx`
- `app/admin/organizations/[organizationId]/roles/roles-client.tsx` (`branchContext`)
- `lib/branch/paths.ts` (`sharedBranchRoutes.equipeRoles`)
- `lib/branch/branch-menus.ts` (carte hub « Équipe / Rôles »)

## Skills & MCPs

| Type | À utiliser |
|------|------------|
| Skill | `organization-best-practices`, `shadcn` |
| MCP | `user-better-auth` |
