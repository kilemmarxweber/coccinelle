# Unit UH05: Self-order client (chambre + restaurant)

## Goal

Guests place food orders themselves from an in-room or restaurant UI; orders appear on the UH04 staff queue and can be served.

## Design

- **Chambre:** guest authenticated / linked to IN_HOUSE stay → menu → cart → submit → folio charge pending.
- **Restaurant:** table/salle context (simple table code or QR param) → same menu → submit → restaurant ticket (or stay if linked).
- Large tap targets; French; CDF; confirmation screen with order status.
- Primary path is guest-initiated; staff does not type the order for the guest.

## Implementation

- PWA or branch-public routes under org slug / hotel order surfaces.
- Reuse menu from UH04; create `HotelFoodOrder` with source ROOM | RESTAURANT.
- Staff queue unchanged except new orders appear.

## Dependencies

- UH04; UH02 for room stay context.

## Verify when done

- [ ] Guest in-room can submit an order tied to stay
- [ ] Guest at restaurant can submit an order
- [ ] Staff sees order and can mark Servie
- [ ] typecheck passes
