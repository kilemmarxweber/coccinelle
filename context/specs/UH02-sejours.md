# Unit UH02: Séjours staff

## Goal

Introduce hotel stays so reception can create a reservation, assign a ready room, check in and check out, and see night charges on a simple folio; room board statuses update from stay lifecycle.

## Design

- Route: `…/hotel/sejours` (+ detail if needed).
- List: upcoming / in-house / checked-out filters.
- Stay form: guest identity (reuse Client patterns where sensible), dates, room type or room, price/night from type.
- Check-in only allowed if assigned room is `AVAILABLE` (Libre · Prête); then set room `OCCUPIED`.
- Check-out sets room to `CLEANING` (Libre · Sale) and closes stay.
- Folio: line items for nights (auto from dates × priceNight); no F&B yet.

## Implementation

### Schema

- Add `HotelStay` (branchId, roomId optional until check-in, roomTypeId, guest fields or clientId, checkInDate, checkOutDate, status, totals).
- Add `HotelFolioLine` (stayId, label, amount, kind NIGHT|OTHER).
- Enums for stay status: e.g. BOOKED | IN_HOUSE | CHECKED_OUT | CANCELLED.

### Lib + UI

- `lib/hotel/stays-*` actions and queries scoped to branch.
- Wire room status transitions on check-in/out.
- Replace séjours placeholder.

## Dependencies

- UH01 complete.

## Verify when done

- [ ] Create stay, check-in to ready room, board shows Occupée
- [ ] Check-out → room Libre · Sale; stay CHECKED_OUT
- [ ] Folio shows night lines in CDF
- [ ] Cannot check in to OUT_OF_ORDER or CLEANING without fixing status first
- [ ] typecheck passes; voyage untouched
