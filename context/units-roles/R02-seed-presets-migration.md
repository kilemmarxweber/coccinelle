# R02 — Seed presets + migration OrganizationRole

| | |
|---|---|
| **Phase** | Fondations |
| **Status** | `done` |
| **Dépend de** | R01 |
| **Débloque** | R03, R04 |

---

## Objectif visible

À la création d’une org (et script pour orgs existantes), des **rôles custom seedés** existent dans `OrganizationRole` (caissier, serveur, etc.). Le membre **`owner`** reste le rôle Better Auth système — **pas** transformé en custom.

## Inclus

1. Templates de seed (presets, pas rôles runtime figés) :

   | Preset slug | Permissions (résumé) |
   |-------------|----------------------|
   | `caissier` | Caisse (toutes), Taux, Restauration, Cuisine, Séjours, Partenaires, Service stock, Rapport tableau + ventes |
   | `serveur` | Restauration + Rapport mes commandes |
   | `receptionniste` | Séjours, Chambres, Partenaires, Rapport tableau + séjours |
   | `gerant` | Hôtel sauf Caisse / Restauration / Cuisine / Rapport mes commandes |
   | `guichetier` | Inscription (+ Partager), Départ · Voir, Embarquement, Colis |
   | `client` | aucune (hors back-office) |

2. Hook / bootstrap à la création d’org : `createOrgRole` (ou insert Prisma aligné BA) pour chaque preset.
3. Script / seed one-shot pour orgs déjà en base : créer les `OrganizationRole` manquants ; **ne pas** toucher aux membres `owner`.
4. Migrer les anciens slugs membres (`gestionnaire`, `parent`, ops `BranchMember.role`) vers les presets custom équivalents quand pertinent.
5. `creatorRole` reste `"owner"` dans `lib/auth.ts`.

## Hors scope

- UI création rôle (R03)
- Assignation depuis branche (R04)

## Critères d’acceptation

1. Nouvelle org → lignes `OrganizationRole` pour les presets listés. ✅ (`afterCreateOrganization` → `seedOrganizationRolePresets`)
2. Membre créateur a toujours `Member.role = owner`. ✅ (`creatorRole: "owner"` inchangé)
3. Orgs existantes : script de migration idempotent (re-run safe). ✅ `npm run migrate:org-roles`
4. Preset `guichetier` : permissions agence sans hôtel (vérifiable via JSON permission). ✅ tests R02
5. Preset `caissier` : inclut `caisse.encaisser` et `caisse.ouvrir`. ✅ tests R02

MCP Better Auth consulté : `createOrgRole` / table `organizationRole` (`permission` JSON stringifié).

## Fichiers probables

- `prisma/seeds/*.ts` ou `lib/org/seed-org-roles.ts`
- Hook création org / `lib/auth.ts` organizationHooks
- `lib/org/role-presets.ts`

## Skills & MCPs

| Type | À utiliser |
|------|------------|
| Skill | `organization-best-practices`, `prisma-client-api` |
| MCP | `user-better-auth` — createOrgRole, organizationRole table |
