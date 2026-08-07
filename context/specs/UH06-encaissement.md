# Unit UH06: Encaissement séjour / F&B

## Goal

Record payments (CASH / MOBILE_MONEY / CARTE) against a hotel stay folio or F&B order without requiring CashSession and without modifying voyage `Paiement`.

## Design

- Staff payment UI similar to guichet payment select (Espèces / Mobile Money / Carte).
- Online stub reuse pattern from `lib/reservation/payment-stub.ts` for guest flows when needed.
- Show paid vs balance on folio.

## Implementation

- New hotel payment table (e.g. `HotelPayment`) with `branchId`, `stayId` and/or `foodOrderId`, amount, method, status, reference.
- Do not alter `Paiement.reservationId` model.
- No CashSession model in this unit.

## Dependencies

- UH02, UH04.

## Verify when done

- [ ] Staff can mark folio balance paid in cash
- [ ] Voyage payments still work unchanged
- [ ] No CashSession requirement
- [ ] typecheck passes
