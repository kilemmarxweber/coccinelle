# Project Overview — Coccinelle (focus Hôtel)

## Glossaire

Toujours expliquer un acronyme à sa **première mention** dans un fichier, ou renvoyer ici.

| Terme | Signification |
|-------|----------------|
| **SaaS** | *Software as a Service* — logiciel en ligne multi-clients (plusieurs hôtels / organisations) sans installation locale. |
| **Admin** | Partie **personnel** : réception, caisse, serveur, enregistrement cuisine, chef, gérant, propriétaire. |
| **Client (espace)** | Partie **voyageur** : site web type app (*Progressive Web App*, **PWA**) sous `/{slugOrg}/…`. |
| **En ligne** | Le client utilise l’espace client depuis ordi / téléphone / tablette (présent ou distant). |
| **Sur place** | Le client est **physiquement à l’hôtel** (salle, bar, réception). |
| **F&B** | *Food & Beverage* — **restauration** (carte, commandes, tables, cuisine). |
| **GSAP** | Bibliothèque JavaScript d’**animations** pour l’UI de l’espace client hôtel. |
| **Responsive** | Mise en page adaptée au **bureau, tablette et mobile**. |
| **Folio** | Note / compte du séjour (nuits + extras restauration). |
| **Walk-in** | Client sans réservation préalable ; le personnel l’enregistre à l’arrivée. |
| **Room service** | Commande de nourriture liée à une **chambre / séjour**. |
| **Réservation de table** | Réserver une table à une **heure précise** (seule, ou **avec plats** précommandés). |
| **File cuisine** | File des commandes pour le **chef** (nouvelle → préparation → prête → servie). |
| **CDF** | Franc congolais (devise d’affichage). |
| **Org / branche** | Organisation (entreprise) / établissement (ex. un hôtel). |
| **units-NN** | Unité de construction du module hôtel ; specs dans `context/specs/units-NN-feature.md`. |

## Overview

Coccinelle is a multi-tenant **SaaS** for Congolese businesses (travel agencies, hotels, shops). The travel product is shipped. The current build is the **hotel module** on a `HOTEL` branch, with **two equal product surfaces**:

1. **Admin** — hotel staff tools (room board, stays, restauration, payments, role shells).
2. **Client** — online guest tools (book room, book table ± food, room-service food if they have a room), **responsive**, animated with **GSAP**.

Amounts are in **CDF**. UI language is French.

### En ligne vs sur place (restauration)

| Contexte | Règle |
|----------|--------|
| **En ligne** | Le client réserve chambre / table (seule ou avec nourriture à heure précise) / commande nourriture s’il a une chambre — self-service espace client. |
| **Sur place** | Pour manger à l’hôtel : le client commande **auprès des serveurs** → une personne **enregistre** dans l’Admin → le **chef** prépare. Pas de self-order en salle qui remplace le serveur. |

## Goals

1. Reception room board: free vs occupied, ready vs dirty vs out of order, day KPIs.
2. Admin stays: create, assign, check-in/out, folio nights (including walk-ins).
3. Role-appropriate Admin shells (réception, serveur, gérant, owner, etc.).
4. Restauration (**F&B**): menu, **staff order entry** (sur place), kitchen queue.
5. Client **en ligne**: room booking; table booking alone or with food; food if guest has a room; responsive + GSAP.
6. Hotel payments (cash / mobile money / card) without mandatory CashSession; voyage `Paiement` untouched.
7. Spec-driven delivery via Six-File + `context/specs/units-NN-*.md`.

## Core user flows

### A — Admin: room board

1. Staff opens a `HOTEL` branch → **Chambres**.
2. Sees occupancy + readiness labels (not color alone) and KPI strip.
3. Filters; updates housekeeping / HS status.

### B — Admin: stays

1. Creates or manages stays (walk-in or from client online booking).
2. Check-in only into Libre · Prête → room Occupée.
3. Check-out → Libre · Sale; folio nights in CDF.

### C — Client en ligne: chambre

1. Opens `/{orgSlug}/hotel/…`, searches dates/types, creates a draft.
2. **Must sign in or create an account** before confirming (especially multi-night stays; V1: required for every online room confirmation).
3. Stub pay → confirmation → mes séjours (tied to that account).

### D — Client en ligne: table ± nourriture

1. Reserves a restaurant table at a **specific time**, alone or **with pre-ordered food**.
2. If they already have a room/stay, can order **room service** food online.

### E — Sur place: restauration via serveurs

1. Guest asks the **serveur**.
2. Serveur / enregistreur saisit la commande in Admin.
3. Order appears on **file cuisine** for the chef; status advances to served.

### F — Manager / owner

1. Gérant: board, stays, F&B, light reports.
2. Owner: supervisory KPIs without day-to-day reception work.

## Features by category

### Hébergement

- Room types / rooms, board, stays, check-in/out, folio nights
- Client online room booking (**compte client requis** pour confirmer)

### Restauration (F&B)

- Menu / carte
- Staff order entry + kitchen queue (sur place)
- Online: table reservation (± food), room-service food if stay
- Link charges to folio or restaurant ticket

### Rôles & accès

- Réception, caissier, serveur, cuisine, gérant, propriétaire, client
- Better Auth + `organizationId` / `branchId` scope

### Encaissement hôtel

- Cash / mobile money / card on stay and F&B
- Independent of voyage `Paiement` and of mandatory CashSession for V1

## In scope

- Complete hotel ops on `BranchType.HOTEL`
- Admin + Client surfaces as above
- French UI, CDF, glossary discipline
- Specs `context/specs/units-NN-feature.md`

## Out of scope

- Rewriting shipped travel (U01–U18)
- Obsolete `context/units-branches/B10*` as product truth
- Mandatory CashSession / unified Payment migration before hotel works
- Boutique POS, OTA, spa, yield, multi-currency
- Production Mobile Money provider (stub until later)
- Guest self-order **in the dining room** replacing the serveur

## Success criteria

- Admin: live room board; stays check-in/out update room status; staff can register sur-place food orders for the chef.
- Client en ligne: book room; book table alone or with food; order food when they have a room; responsive + GSAP.
- Voyage guichet / PWA tickets / `Paiement` unchanged.
- Each hotel unit shipped from `context/specs/units-NN-*.md` with verify checklist before the next unit.
