# Project Overview — Coccinelle (focus Hôtel)

## Overview

Coccinelle is a multi-tenant SaaS for Congolese businesses that run travel agencies, hotels, and shops under one organization. The travel (bus/air tickets, counter, PWA) product is already shipped. The current build focus is a complete **hotel module** on a typed `HOTEL` branch: reception room board (full / free / ready / dirty / out of order), stays with check-in/out, owner and manager oversight, and food ordering where the **guest places the order themselves** (in-room or at the restaurant) and staff serves it. Amounts are in CDF. UI language is French.

## Goals

1. Give reception a real-time view of which rooms are free vs occupied and which free rooms are ready to sell (PMS-style room board + day KPIs).
2. Let reception create stays, assign rooms, check guests in and out, and maintain a folio of night charges.
3. Give the branch manager (gérant) and organization owner distinct operational and supervisory views over the hotel branch.
4. Support a restaurant/room-service menu and a staff order queue (new → preparing → ready → served).
5. Let guests self-order food from the room or restaurant UI in front of staff; staff fulfills and serves.
6. Let guests book rooms online (PWA) with the same funnel patterns as travel (search → draft → pay stub → confirmation).
7. Record hotel payments (cash / mobile money / card) on stay/F&B documents without blocking on a unified CashSession or migrating voyage `Paiement`.
8. Keep voyage booking and `Paiement` (reservation-linked) unchanged while hotel is built.

## Core user flows

### A — Reception: room readiness and occupancy

1. Staff signs in and opens a `HOTEL` branch dashboard.
2. Opens **Chambres** (room board).
3. Sees every room with occupancy + housekeeping state and labels (not color alone).
4. Reads KPI strip: free-ready count, occupied, dirty, out-of-order, occupancy %.
5. Filters by floor / type / status; updates room physical status when cleaning finishes or a room goes HS.
6. Uses planning view (room × dates) to see upcoming full/empty nights (after stays exist).

### B — Reception: stay lifecycle

1. Creates a stay (walk-in or booked): guest, dates, room type or assigned room.
2. At arrival, checks in only into a free-ready room; room becomes occupied.
3. Folio accrues night charges; extras (F&B) attach later.
4. At departure, checks out; room becomes vacant-dirty (or equivalent); folio settled per payment unit.

### C — Guest: book a room (PWA)

1. Guest opens `/{orgSlug}/…` hotel booking surface.
2. Searches availability by dates and room type; sees prices in CDF.
3. Fills draft stay → authenticates if required → pays via stub (same pattern as travel online).
4. Sees confirmation and finds the stay under “mes séjours”.

### D — Guest: self-order food → staff serves

1. Guest is in-room (linked to active stay) or at the restaurant (table/salle context).
2. Opens the menu and places the order themselves on phone/tablet in front of staff.
3. Order appears on the staff queue (cuisine/service).
4. Staff marks preparing → ready → served; charges go to stay folio (room) or restaurant ticket.

### E — Manager / owner

1. Gérant opens hotel branch: board, stays, F&B, reports (occupation, CA).
2. Owner supervises org-level and branch hotel metrics without doing day-to-day reception tasks.

## Features by category

### Hébergement

- Room types and physical room inventory per branch
- Room board (day grid) + occupancy planning
- Housekeeping / readiness states
- Stays, assignment, check-in / check-out
- Folio (nights + extras)

### Restauration (F&B)

- Menu / carte per hotel branch
- Staff order queue
- Guest self-order: in-room and restaurant
- Link orders to stay folio or restaurant ticket

### Rôles & accès

- Réception, gérant, propriétaire (owner), cuisine/service, client
- Better Auth organization permissions + branch scope (`organizationId` + `branchId`)

### Client en ligne

- PWA room booking
- Self-order surfaces
- Payment stub for online hotel charges (reuse travel stub pattern)

### Encaissement hôtel

- Cash / mobile money / card on stay and F&B
- Independent of voyage `Paiement` and of mandatory CashSession for V1

## In scope

- Complete hotel ops on `BranchType.HOTEL` under existing org/branch shell
- Room board UX (occupation + readiness) for reception
- Stays + folio nights
- Distinct reception / gérant / owner usage
- F&B menu, staff queue, guest self-order (room + restaurant)
- Hotel payment recording without CashSession hard gate
- PWA guest room booking
- Spec-driven build via `context/` Six-File system + `context/specs/UH*`
- French UI, CDF amounts

## Out of scope

- Replacing or rewriting the shipped travel product (U01–U18)
- Following obsolete hotel plan in `context/units-branches` (B10 and hotel dashboard contracts as product truth)
- Mandatory CashSession / unified Payment migration (ex-B08/B09) before hotel works
- Boutique POS as part of this hotel build
- OTA / channel managers (Booking.com, etc.)
- Spa, yield management, complex multi-currency
- Production Mobile Money provider integration (stub only until a later unit)
- Full housekeeping mobile app beyond status updates on the board
- E-commerce public shop for the hotel gift store

## Success criteria

- Reception can open a HOTEL branch and see a live room board: each room shows free vs occupied and ready vs dirty vs HS, with KPI counts that match the data.
- Reception can create a stay, check in to a ready room, check out, and see the room status update accordingly.
- Gérant and owner can reach hotel ops views appropriate to their role (no blank placeholders for in-scope screens once their units ship).
- A guest can place a food order from room or restaurant UI; staff sees it on the queue and can mark it served.
- A guest can complete an online room booking draft → stub payment → confirmation for a HOTEL branch’s org slug surface.
- Hotel payments can be recorded on folio/F&B without requiring an open CashSession.
- Voyage guichet/PWA/`Paiement` still work unchanged after hotel units.
- Every hotel unit is implemented from a `context/specs/UH*.md` with verification checklist checked before moving on.
