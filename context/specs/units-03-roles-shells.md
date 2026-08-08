# Unit 03: Shells rôles Admin

**File:** `units-03-roles-shells.md` · **Track:** Admin

## Goal

Expose hotel operations with role-appropriate navigation and Better Auth permission gates so réception, serveur, caissier, gérant, and owner see the right actions (not identical blank shells).

## Design

- **Réception:** room board + séjours + encaissement entry points.
- **Serveur / enregistrement:** restauration order entry + kitchen visibility as needed.
- **Gérant:** board + séjours + types/tarifs + light reports.
- **Owner:** supervisory KPIs / stays; full branch access as today for org owner.
- Declare `hotel_stay` / `hotel_room` / `hotel_fnb` (or equivalent) in `lib/permissions.ts` after Better Auth MCP consult; wire `hasPermission` on mutations.

## Implementation

- Extend permissions matrices; map to existing org roles where sensible (`gestionnaire` / `guichetier` / etc.) — document ADR in progress-tracker.
- Adjust `branch-menus.ts` labels/visibility if required.
- Gate units-01 / units-02 mutations with permission helpers.

## Dependencies

- units-01, units-02.

## Verify when done

- [ ] Permission denied path for unauthorized mutation
- [ ] Owner and gérant can open hotel hub and board
- [ ] MCP/docs followed for new AC statements
- [ ] typecheck passes
