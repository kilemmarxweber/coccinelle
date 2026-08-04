# U10 — Dashboard gérant KPI

| | |
|---|---|
| **Phase** | C — Espace gérant |
| **Status** | `done` |
| **Dépend de** | U09, U02 |
| **Débloque** | — |

---

## Objectif visible

La page d’accueil gérant affiche des **KPI réels** (plus de mock) : réservations du jour, CA encaissé, remplissage, alertes simples.

## Scope

### Inclus

- Queries agrégées scopées org
- Cartes KPI : nb réservations jour, CA `PAYE` jour, places vendues / capacité départs du jour, colis en attente (si data)
- Liste « prochains départs » avec jauge remplissage (U02)
- Alertes : départ bientôt complet (&lt; 10 % places), paiements `EN_ATTENTE`

### Hors scope

- Exports Excel (U12)
- Graphiques complexes multi-semaines (basique semaine OK)

## Critères d’acceptation (testables)

1. Après une vente cash seed/guichet, le CA du jour augmente au refresh.
2. Jauge remplissage cohérente avec capacité − places restantes.
3. Aucune donnée d’une autre organisation.
4. Page mock précédente remplacée.

## Skills & MCPs (obligatoire)

| Type | À utiliser |
|------|------------|
| Skill | `prisma-client-api` (aggregations, groupBy) |
| MCP | `user-Prisma` |
| Skill | `shadcn` (Stat cards) |
| Skill | `next-dev-loop` |

## Fichiers impactés (indicatif)

- Page dashboard gérant
- `lib/reports/` ou actions dashboard
- Remplacement mock `agences/page.tsx` si encore utilisé

## Comment tester

1. Noter KPI → vendre 1 billet → refresh → KPI +1 / CA +.
2. Remplir un départ → alerte « bientôt complet ».
