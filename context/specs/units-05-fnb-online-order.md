# Unit 05: Commande nourriture client en ligne

**File:** `units-05-fnb-online-order.md` · **Track:** Client  
**En ligne** = espace client web (responsive + GSAP). Not sur-place self-order at the table.

## Goal

Guests order food **online** when they have a room/stay (room service). Orders appear on the units-04 kitchen queue. Optionally attach pre-ordered dishes to a table reservation created in units-08 (coordinate; do not block if units-08 not done — room-service path is the minimum).

## Design

- Guest authenticated / linked to an IN_HOUSE or valid stay → menu → cart → submit → folio charge.
- Responsive desk + mobile + tablet; French; CDF; confirmation with order status.
- **GSAP** for funnel / confirmation motion.
- Do **not** build “order on your phone instead of the serveur” for guests seated in the restaurant.

## Implementation

- Routes under `/{orgSlug}/hotel/…` (order surfaces).
- Reuse menu from units-04; create `HotelFoodOrder` with an online/room source.
- Staff queue unchanged except new orders appear.

## Dependencies

- units-04; units-02 for room stay context.

## Verify when done

- [ ] Guest with a stay can submit a room-service order online
- [ ] Staff/chef sees order and can mark Servie
- [ ] UI is usable on mobile and desktop
- [ ] typecheck passes
- [ ] No sur-place dining-room self-order UI shipped
