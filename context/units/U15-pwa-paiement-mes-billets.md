# U15 — PWA paiement, confirmation & mes billets

| | |
|---|---|
| **Phase** | D — Client en ligne |
| **Status** | `done` |
| **Dépend de** | U14, U08 |
| **Débloque** | — |

---

## Objectif visible

Le client **paye** (ou simule le prestataire selon décision métier), obtient une **confirmation** avec code + QR/PDF, et consulte **Mes réservations**.

## Scope

### Inclus

- Auth client **Better Auth** requise avant paiement (rôle org `parent` / compte client)
- Création réservation `source: EN_LIGNE` via domaine partagé après paiement OK ; session via `auth.api.getSession`
- Le client **n’utilise pas** `inscription:create` guichet ; parcours en ligne = session authentifiée + ownership client (et permissions member Better Auth si étendues en U04)
- Page confirmation `/[orgSlug]/confirmation/[code]`
- Réutilisation billet PDF/QR (U08)
- `/[orgSlug]/mes-reservations` + détail (filtrage par user session Better Auth)
- Si prestataire MM non choisi : **mode stub** clairement documenté (paiement mock → `PAYE`) avec TODO prestataire — unit quand même livrable et testable

### Hors scope

- Intégration production Mobile Money complète (peut être unit follow-up si stub)
- Report / annulation self-service avancé

## Critères d’acceptation (testables)

1. Checkout → auth Better Auth → paiement stub/réel → réservation en BDD `EN_LIGNE` + `CONFIRME`.
2. Confirmation affiche code `RES-*` + QR.
3. « Mes réservations » liste uniquement les réservations du user session Better Auth.
4. Draft consommé / invalidé après succès.
5. Sans session Better Auth, paiement inaccessible.
6. Un `parent` ne peut pas appeler les actions guichet (`hasPermission` inscription create → false).

## Skills & MCPs (obligatoire)

| Type | À utiliser |
|------|------------|
| Skill | `better-auth-best-practices`, `email-and-password-best-practices` / `create-auth` si pages auth client |
| Skill | `organization-best-practices` |
| Skill | `better-auth-security-best-practices` (paiement / session) |
| MCP | `user-better-auth` — session, org membership, permissions |
| Skill | `prisma-client-api` |
| Skill | `next-dev-loop` |

## Fichiers impactés (indicatif)

- Checkout paiement + confirmation
- `mes-reservations/**`
- Hook createReservation `EN_LIGNE`

## Comment tester

1. Parcours E2E anonyme → login → payer → confirmation → historique.
2. Autre user : ne voit pas la réservation.

## Paiement stub (livré)

- Mode : `stub` (`lib/reservation/payment-stub.ts`) — aucun prestataire MM branché.
- Action : `payAndConfirmOnlineCheckoutAction` → mock OK → `createReservationInDatabase({ source: "EN_LIGNE", paiementStatut: "PAYE" })` + référence `STUB-*`.
- UI checkout : alerte « Paiement démo (stub) » + bouton « Payer maintenant » (session requise).
- **TODO(prestataire)** : remplacer le stub par l’API Mobile Money (intent + webhook) avant prod.
