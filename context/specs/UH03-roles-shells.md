# Unit UH03: Shells rôles owner / gérant / réception

## Goal

Expose hotel operations with role-appropriate navigation and Better Auth permission gates so réception, gérant, and owner see the right actions (not identical blank shells).

## Design

- Réception: emphasize room board + séjours + encaissement entry points.
- Gérant: board + séjours + types/tarifs + light reports entry.
- Owner: supervisory read of KPIs / stays; full branch access as today for org owner.
- Declare `hotel_stay` / `hotel_room` (or equivalent) statements in `lib/permissions.ts` after Better Auth MCP consult; wire `hasPermission` on mutations.

## Implementation

- Extend permissions matrices for owner / gestionnaire (and a reception-equivalent org or branch role as decided — prefer existing `gestionnaire`/`guichetier` mapping documented in progress-tracker ADR if needed).
- Adjust `branch-menus.ts` labels/visibility if required.
- Gate UH01/UH02 mutations with permission helpers.

## Dependencies

- UH01, UH02.

## Verify when done

- [ ] Permission denied path for unauthorized mutation
- [ ] Owner and gérant can open hotel hub and board
- [ ] MCP/docs followed for new AC statements
- [ ] typecheck passes
