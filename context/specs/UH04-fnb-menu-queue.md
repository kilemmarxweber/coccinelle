# Unit UH04: Carte + file F&B staff

## Goal

Staff can manage a hotel restaurant menu and process an order queue (nouvelle → en préparation → prête → servie) on `…/hotel/restauration`.

## Design

- Two panels or tabs: **Carte** (categories + items, price CDF) and **Commandes** (queue).
- Queue cards with one primary status action each.
- Optional link to stay folio when `stayId` present (room service prep for UH05).

## Implementation

### Schema

- `HotelMenuCategory`, `HotelMenuItem`, `HotelFoodOrder`, `HotelFoodOrderLine` + status enum.
- Scoped by `branchId`.

### UI

- Replace restauration placeholder.
- CRUD menu; create test order from staff UI (guest self-order is UH05).

## Dependencies

- UH01 (branch). UH02 recommended for folio attachment.

## Verify when done

- [ ] Create menu item; appears on carte
- [ ] Advance order through all statuses
- [ ] typecheck passes
