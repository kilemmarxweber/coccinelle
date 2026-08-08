# Unit 01: Inventaire + room board réception

**File:** `units-01-room-board.md` · **Track:** Admin

## Goal

Replace the hotel **Chambres** placeholder with a real inventory manager and a day room board so reception can see which rooms are free vs occupied and which free rooms are ready, dirty, or out of order, with KPI counts that match the data.

## Design

- Route: `…/branches/[branchId]/hotel/chambres` (existing `hotelRoutes.chambres`).
- Layout: page title « Chambres », KPI strip, filters (étage, type, statut), then room grid grouped by floor.
- Each room tile: number, type name, **French text label** for status + colored badge (see `ui-context.md`).
- Secondary section or tabs: manage room types and rooms (create/edit).
- Empty state if no rooms: CTA to create a type / room (bootstrap data usually present).
- French copy; prices on types shown in CDF when editing types.

### Status model (this unit)

| Prisma value | Label FR | Board meaning |
|--------------|----------|---------------|
| `AVAILABLE` | Libre · Prête | Free and sellable |
| `CLEANING` | Libre · Sale | Free but not ready |
| `OCCUPIED` | Occupée | In use (manual for units-01; stays drive this in units-02) |
| `OUT_OF_ORDER` | Hors service | Not in inventory |

If schema already has these four values, reuse them; do not add Stay models in this unit.

## Implementation

### Schema

- Confirm `HotelRoomType` / `HotelRoom` / `HotelRoomStatus` in `prisma/schema.prisma`.
- No Stay / restauration (F&B) models in units-01.

### `lib/hotel/`

- `list-rooms-board.ts` — load types + rooms for `branchId`, compute KPIs.
- `room-status.ts` — label + badge helpers.
- `room-actions.ts` — update status; create/update type and room; scoped access + Zod.

### UI

- Replace `hotel/chambres/page.tsx` placeholder; client filters/forms as needed.
- Keep `requireBranchContext({ requireModule: "hotel" })`.

### Out of scope

- Stays, check-in, folio, F&B, Client PWA, payments, room×date calendar.

## Dependencies

- None new (existing Prisma, shadcn, branch helpers).

## Verify when done

- [x] `…/hotel/chambres` shows real rooms, not placeholder
- [x] KPI strip matches board
- [x] Status updates persist
- [x] Create type/room works
- [x] Wrong branch type still redirected
- [x] French text labels (not color alone)
- [x] No voyage reservation/payment changes

**Status:** `done` (2026-08-07)
