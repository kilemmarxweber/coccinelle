# U05 — Moteur de recherche de départs

| | |
|---|---|
| **Phase** | A — Fondations |
| **Status** | `done` |
| **Dépend de** | U01, U02 |
| **Débloque** | U06, U07, U13 |

---

## Objectif visible

Une **recherche** (ville départ, ville arrivée, date, mode) retourne une liste de départs avec **prix dès**, **places restantes**, **mode transport** — réutilisable guichet et PWA.

## Scope

### Inclus

- Module domaine `lib/search-departs` (ou équivalent) + Server Action
- Filtres : `villeDepart`, `villeArrivee`, `date`, `modeTransport?`, org scope
- Uniquement départs non annulés, futurs / du jour, avec places > 0 (ou flag inclus complets)
- Payload résultat stable pour les cartes UI
- Petite UI de smoke test (page trajets ou endpoint/action appelée depuis une page existante)

### Hors scope

- Design funnel final (U06)
- Routes PWA (U13)
- Drafts

## Critères d’acceptation (testables)

1. Recherche Kinshasa → Lubumbashi à une date connue retourne les départs seedés.
2. Filtre `AVION` exclut les bus.
3. Un départ complet n’apparaît pas (ou badge « Complet » selon règle choisie — documenter le choix).
4. Chaque résultat expose `prixBase` / « à partir de », `placesRestantes`, `modeTransport`, horaires.
5. Mauvaise org / slug → aucun leak cross-tenant.

## Skills & MCPs (obligatoire)

| Type | À utiliser |
|------|------------|
| Skill | `prisma-client-api` (filters, relations) |
| MCP | `user-Prisma` → filtres / where |
| Skill | `organization-best-practices` (scope org) |

## Fichiers impactés (indicatif)

- `lib/search-departs/*` (nouveau)
- Server action dédiée
- Éventuel appel depuis guichet trajet section (préparation U07)

## Comment tester

1. Appeler l’action avec critères connus (seed).
2. Vérifier JSON / UI : prix, places, mode.
3. Tester filtre mode + date sans résultat.

### Règle départs complets (choix U05)

Par défaut, les départs à **0 place restante sont exclus**.  
Flag `includeComplets: true` → ils apparaissent avec `complet: true` (badge « Complet » dans le smoke UI).

### Seed testable

- Kinshasa → Lubumbashi **BUS** : mercredi & samedi 07:00  
- Kinshasa → Lubumbashi **AVION** : vendredi 14:00  
- Script : `npx tsx scripts/smoke-search-departs.ts`  
- UI smoke : page Trajets → carte « Recherche départs »
