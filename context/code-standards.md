# Code Standards — Coccinelle

## General

- Prefer small modules with one responsibility.
- Fix root causes; do not paper over bugs with unrelated refactors.
- Do not mix unrelated concerns in one component or route (e.g. stay check-in + F&B menu CRUD).
- Match existing repo patterns before inventing new ones.
- Keep diffs focused on the active unit spec.

## TypeScript

- Use strict typing; avoid `any`.
- Validate external and form input with Zod at boundaries (server actions, search params).
- Prefer explicit return types on exported lib functions when it clarifies contracts.
- Use generated Prisma types from the project client path; do not hand-roll duplicate entity types.

## Next.js

- Default to Server Components; add `"use client"` only for interactivity.
- Put business logic in `lib/*`, not in fat page files.
- Mutations: server actions colocated near the feature or under `lib/hotel/*` — follow existing agence/reservation patterns.
- Protect staff hotel pages with `requireBranchContext`.
- Read Next.js docs under `node_modules/next/dist/docs/` when using unfamiliar App Router APIs (this app is Next 16).
- Do not introduce a parallel REST API for hotel if server actions suffice (same as voyage).

## Styling

- Use Tailwind utility classes and design tokens from `app/globals.css` / shadcn theme.
- Do not hardcode one-off brand colors when a token exists (`primary`, `muted`, `success`, `warning`, etc.).
- Follow `context/ui-context.md` for room-board status colors and layout conventions.
- Preserve Coccinelle orange primary; do not switch to generic purple/AI aesthetic themes.

## API / server actions

- Validate input with Zod first.
- Check session and permissions before mutations.
- Scope all hotel data by organization + branch.
- Return structured results (`{ ok, error }` or thrown errors consistent with nearby features); surface user-facing French messages via existing toast/UI patterns (Sonner).
- Never trust client-sent `organizationId` / `branchId` without verifying access.

## Data and storage

- Persist domain state in PostgreSQL via Prisma.
- Extend `HotelRoomType` / `HotelRoom` carefully; migrations must be reviewed in the unit that needs them.
- Do not store hotel stays inside voyage `Reservation` / `Paiement`.
- Seeds/bootstrap: hotel demo inventory already created in `lib/branch/bootstrap-branch.ts` for HOTEL branches — reuse when possible.

## File organization

| Path | Belongs here |
|------|----------------|
| `app/admin/.../hotel/` | Staff hotel pages |
| `app/[orgSlug]/` | Client PWA routes |
| `components/` | Shared UI; hotel-specific under `components/hotel/` when reused |
| `lib/hotel/` | Hotel domain (create as units need it) |
| `lib/branch/` | Branch shell only |
| `prisma/` | Schema, migrations, seed |
| `context/` | Six-file system + specs |
| `tests/` | Node test runner (`tsx --test`) for pure lib logic |

## Naming

- French for user-visible strings.
- English for code identifiers, matching existing codebase (`branchId`, `HotelRoom`, etc.).
- Hotel routes helpers live in `lib/branch/paths.ts` (`hotelRoutes`).
