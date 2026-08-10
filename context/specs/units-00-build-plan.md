# Build Plan — Module Hôtel

Ordered units for the hotel module. Source: `context/project-overview.md`.

**Naming:** each unit lives at `context/specs/units-NN-feature.md`.

**Rules:** one visible result per unit · dependencies just-in-time · voyage `Paiement` untouched · no CashSession hard gate · obsolete B10 ignored · explain acronyms · **en ligne** = client self-service · **sur place** restauration = serveur → enregistrement Admin → chef · **phase 09–12 = focus hôtel only** (ne pas refondre agence/boutique).

## Two tracks

| Track | Units | Surface |
|-------|-------|---------|
| **Admin** (personnel) | 01–04, 06, 03, 09, 11, parts of 08 | `app/admin/.../hotel/*` |
| **Client** (en ligne) | 05, 07, 08, 10, 12 | `app/(public)/[orgSlug]/hotel/…` → URLs `/{orgSlug}/hotel/…` — responsive + GSAP |

### Phase V1 métier (livré)

| # | Spec file | Builds | Depends on | Visible when done |
|---|-----------|--------|------------|-------------------|
| 01 | [units-01-room-board.md](./units-01-room-board.md) | Room inventory CRUD + day room board + KPIs + status updates | Branch HOTEL shell | Réception sees full/free/ready/dirty/HS board |
| 02 | [units-02-sejours.md](./units-02-sejours.md) | Stay model, assign room, check-in/out, folio nights | units-01 | Séjours staff flow works end-to-end |
| 03 | [units-03-roles-shells.md](./units-03-roles-shells.md) | Première passe shells / `hotel_*` (superseded mapping by units-09) | units-01, units-02 | Role-appropriate Admin shells (v1) |
| 04 | [units-04-fnb-menu-queue.md](./units-04-fnb-menu-queue.md) | Menu CRUD + **staff order entry** (sur place) + kitchen queue + table inventory prep | units-01, units-02 recommended | Serveur/enregistreur + chef queue work |
| 05 | [units-05-fnb-online-order.md](./units-05-fnb-online-order.md) | Client **en ligne** food (room service if stay; plats tied to table booking when units-08 exists) | units-04, units-02 | Guest orders food online; kitchen sees it |
| 06 | [units-06-encaissement.md](./units-06-encaissement.md) | Hotel payments on folio/F&B (CASH/MM/CARTE) | units-02, units-04 | Staff can settle folio without CashSession |
| 07 | [units-07-room-booking.md](./units-07-room-booking.md) | Client **en ligne** room search → draft → **auth** → stub pay → confirmation | units-01, units-02, units-06 | Guest books room online with account (responsive + GSAP) |
| 08 | [units-08-table-reservation.md](./units-08-table-reservation.md) | Table at a set time: alone **or with food**; Client en ligne (+ Admin if needed) | units-04, units-05 for food lines | Guest books table ± food online |

### Phase séparation hôtel (à exécuter — units 09–12)

| # | Spec file | Builds | Depends on | Visible when done |
|---|-----------|--------|------------|-------------------|
| 09 | [units-09-hotel-roles.md](./units-09-hotel-roles.md) | Rôles BA hôtel : `receptioniste`, `caissier`, `client` ; `guichetier` sans `hotel_*` | units-03 | Matrices + seeds comptes hôtel distincts de l’agence |
| 10 | [units-10-hotel-auth.md](./units-10-hotel-auth.md) | Connexion / inscription sous `/{orgSlug}/hotel/…` + redirects hôtel | units-09 | Login hôtel séparé du Voyage |
| 11 | [units-11-hotel-admin-shell.md](./units-11-hotel-admin-shell.md) | Sidebar + header Admin sur `…/hotel/*` | units-09 | App staff hôtel navigable |
| 12 | [units-12-hotel-landing-seed.md](./units-12-hotel-landing-seed.md) | Landing images chambres/nourriture + seed + GSAP + header public hôtel | units-10, units-01, units-04 | Landing demo visuelle seedée |

```mermaid
flowchart TD
  u01[units01] --> u02[units02] --> u03[units03]
  u01 --> u04[units04]
  u02 --> u04
  u04 --> u05[units05]
  u02 --> u05
  u02 --> u06[units06]
  u04 --> u06
  u01 --> u07[units07]
  u02 --> u07
  u06 --> u07
  u04 --> u08[units08]
  u05 --> u08
  u03 --> u09[units09]
  u09 --> u10[units10]
  u09 --> u11[units11]
  u10 --> u12[units12]
  u01 --> u12
  u04 --> u12
```

## Explicitly deferred (not in this plan)

- CashSession open/close (ex-B08)
- Unified Payment migration with voyage (ex-B09)
- Boutique module
- OTA / channel manager
- Production Mobile Money provider
- Dining-room guest self-order replacing the serveur
- Refonte agence / guichet / `/auth/sign-in` Voyage (hors phase 09–12)
