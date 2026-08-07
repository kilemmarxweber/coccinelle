# Architecture — Coccinelle (focus Hôtel)

## Stack

| Layer | Technology | Role |
|-------|------------|------|
| App framework | Next.js 16 App Router | Pages, layouts, server actions, API auth handler |
| UI | React 19, Tailwind 4, shadcn/ui (Base UI) | Staff admin + PWA surfaces |
| Auth | Better Auth (admin + organization plugins) | Sessions, org members, access control |
| ORM / DB | Prisma 7 + PostgreSQL (`pg` adapter) | Tenancy, voyage, branch, hotel inventory |
| Validation | Zod 4 + react-hook-form | Forms and server action inputs |
| Email | nodemailer | Auth emails |
| Package manager | pnpm | Installs and scripts |

## System boundaries

| Area | Owns |
|------|------|
| `app/admin/…/branches/[branchId]/hotel/*` | Staff hotel UI (reception board, stays, F&B) |
| `app/[orgSlug]/…` | Public/client PWA (extend for hotel booking + self-order) |
| `app/api/auth/*` | Better Auth HTTP handler only |
| `lib/branch/*` | Branch paths, access, bootstrap, menus |
| `lib/hotel/*` | **Hotel domain logic** (create in hotel units; queries, stay, F&B, payments) |
| `lib/reservation/*` | Voyage booking only — do not overload for hotel stays |
| `lib/auth.ts`, `lib/permissions.ts` | Auth config and AC statements/roles |
| `lib/auth/*` | Permission helpers (`hasPermission`, etc.) |
| `prisma/schema.prisma` | Canonical data model |
| `context/*.md` + `context/specs/*` | Product/architecture/spec truth for agents |
| `context/units/`, `context/units-branches/` | Historical voyage/branch plans — hotel B10 is obsolete |

## Storage model

| Kind | Where |
|------|--------|
| Tenancy, members, branches, hotel rooms/types, stays, F&B, payments | PostgreSQL via Prisma |
| Uploads (if any) | `public/uploads/` (existing pattern) |
| Session | Better Auth session store (DB) |
| Cache | None required for hotel V1 |
| Generated Prisma client | `prisma/generated/prisma` |

## Auth and access model

- App roles: `admin` | `user` (`APP_ROLE`).
- Org roles (existing): `owner`, `gestionnaire`, `guichetier`, `parent` (client).
- Hotel staff operate inside a `Branch` with `type = HOTEL`.
- Every hotel query/mutation must scope by `organizationId` and `branchId`.
- Authorization via Better Auth access control + helpers — **never** `if (role === "…")` as sole gate.
- New hotel resources (e.g. `hotel_stay`, `hotel_fnb`) must be declared in `accessControlStatements` / org role matrices after consulting Better Auth MCP docs.
- `requireBranchContext({ requireModule: "hotel" })` guards hotel staff routes.
- Voyage `Paiement` stays linked to `Reservation` only. Hotel encaissement uses a separate branch-scoped model (introduced in UH06) — no forced merge in early units.

## Background / AI tasks

None for hotel V1. No long-running workers in request handlers.

## Invariants

1. Do not mix voyage reservation logic and hotel stay logic in the same module (`lib/reservation` stays voyage-only).
2. Every hotel read/write is filtered by `organizationId` and `branchId` of a `HOTEL` branch.
3. AuthZ for mutations goes through Better Auth permissions/helpers, not role-string checks alone.
4. Do not require an open CashSession to sell a stay or take an F&B order in V1.
5. Do not migrate or break existing voyage `Paiement` / guichet / PWA ticket flows while building hotel.
6. Do not treat `context/units-branches/B10-hotel-mvp.md` or hotel sections of the old branch dashboard plan as product truth — follow `context/project-overview.md` and `context/specs/UH*`.
7. UI copy for hotel is French; money display is CDF.
8. Room board must show status with **text labels** plus color (accessibility).
9. Guest food orders are guest-initiated; staff fulfills — staff-only order entry is not the primary path.
10. Implement only the active unit spec; do not anticipate later UH units beyond declared dependencies.
