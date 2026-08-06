# U16 — Embarquement QR

| | |
|---|---|
| **Phase** | E — Ops terrain |
| **Status** | `done` |
| **Dépend de** | U08, U04 |
| **Débloque** | — |

---

## Objectif visible

L’agent d’embarquement **scanne** (ou saisit) le QR passager : si réservation `CONFIRME` et bon départ → statut **`EMBARQUE`** ; sinon message d’erreur clair. Plus de page mock.

## Scope

### Inclus

- Accès gated par Better Auth : `hasPermission({ permissions: { embarquement: ["scan"] } })` — typiquement **`guichetier`** + `owner` (gérant optionnel)
- Page embarquement : sélection départ du jour + liste passagers
- Scan caméra PWA (`getUserMedia`) + saisie manuelle code
- Vérification token/code (format U08)
- Update statut passager/réservation selon règles métier documentées
- Pointage manuel si QR perdu

### Hors scope

- Hardware dédié
- Offline-first complet

## Critères d’acceptation (testables)

1. QR valide jour J / bon départ → `EMBARQUE` + feedback succès.
2. Mauvais départ / déjà embarqué / annulé → refus.
3. Liste passagers se met à jour (confirmé vs embarqué).
4. Session sans permission `embarquement:scan` (ex. `parent`) → accès refusé via Better Auth.
5. Page mock passages remplacée.

## Skills & MCPs (obligatoire)

| Type | À utiliser |
|------|------------|
| Skill | `shadcn` |
| Skill | `better-auth-best-practices`, `organization-best-practices` |
| MCP | `user-better-auth` — `hasPermission` / organization access control |
| Skill | `prisma-client-api` |
| Skill | `next-dev-loop` |

## Fichiers impactés (indicatif)

- `.../passages/**` ou `.../guichet/embarquement`
- Actions verify + update statut
- Consommation token U08

## Livré

- Domaine : `lib/reservation/boarding.ts` (+ parse QR U08)
- Schéma : `Passager.embarqueAt`
- Page : `/admin/organizations/[organizationId]/agences/passages` (scan caméra / saisie / pointage manuel)
- Gate : `embarquement:scan` via Better Auth
- Liens : dashboard agence + home guichet
