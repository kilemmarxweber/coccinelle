# Unit UH07: PWA réservation chambre

## Goal

Guests book a hotel room online: availability search → draft → stub payment → confirmation → list under mes séjours (hotel).

## Design

- Funnel mirrors travel PWA (stepper, CDF prices early) but uses hotel stays/types, not `Reservation` / trajets.
- Org slug surface dedicated hotel paths (e.g. `/{orgSlug}/hotel/…`).
- Availability respects rooms not occupied/blocked for selected dates (uses UH01 inventory + UH02 stays).

## Implementation

- Draft model or reuse pattern analogous to `ReservationDraft` for hotel.
- Pay via stub → create stay BOOKED/paid per UH06 rules.
- Confirmation page with stay code.

## Dependencies

- UH01, UH02, UH06.

## Verify when done

- [ ] Guest completes booking for available type/dates
- [ ] Overlap with existing stay reduces availability correctly
- [ ] Confirmation + history visible
- [ ] Voyage PWA tickets unaffected
- [ ] typecheck passes
