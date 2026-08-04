# U17 — Gestion colis réelle

| | |
|---|---|
| **Phase** | E — Ops terrain |
| **Status** | `todo` |
| **Dépend de** | U03 |
| **Débloque** | — |

---

## Objectif visible

La page **colis** affiche les vrais colis Prisma ; l’agent fait évoluer les statuts `EN_ATTENTE` → `EXPEDIE` → `LIVRE` avec le destinataire visible.

## Scope

### Inclus

- Remplacer mock `colis/page.tsx` par liste filtrable (départ, statut)
- Actions changement statut + garde-fous — permission Better Auth alignée sur `inscription:update` ou statement dédié si ajouté en U04
- Affichage destinataire (U03) + code colis
- Lien depuis réservation associée
- Accès liste / statuts : `owner` + `guichetier` (+ `gestionnaire` si grille U04 le prévoit) via `hasPermission` ; `parent` refusé

### Hors scope

- Tracking public client
- Tarification colis (déjà existante)

## Critères d’acceptation (testables)

1. Colis créé au guichet apparaît dans la liste.
2. Passage `EN_ATTENTE` → `EXPEDIE` → `LIVRE` possible et persisté.
3. Filtres statut fonctionnent.
4. Plus aucun contenu mock / fake data sur la page.
5. Session `parent` : accès liste colis agence refusé (Better Auth).

## Skills & MCPs (obligatoire)

| Type | À utiliser |
|------|------------|
| Skill | `prisma-client-api` |
| Skill | `shadcn` |
| Skill | `organization-best-practices`, `better-auth-best-practices` |
| MCP | `user-Prisma`, `project-0-coccinelle-shadcn`, `user-better-auth` |
| Skill | `next-dev-loop` |

## Fichiers impactés (indicatif)

- `app/.../colis/**`
- Actions colis
- Seeds si besoin

## Comment tester

1. Créer réservation + colis → page colis.
2. Changer statuts → refresh OK.
3. Vérifier destinataire affiché.
