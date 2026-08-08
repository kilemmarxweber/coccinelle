# Unit 06: Encaissement séjour / restauration

**File:** `units-06-encaissement.md` · **Track:** Admin  
**F&B** = restauration.

## Goal

Record payments (CASH / MOBILE_MONEY / CARTE) against a hotel stay folio or F&B order without requiring CashSession and without modifying voyage `Paiement`.

## Design

- Staff payment UI similar to guichet payment select (Espèces / Mobile Money / Carte).
- Online stub reuse pattern from `lib/reservation/payment-stub.ts` for guest flows when needed (units-07).
- Show paid vs balance on folio.

## Implementation

- New hotel payment table (e.g. `HotelPayment`) with `branchId`, `stayId` and/or `foodOrderId`, amount, method, status, reference.
- Do not alter `Paiement.reservationId` model.
- No CashSession model in this unit.

## Dependencies

- units-02, units-04.

## Verify when done

- [x] Staff can mark folio balance paid in cash
- [x] Voyage payments still work unchanged
- [x] No CashSession requirement
- [x] typecheck passes
