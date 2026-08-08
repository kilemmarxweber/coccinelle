# Unit 04: Carte + prise de commande staff + file cuisine

**File:** `units-04-fnb-menu-queue.md` · **Track:** Admin  
**F&B** = *Food & Beverage* (restauration).

## Goal

Staff can manage the restaurant menu, **register orders for guests who are sur place** (serveur → enregistrement), and advance the kitchen queue (nouvelle → en préparation → prête → servie) on `…/hotel/restauration`. Prepare **table inventory** for units-08.

This is the **sur place** food path. Client online food is units-05 / units-08 — not a dining-room self-order UI.

## Design

- Panels/tabs: **Carte** (categories + items, price CDF), **Commandes** (queue), optionally **Tables** CRUD (number, capacity, status).
- Staff can **create real orders** (not “test only”) linked to stay folio and/or table when known.
- Queue cards with one primary status action each for the chef/service.

## Implementation

### Schema

- `HotelMenuCategory`, `HotelMenuItem`, `HotelFoodOrder`, `HotelFoodOrderLine` + status enum.
- Table model (e.g. `HotelRestaurantTable`) scoped by `branchId` — enough for units-08.
- Order source distinguishing staff sur-place vs later online sources.

### UI

- Replace restauration placeholder.
- CRUD menu; staff order entry; kitchen queue.

## Dependencies

- units-01 (branch). units-02 recommended for folio attachment.

## Verify when done

- [ ] Create menu item; appears on carte
- [ ] Staff can register an order; chef can advance through all statuses
- [ ] Table inventory can be created/listed (minimal)
- [ ] typecheck passes
