# Unit 08: Réservation de table (± nourriture) en ligne

**File:** `units-08-table-reservation.md` · **Track:** Client (+ Admin assist)  
**Réservation de table** = réserver une table à une **heure précise** (seule, ou **avec plats**).

## Goal

Guests can **en ligne**:
- reserve a restaurant table alone at a specific time, or
- reserve a table **with food** (pre-order dishes for that time).

Admin may also create a table reservation (e.g. phone). Sur-place dining orders without prior online booking still go through serveur → enregistrement (units-04) — this unit does not replace that.

## Design

- Funnel: date/time, party size, pick available table (or auto-assign), optional menu cart for “avec nourriture”.
- Responsive + GSAP; French; CDF for food lines.
- Creates table reservation record; if with food, creates linked `HotelFoodOrder` (or equivalent) for kitchen at the right time / status rules defined in implementation.
- Admin list/view of upcoming table reservations.

## Implementation

### Schema

- `HotelTableReservation` (branchId, tableId optional, guest fields, startsAt, covers, status, optional stayId/clientId).
- Link to food order lines when “avec nourriture”.

### Lib + UI

- `lib/hotel/table-*` queries/actions scoped to branch.
- Client routes under `/{orgSlug}/hotel/…`; Admin section under restauration or dedicated list.

## Dependencies

- units-04 (tables + menu). units-05 patterns for online food lines when “avec nourriture”.

## Verify when done

- [ ] Guest books table alone at a set time online
- [ ] Guest books table with food; kitchen/staff can see the food part
- [ ] Admin can list upcoming table reservations
- [ ] Sur-place path via serveur still described/unchanged (units-04)
- [ ] typecheck passes; voyage untouched
