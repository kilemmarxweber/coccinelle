# U11 — Planning départs gérant

| | |
|---|---|
| **Phase** | C — Espace gérant |
| **Status** | `done` |
| **Dépend de** | U09, U02 |
| **Débloque** | — |

---

## Objectif visible

Le gérant gère le **planning** : voir les départs sur une période, fixer / éditer la **capacité**, **ouvrir / fermer / annuler** un départ.

## Scope

### Inclus

- Vue liste ou calendrier simple des `TrajetDepart`
- Actions : changer statut (`PLANIFIE` / `OUVERT` / `ANNULE`), éditer `capacitePlaces` — gated Better Auth `depart:update` / `depart:cancel` (U04) pour **`gestionnaire`** (gérant) et `owner`
- Création de départs — `trajet:create` / `depart:create` (gérant / owner)
- Indication mode transport (U01) et places restantes
- Member `guichetier` : lecture seule si `depart:read` sans update

### Hors scope

- Génération massive depuis `TrajetProgramme` (bonus si rapide)
- Embarquement
- Création d’organisation

## Critères d’acceptation (testables)

1. Annuler un départ → il disparaît des résultats de recherche U05.
2. Réduire capacité sous le nb déjà vendu → refus ou warning bloquant.
3. Ouvrir un départ `PLANIFIE` → réservable.
4. Édition capacité visible immédiatement sur jauge / recherche.
5. `guichetier` sans `depart:update` : action refusée via `hasPermission`.
6. `gestionnaire` peut ouvrir/fermer/éditer capacité.

## Skills & MCPs (obligatoire)

| Type | À utiliser |
|------|------------|
| Skill | `prisma-client-api`, `prisma-cli` si migration mineure |
| Skill | `shadcn` |
| Skill | `organization-best-practices`, `better-auth-best-practices` |
| MCP | `user-Prisma`, `project-0-coccinelle-shadcn`, `user-better-auth` |
| Skill | `next-dev-loop` |

## Fichiers impactés (indicatif)

- Pages planning gérant
- Actions trajets / départs existantes étendues

## Comment tester

1. Annuler → rechercher → 0 résultat.
2. Capacité invalide → erreur.
3. Ouvrir → vendre au guichet OK.
