# Progress Tracker

Update this file after every meaningful implementation change.

## Current Phase

- Module Hôtel — **phase séparation units 09–12** (après V1 métier 01–08 livré)

## Current Goal

- Phase séparation 09–12 livrée ; deferred hors plan (MM prod, CashSession)

## Completed

- [x] Six-file context (`project-overview`, `architecture`, `code-standards`, `ai-workflow-rules`, `ui-context`, `progress-tracker`)
- [x] `AGENTS.md` Application Building Context entry
- [x] Specs renommées en `context/specs/units-NN-feature.md` (00–08) + glossaire + rule en ligne vs sur place
- [x] B10 / hotel units-branches marked obsolete
- [x] **units-01** — Room board + inventaire (`…/hotel/chambres`) — re-verified 2026-08-08
  - Schema: `HotelRoomType` / `HotelRoom` / `HotelRoomStatus` (no Stay models)
  - `lib/hotel/room-status.ts`, `list-rooms-board.ts`, `room-actions.ts`
  - `components/hotel/hotel-room-board.tsx` + `hotel/chambres/page.tsx`
  - KPI strip, filters (étage/type/statut), status updates, create/update type & room
  - French labels + badge colors; prices in CDF; `requireBranchContext({ requireModule: "hotel" })`
- [x] **units-02** — Séjours staff (`…/hotel/sejours`) — 2026-08-08
  - Schema: `HotelStay` / `HotelFolioLine` + `HotelStayStatus` / `HotelFolioLineKind`
  - `lib/hotel/stay-status.ts`, `folio-nights.ts`, `list-stays.ts`, `stay-actions.ts`
  - Check-in → room `OCCUPIED`; check-out → room `CLEANING`; folio night lines in CDF
  - Admin UI list filters + create + detail; board shows guest name when IN_HOUSE
  - No Client booking UI; voyage untouched
- [x] **units-03** — Shells rôles Admin — 2026-08-08
  - AC: `hotel_room` / `hotel_stay` / `hotel_fnb` in `lib/permissions.ts` (Better Auth MCP)
  - Role `serveur` + matrices owner / gestionnaire / guichetier / serveur
  - Hub menus filtered via `resolveBranchMenuSections`; hotel hub no longer blank placeholder
  - Mutations units-01/02 gated with `assertHotelRoomPermission` / `assertHotelStayPermission`
  - UI action buttons gated by capability flags (inventory / status / stay create / check-in·out)
- [x] **units-04** — Carte + commande staff + file cuisine — 2026-08-08
  - Schema: `HotelMenuCategory` / `HotelMenuItem` / `HotelFoodOrder` / `HotelFoodOrderLine` / `HotelRestaurantTable`
  - Enums: `HotelFoodOrderStatus` (NEW→PREPARING→READY→SERVED), `HotelFoodOrderSource`, `HotelRestaurantTableStatus`
  - `lib/hotel/fnb-actions.ts`, `list-fnb.ts`, `food-order-status.ts`, `table-status.ts`
  - Admin `…/hotel/restauration`: tabs Carte / Commandes / Tables; staff sur-place orders; kitchen queue
  - Folio attachment (`OTHER`) when stay known; `hotel_fnb` gates; no Client online food
- [x] **units-05** — Commande nourriture client en ligne — 2026-08-08
  - Routes `/{orgSlug}/hotel` + `/commande` + confirmation ; GSAP funnel
  - Claim IN_HOUSE stay (tél. + chambre) → menu units-04 → cart → `CLIENT_ONLINE` order + folio
  - Kitchen queue unchanged (orders appear); no sur-place dining-room self-order
  - Deps: `gsap`, `@gsap/react`
- [x] **units-06** — Encaissement séjour / restauration — 2026-08-08
  - Schema: `HotelPayment` (`branchId`, `stayId` et/ou `foodOrderId`, amount, method, status, reference)
  - Réutilise `MethodePaiement` / `StatutPaiement` ; voyage `Paiement` inchangé ; pas de CashSession
  - `lib/hotel/payment-actions.ts`, `payment-method.ts`, `payment-stub.ts` (stub pour units-07)
  - Folio séjour : Total / Payé / Solde + encaissement staff (Espèces / MM / Carte)
  - Ticket F&B sans séjour : encaissement sur commande ; commandes liées séjour → folio
- [x] **units-07** — Réservation chambre client en ligne — 2026-08-08
  - Schema: `HotelStayDraft` + `HotelStay.codeUnique` / `userId`
  - Dispo dates (chambres ≠ OUT_OF_ORDER − séjours BOOKED/IN_HOUSE chevauchants)
  - Funnel `/{orgSlug}/hotel/recherche` → checkout draft → auth → stub pay → confirmation + mes séjours
  - Stay BOOKED + folio nuits + `HotelPayment` PAYE lié au user ; GSAP ; voyage PWA inchangé
- [x] **units-08** — Réservation table (± nourriture) en ligne — 2026-08-08
  - Schema: `HotelTableReservation` + `HotelTableReservationStatus` ; `HotelFoodOrder.tableReservationId`
  - `lib/hotel/table-availability.ts`, `table-reservation-status.ts`, `list-table-reservations.ts`, `table-reservation-actions.ts`
  - Client `/{orgSlug}/hotel/table` (± précommande) + confirmation ; GSAP ; CDF
  - Admin restauration onglet Réservations (liste à venir + création téléphone)
  - Sur-place serveur (units-04 Commandes) inchangé ; voyage untouched
- [x] Seed comptes test org — 2026-08-08 (superseded by units-09 seed)
  - Runner : `pnpm tsx prisma/scripts/seed-org-members.ts` · password `Password123!`
- [x] **units-09** — Rôles hôtel Better Auth — 2026-08-09
  - `ORG_ROLE` : `receptioniste` / `caissier` / `client` ; slug `parent` retiré
  - Matrices : réception ≠ caissier ; `guichetier` sans aucun `hotel_*`
  - Seed : `receptioniste@test.com`, `caissier@test.com`, `serveur@test.com` (+ owner/gérant/client) ; BranchMember HOTEL ; soft migrate `parent` → `client`
  - Labels / catalog / formulaires membres / post-login / ensure-client sync
  - Tests `lib/permissions.test.ts` ; password seed `Password123!`
- [x] **units-10** — Auth hôtel séparée — 2026-08-09
  - Routes `/{orgSlug}/hotel/connexion` + `/inscription` ; `HotelAuthShell` (pas Plane / Voyage)
  - `resolveHotelPostLoginPath` : callback `…/hotel/…` → staff `hotel_*` Admin hub → client mes séjours
  - Gates funnels hôtel (checkout, mes séjours, commande, confirmation) → connexion hôtel
  - Header public hôtel minimal (lien Connexion) ; `/auth/sign-in` Voyage inchangé
- [x] **units-11** — Shell Admin hôtel — 2026-08-09
  - Layout `…/hotel/layout.tsx` : `SidebarProvider` + `HotelAdminSidebar` + `HotelAdminHeader`
  - Nav filtrée : Accueil / Chambres / Séjours / Restauration / Caisse (`hotelRoutes` + permissions)
  - Header : trigger, nom branche, type HOTEL, theme, Branches, sign-out
  - Gate caisse HOTEL : `hotel_stay:update` (redirect accueil si refus)
  - Pas de `GerantSidebar` ; pages hub sans bouton retour redondant
- [x] **units-12** — Landing client hôtel + seed — 2026-08-09
  - Schema: `HotelRoomType.imageUrl` / `HotelMenuItem.imageUrl` + migration
  - `prisma/seeds/hotel.seed.ts` (idempotent) branché dans `prisma/seed.ts` — HOTEL + chambres/menu/tables + Unsplash
  - Landing `hotel-client-landing.tsx` : images chambres/plats, prix CDF, CTAs recherche / commande / table
  - Header Accueil / Mes séjours / Connexion ; chrome Voyage isolé dans `(voyage)` (pas sous `/hotel`)
  - GSAP entrée + stagger + `matchMedia` / `prefers-reduced-motion`

## In Progress

- None

## Next Up

- Deferred hors plan : production Mobile Money ; CashSession

## Open Questions

- Production Mobile Money provider: deferred (stub).
- CashSession mandatory mode: deferred (post-hotel V1).

## Architecture Decisions

- Ignore obsolete hotel plan in `context/units-branches` (B10); truth = Six-File + `context/specs/units-NN-*.md`.
- Spec filenames: `units-NN-feature.md` (not `UH*`).
- SaaS = **Admin** (personnel sous `/admin`) + **Public / Client** (landing `/` + `/{orgSlug}/…`, responsive + GSAP).
- Espace Public = route group `app/(public)/` — **jamais** confondre avec le dossier statique `public/` (assets).
- **En ligne:** client réserve chambre, table seule ou avec nourriture, ou nourriture s’il a une chambre.
- **Sur place restauration:** serveur → enregistrement Admin → chef (pas de self-order en salle).
- Keep `BranchType.HOTEL` shell; hotel domain in `lib/hotel/*`.
- Do not block hotel on CashSession / unified Payment; keep voyage `Paiement` intact.
- units-01 maps `AVAILABLE`=Libre·Prête, `CLEANING`=Libre·Sale, `OCCUPIED`, `OUT_OF_ORDER` (no schema migration).
- units-02: check-in requires room `AVAILABLE`; stays drive `OCCUPIED` / check-out → `CLEANING`.
- **units-07 auth gate (ADR):** confirmation d’une réservation chambre en ligne exige connexion ou création de compte Better Auth (pas de confirm anonyme). Recherche / draft peuvent rester publics. Les séjours multi-nuits sont toujours rattachés au compte ; V1 applique la même règle à toute confirmation chambre en ligne.
- **units-03 hotel role mapping (ADR historique — superseded by units-09):**
  - Ancien mapping : réception/caissier → `guichetier` ; client → `parent`.
- **units-09 hotel role mapping (ADR courant — livré) :**
  - Owner → `owner` — full `hotel_*` + rapports.
  - Gérant → `gestionnaire` — board + séjours + types/tarifs + F&B + `rapport:read`.
  - Réceptionniste → `receptioniste` — `hotel_room:read|update` + `hotel_stay:create|update|read`.
  - Caissier → `caissier` — `hotel_stay:read|update` + `hotel_room:read`.
  - Serveur → `serveur` — `hotel_fnb` only.
  - Client → `client` (plus de `parent`) — aucun droit hôtel Admin.
  - Guichetier → `guichetier` — **agence only**, aucun `hotel_*`.
  - Auth hôtel séparée (units-10) : `/{orgSlug}/hotel/connexion|inscription` ; pas `/auth/sign-in` Voyage pour les funnels hôtel.
- **units-12 landing (ADR):** chrome Voyage (`OrgBrandHeader` / Mes billets) uniquement sous route group `(voyage)` — jamais sous `/{orgSlug}/hotel/*` ; header hôtel = Accueil / Mes séjours / Connexion.
- **2026-08-09 séparation chrome (follow-up) :** hub branche HOTEL → redirect shell hôtel ; caisse sous `…/hotel/caisse` ; menus hub hôtel sans taux/rapports partagés voyage ; seed org `Coccinelle Demo` (plus « Mon Agence »).

## Session Notes

- 2026-08-08: fix hub branche RSC — menus avec icônes Lucide rendus serveur (`BranchMenuSections` via `children`), plus de passage de composants vers `BranchDashboard` client.
- 2026-08-08: fix création d’org — `beforeAddMember` exemptait mal l’admin plateforme de la règle « une seule org », ce qui bloquait la 2ᵉ création (`lib/auth.ts`).
- Theme default set to **light** (`app/layout.tsx`) for Admin / app shell.
- Voyage U01–U18 done; branch B01–B03/B05 done.
- units-01 uses existing `HotelRoomStatus` enum; stays drive OCCUPIED automatically in units-02.
- Pre-existing `tsc` errors unrelated to hotel: `agence/page.tsx` placeholder import path, `@types/nodemailer` missing.
- 2026-08-08: product plan revised (Admin/Client, en ligne vs sur place, table booking, glossary, rename specs).
- 2026-08-08: units-01 re-checked against spec — already shipped; no code changes required.
- 2026-08-08: units-02 shipped — Admin séjours end-to-end.
- 2026-08-08: units-03 shipped — role shells + hotel AC statements; MCP organization access-control followed.
- 2026-08-08: units-04 shipped — Admin restauration (carte, commande sur place, file cuisine, tables).
- 2026-08-08: units-05 shipped — Client room service en ligne (`/{orgSlug}/hotel/commande`), GSAP, folio charge.
- 2026-08-08: séparation Public/Admin — `app/(public)/` (landing `/` + `[orgSlug]`), Admin reste `/admin` ; URLs client inchangées.
- 2026-08-08: units-06 shipped — `HotelPayment` + encaissement folio / ticket F&B sans CashSession.
- 2026-08-08: units-07 prérequis produit — confirmation réservation chambre exige compte (connexion / inscription) ; ADR documenté.
- 2026-08-08: units-07 shipped — draft `HotelStayDraft`, auth gate, stub pay, confirmation + mes séjours.
- 2026-08-08: units-08 shipped — `HotelTableReservation`, client funnel table ± food, Admin réservations à venir.
- 2026-08-09: specs phase séparation — units-09 (rôles), 10 (auth), 11 (shell Admin), 12 (landing+seed) + build plan 00 mis à jour.
- 2026-08-09: units-09 shipped — rôles BA hôtel distincts ; guichetier strip `hotel_*` ; soft migrate `parent`→`client`.
- 2026-08-09: units-10 shipped — auth Client hôtel séparée ; redirects funnels ; header Connexion.
- 2026-08-09: units-11 shipped — shell Admin hôtel (sidebar + header) ; nav permission ; gate caisse HOTEL.
- 2026-08-09: units-12 shipped — landing images + seed hôtel + GSAP reduced-motion ; chrome Voyage override.
- 2026-08-09: follow-up plan — séparation chrome agence/voyage hors surfaces hôtel (layout `(voyage)`, shell Admin hôtel caisse, redirect hub HOTEL, strip menus partagés).
