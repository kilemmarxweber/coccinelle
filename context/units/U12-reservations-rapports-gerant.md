# U12 — Réservations & rapports gérant

| | |
|---|---|
| **Phase** | C — Espace gérant |
| **Status** | `done` |
| **Dépend de** | U09 |
| **Débloque** | — |

---

## Objectif visible

Le gérant consulte **toutes** les réservations avec filtres (statut, source, date, paiement) et un **rapport CA** simple (par jour / mode paiement).

## Scope

### Inclus

- Liste filtrable réservations (org scope)
- Filtres : statut, `GUICHET` | `EN_LIGNE`, plage dates, statut paiement
- Lien vers fiche détail
- Page rapports V1 : CA période + répartition CASH / MOBILE / CARTE
- Export CSV minimal (optionnel mais recommandé)

### Hors scope

- Actions exceptionnelles complexes (report/pénalité UI complète)
- BI avancé

## Critères d’acceptation (testables)

1. Filtre `EN_LIGNE` n’affiche pas les ventes guichet (et inversement).
2. CA période = somme paiements `PAYE` de la période (vérif seed).
3. Member `guichetier` : `hasPermission({ permissions: { rapport: ["read"] } })` échoue → page rapports inaccessible.
4. Member `gestionnaire` (gérant) : accès rapports OK.
5. Click ligne → détail réservation.
6. Gates serveur passent par Better Auth, pas un if sur le rôle seul.

## Skills & MCPs (obligatoire)

| Type | À utiliser |
|------|------------|
| Skill | `prisma-client-api` |
| Skill | `shadcn` (Table, Select) |
| MCP | `user-Prisma`, `project-0-coccinelle-shadcn` |
| Skill | `organization-best-practices`, `better-auth-best-practices` |
| MCP | `user-better-auth` |

## Fichiers impactés (indicatif)

- Pages gérant réservations / rapports
- Actions list/filter + aggregations

## Comment tester

1. Créer 2 réservations sources différentes → filtres.
2. Comparer CA affiché vs somme manuelle.

## Livré

- Liste : `/agence/[orgId]/gerant/reservations` (filtres URL + Table + export CSV)
- Détail : `/agence/[orgId]/gerant/reservations/[reservationId]`
- Rapports CA : `/agence/[orgId]/gerant/rapports` (`rapport:read` via Better Auth)
- Seeds : `RES-0` GUICHET/CASH, `RES-1` EN_LIGNE/MOBILE_MONEY
