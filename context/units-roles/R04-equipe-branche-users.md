# R04 — Équipe par établissement (créer users + assigner rôle)

| | |
|---|---|
| **Phase** | UI branche |
| **Status** | `done` |
| **Dépend de** | R03 |
| **Débloque** | R06, R07 |

---

## Objectif visible

Depuis le **hub de chaque branche**, une entrée **Équipe / Personnel** permet de lister le staff de **cet** établissement, **créer un utilisateur**, lui **assigner un rôle** (owner ou custom de l’org), et le rattacher automatiquement à la branche.

## Inclus

1. Carte / route hub :  
   `/admin/organizations/[organizationId]/branches/[branchId]/equipe` (ou chemin cohérent avec `paths.ts`).
2. Liste : membres ayant un `BranchMember` ACTIVE sur cette branche.
3. Créer user : nom, email, téléphone, MDP généré + email credentials (réutiliser flux existant `createOrganizationMemberAction` / stash password).
4. Select rôle : customs de l’org (+ interdire assignation `owner` sauf admin plateforme / owner org selon règle produit — documenter).
5. Sync : `Member` + `BranchMember` sur **branche courante** uniquement (scope).
6. Modifier rôle / retirer de **cette** branche (pas forcément delete user org).
7. Gates : **Équipe · Voir** (liste), **Équipe · Gérer** (mutations). Actions depuis hub → scope **cette branche** uniquement.
8. Vue org `/members` : conserver pour vision globale multi-branches.

## Hors scope

- Création de rôles depuis la branche (R05)
- Rôle différent par branche (V1.1)

## Critères d’acceptation

1. Depuis Hôtel A : créer Marie + rôle Caissier → Marie listée sur Hôtel A, pas sur Hôtel B. ✅ (`BranchMember` scope branche courante)
2. Sans Équipe · Gérer : création refusée (UI + serveur). ✅ (`canManage` + `assertOrganizationPermission`)
3. Email / MDP temporaire envoyé (comportement existant). ✅ (`stashAdminCreatedUserPlainPassword` / flux createUser)
4. Changement de rôle depuis la branche met à jour `Member.role`. ✅ (`updateMemberRole`)
5. Retrait de la branche révoque / supprime `BranchMember` pour cette branche. ✅ (delete + pas de remove org)

## Règle produit — assignation `owner`

Interdite sauf **admin plateforme** (`user.role === admin`) ou **owner** de l’organisation. Documenté UI + refus serveur.

## Fichiers livrés

- `app/admin/organizations/.../branches/[branchId]/equipe/**`
- `lib/branch/paths.ts` (`sharedBranchRoutes.equipe`)
- `lib/branch/branch-menus.ts` + `DASH_CARD.EQUIPE`

## Skills & MCPs

| Type | À utiliser |
|------|------------|
| Skill | `organization-best-practices`, `better-auth-security-best-practices`, `shadcn`, `next-dev-loop` |
| MCP | `user-better-auth` |
