# R03 — CRUD rôles org + matrice éditable

| | |
|---|---|
| **Phase** | UI org |
| **Status** | `done` |
| **Dépend de** | R01, R02 |
| **Débloque** | R04, R05 |

---

## Objectif visible

La page `/admin/organizations/[organizationId]/roles` n’est plus lecture seule : on **crée**, **édite**, **duplique**, **supprime** des rôles custom et on coche les permissions FR (matrice). **`owner`** apparaît comme rôle système verrouillé.

## Inclus

1. Liste : Owner (badge système) + rôles custom (`listOrgRoles` / Prisma).
2. Créer rôle : nom/slug + presets (« partir de caissier… » / vide) → `createOrgRole`.
3. Éditeur matrice : sections Organisation / Agence / Hôtel / Boutique ; toggles `Ressource · Action`.
4. Modifier / supprimer custom → `updateOrgRole` / `deleteOrgRole` (**choix** : refuser si membres encore assignés — pas de reassign forcé ; message FR + bouton désactivé).
5. Gates : Contrôle d’accès · Voir / Ajouter / Modifier / Supprimer (`ac` / équivalent FR).
6. Owner : pas de delete, pas d’édition matrice, pas de rename.
7. Remplacer l’UI actuelle basée uniquement sur `organizationRoleStatements` hardcodés.

## Hors scope

- Hub branche (R04, R05)
- Enforcement métier hôtel (R06)

## Critères d’acceptation

1. Owner avec `ac` peut créer un rôle « Test » avec 2–3 permissions cochées. ✅ (dialog Créer + matrice)
2. Matrice sauvegardée → JSON `OrganizationRole.permission` cohérent. ✅ (`sanitizePermission` + BA/Prisma)
3. Impossible de supprimer / éditer `owner`. ✅ (UI verrouillée + actions refusent)
4. Membre sans Contrôle d’accès · Ajouter : pas de bouton créer (et action serveur refuse). ✅
5. Preset « Caissier » pré-coche les bonnes cases. ✅ (`ORG_ROLE_PRESET_PERMISSIONS.caissier`)
6. UI libellés 100 % FR. ✅ (`permissionLabelFr` / sections FR)

MCP Better Auth consulté : `createOrgRole` / `listOrgRoles` / `updateOrgRole` / `deleteOrgRole` + gates `ac`.

## Fichiers livrés

- `app/admin/organizations/[organizationId]/roles/page.tsx`
- `app/admin/organizations/[organizationId]/roles/actions.ts`
- `app/admin/organizations/[organizationId]/roles/roles-client.tsx`
- `app/admin/organizations/[organizationId]/roles/role-permission-matrix.tsx`
- `app/admin/organizations/[organizationId]/roles/schema.ts`
- `lib/org/permission-matrix-sections.ts`

## Skills & MCPs

| Type | À utiliser |
|------|------------|
| Skill | `organization-best-practices`, `shadcn`, `next-dev-loop` |
| MCP | `user-better-auth`, `project-0-coccinelle-shadcn` |
