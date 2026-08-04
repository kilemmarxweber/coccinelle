# U01 — Mode transport BUS / AVION

| | |
|---|---|
| **Phase** | A — Fondations |
| **Status** | `done` |
| **Dépend de** | — |
| **Débloque** | U02, U05, U06, U13 |

---

## Objectif visible

Un trajet est clairement **Bus** ou **Avion** : badge dans l’UI trajets, filtre possible, données persistées.

## Scope

### Inclus

- Enum / champ `modeTransport` (`BUS` | `AVION`) sur `Trajet`
- Migration Prisma + mise à jour seeds
- Affichage badge (icône bus/avion) dans la liste / formulaire trajets
- Filtre optionnel « Bus / Avion / Tous » sur la page trajets

### Hors scope

- Capacité places (U02)
- Recherche publique client (U05 / U13)
- Sièges assignés

## Critères d’acceptation (testables)

1. Créer un trajet **Avion** et un trajet **Bus** via l’UI gérant/admin trajets existante.
2. Recharger la page : les badges / labels correspondent au mode enregistré.
3. Filtrer « Avion » n’affiche que les trajets avion.
4. Les seeds produisent au moins un trajet de chaque mode.
5. `prisma validate` OK ; app démarre sans erreur schéma.

## Skills & MCPs (obligatoire)

| Type | À utiliser |
|------|------------|
| Skill | `prisma-cli` (migrate / generate) |
| Skill | `prisma-client-api` (queries / types) |
| Skill | `shadcn` (Badge / Select si besoin) |
| MCP | `user-Prisma` → `search_prisma_documentation` pour enum + migrate |
| MCP | `project-0-coccinelle-shadcn` → composants Badge / Select |

## Fichiers impactés (indicatif)

- `prisma/schema.prisma`
- `prisma/seeds/trajet.seed.ts`
- `app/.../agences/trajets/**`
- Labels éventuels dans `lib/reservation/labels.ts`

## Comment tester

1. `npx prisma migrate dev` (ou workflow projet) + seed.
2. UI trajets : créer / éditer / filtrer.
3. Vérifier en BDD le champ `modeTransport`.
