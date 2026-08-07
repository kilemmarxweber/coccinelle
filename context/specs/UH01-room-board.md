# Unit UH01: Inventaire + room board réception

## Goal

Replace the hotel **Chambres** placeholder with a real inventory manager and a day room board so reception can see which rooms are free vs occupied and which free rooms are ready, dirty, or out of order, with KPI counts that match the data.

## Design

- Route: `…/branches/[branchId]/hotel/chambres` (existing `hotelRoutes.chambres`).
- Layout: page title « Chambres », KPI strip, filters (étage, type, statut), then room grid grouped by floor.
- Each room tile: number, type name, **French text label** for status + colored badge (see `ui-context.md`).
- Secondary section or tabs: manage room types and rooms (create/edit) without leaving the page or via simple dialogs.
- Empty state if no rooms: CTA to create a type / room (bootstrap data usually present).
- French copy; prices on types shown in CDF when editing types.

### Status model (this unit)

Extend / map `HotelRoomStatus` so reception can distinguish readiness:

| Prisma value | Label FR | Board meaning |
|--------------|----------|---------------|
| `AVAILABLE` | Libre · Prête | Free and sellable |
| `CLEANING` | Libre · Sale | Free but not ready |
| `OCCUPIED` | Occupée | In use (manual for UH01; stays will drive this in UH02) |
| `OUT_OF_ORDER` | Hors service | Not in inventory |

If schema already has these four values, reuse them; do not add Stay models in this unit.

## Implementation

### Schema

- Confirm `HotelRoomType` / `HotelRoom` / `HotelRoomStatus` in `prisma/schema.prisma`.
- No Stay/F&B models in UH01.
- Migration only if enum/docs need clarification — prefer zero migration if enums already match.

### `lib/hotel/`

- `list-rooms-board.ts` — load types + rooms for `branchId`, compute KPIs (`ready`, `dirty`, `occupied`, `outOfOrder`, `total`, `occupancyPercent`).
- `room-status.ts` — label + badge variant helpers.
- `room-actions.ts` (server actions) — update room status; create/update room type; create/update room; all scoped via session + `requireBranchContext` / branch access checks.
- Validate with Zod.

### UI

- Replace `hotel/chambres/page.tsx` placeholder with server page that loads board data.
- Client components as needed: filters, status change control, forms for type/room.
- Use shadcn Button, Badge, Select, Dialog/Sheet as appropriate.
- Keep `requireBranchContext({ requireModule: "hotel" })`.

### Out of scope for UH01

- Stays, check-in, folio, F&B, PWA, payments, room×date calendar (planning can wait for UH02 unless trivial stub — **do not** build calendar in UH01).

## Dependencies

- None new (use existing Prisma, shadcn, branch helpers).

## Verify when done

- [x] Opening `…/hotel/chambres` on a HOTEL branch shows real rooms (bootstrap or created), not `BranchModulePlaceholder`
- [x] KPI strip counts match rooms on the board
- [x] Changing a room status updates DB and UI (AVAILABLE / CLEANING / OCCUPIED / OUT_OF_ORDER)
- [x] Creating a room type and a room works and appears on the board
- [x] Wrong branch type (AGENCE) still redirects away from hotel module
- [x] Status tiles show French text labels, not color alone
- [x] Hotel files typecheck clean (repo has unrelated pre-existing tsc errors)
- [x] No changes to voyage reservation/payment code

**Status:** `done` (2026-08-07)
