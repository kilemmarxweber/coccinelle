# Progress Tracker

Update this file after every meaningful implementation change.

## Current Phase

- Module Hôtel — UH01 livré ; suite UH02

## Current Goal

- UH02 — Séjours staff (réservation, check-in/out, folio nuits)

## Completed

- [x] Six-file context (`project-overview`, `architecture`, `code-standards`, `ai-workflow-rules`, `ui-context`, `progress-tracker`)
- [x] `AGENTS.md` Application Building Context entry
- [x] `context/specs/00-build-plan.md` + UH01–UH07 specs
- [x] B10 / hotel units-branches marked obsolete
- [x] **UH01** — Room board + inventaire (`…/hotel/chambres`)
  - `lib/hotel/room-status.ts`, `list-rooms-board.ts`, `room-actions.ts`
  - `components/hotel/hotel-room-board.tsx`
  - KPI strip, filters, status updates, create/update type & room

## In Progress

- None

## Next Up

- UH02 — Séjours staff
- UH03 — Shells rôles
- UH04 — Carte + file F&B
- UH05 — Self-order client
- UH06 — Encaissement hôtel
- UH07 — PWA réservation chambre

## Open Questions

- Production Mobile Money provider: deferred (stub).
- CashSession mandatory mode: deferred (post-hotel V1).

## Architecture Decisions

- Ignore obsolete hotel plan in `context/units-branches` (B10); truth = Six-File + `context/specs/UH*`.
- Keep `BranchType.HOTEL` shell; hotel domain in `lib/hotel/*`.
- Do not block hotel on CashSession / unified Payment; keep voyage `Paiement` intact.
- Guest F&B is self-order (room + restaurant); staff fulfills.
- UH01 maps `AVAILABLE`=Libre·Prête, `CLEANING`=Libre·Sale, `OCCUPIED`, `OUT_OF_ORDER` (no schema migration).

## Session Notes

- Voyage U01–U18 done; branch B01–B03/B05 done.
- UH01 uses existing `HotelRoomStatus` enum; stays will drive OCCUPIED automatically in UH02.
- Pre-existing `tsc` errors unrelated to hotel: `agence/page.tsx` placeholder import path, `@types/nodemailer` missing.
