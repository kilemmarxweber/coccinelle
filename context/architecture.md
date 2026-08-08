# Architecture — Coccinelle (focus Hôtel)

## Stack

| Layer | Technology | Role |
|-------|------------|------|
| App framework | Next.js 16 App Router | Pages, layouts, server actions, API auth handler |
| UI | React 19, Tailwind 4, shadcn/ui (Base UI) | Admin staff + Client (PWA) surfaces |
| Motion (client hôtel) | **GSAP** (*GreenSock Animation Platform*) | Animations on hotel **Client** surfaces only |
| Auth | Better Auth (admin + organization plugins) | Sessions, org members, access control |
| ORM / DB | Prisma 7 + PostgreSQL (`pg` adapter) | Tenancy, voyage, branch, hotel domain |
| Validation | Zod 4 + react-hook-form | Forms and server action inputs |
| Email | nodemailer | Auth emails |
| Package manager | pnpm | Installs and scripts |

## System boundaries

| Area | Owns |
|------|------|
| `app/(public)/` | **Espace Public** (route group) — landing `/` + client ; le groupe n’apparaît pas dans l’URL |
| `app/(public)/page.tsx` | Landing produit Coccinelle (`/`) — pas d’auth staff obligatoire |
| `app/(public)/[orgSlug]/…` | **Client** PWA multi-tenant (`/{orgSlug}/…` voyage + hôtel) |
| `app/(public)/[orgSlug]/hotel/…` | **Client hôtel** — room service (units-05), room booking (units-07), table ± food (units-08) |
| `app/admin/…` | **Espace Admin** — staff ; auth session dans `admin/layout.tsx` |
| `app/admin/…/branches/[branchId]/hotel/*` | **Admin** hôtel (board, stays, restauration, payments) |
| `lib/branch/paths.ts` | Admin `hotelRoutes` + Client `clientHotelRoutes` |
| `app/api/auth/*` | Better Auth HTTP handler only |
| `lib/branch/*` | Branch paths, access, bootstrap, menus |
| `lib/hotel/*` | Hotel domain (rooms, stays, drafts, F&B, tables, table reservations, payments, client booking) |
| `lib/reservation/*` | Voyage booking only — do not overload for hotel stays |
| `lib/auth.ts`, `lib/permissions.ts` | Auth config and AC statements/roles |
| `lib/auth/*` | Permission helpers (`hasPermission`, etc.) |
| `prisma/schema.prisma` | Canonical data model |
| `context/*.md` + `context/specs/units-NN-*.md` | Product/architecture/spec truth for agents |
| `context/units/`, `context/units-branches/` | Historical voyage/branch plans — hotel B10 is obsolete |
| `public/` (racine) | Assets statiques / uploads — **ne pas** confondre avec l’espace Public `(public)` |

## Storage model

| Kind | Where |
|------|--------|
| Tenancy, members, branches, hotel rooms/types, stays + folio lines, F&B, tables, payments, hotel stay drafts | PostgreSQL via Prisma |
| Uploads (if any) | `public/uploads/` (existing pattern) |
| Session | Better Auth session store (DB) |
| Cache | None required for hotel V1 |
| Generated Prisma client | `prisma/generated/prisma` |

## Auth and access model

- App roles: `admin` | `user` (`APP_ROLE`).
- Org roles: `owner`, `gestionnaire`, `guichetier`, `serveur` (hôtel F&B), `parent` (client).
- Hotel staff operate inside a `Branch` with `type = HOTEL`.
- Every hotel query/mutation must scope by `organizationId` and `branchId`.
- Authorization via Better Auth access control + helpers — **never** `if (role === "…")` as sole gate.
- New hotel resources (e.g. `hotel_stay`, `hotel_fnb`) must be declared in `accessControlStatements` / org role matrices after consulting Better Auth MCP docs.
- `requireBranchContext({ requireModule: "hotel" })` guards hotel staff routes.
- Voyage `Paiement` stays linked to `Reservation` only. Hotel encaissement uses a separate branch-scoped model (introduced in units-06) — no forced merge in early units.

## Background / AI tasks

None for hotel V1. No long-running workers in request handlers.

## Invariants

1. Do not mix voyage reservation logic and hotel stay logic in the same module (`lib/reservation` stays voyage-only).
2. Every hotel read/write is filtered by `organizationId` and `branchId` of a `HOTEL` branch.
3. AuthZ for mutations goes through Better Auth permissions/helpers, not role-string checks alone.
4. Do not require an open CashSession to sell a stay or take an F&B order in V1.
5. Do not migrate or break existing voyage `Paiement` / guichet / PWA ticket flows while building hotel.
6. Do not treat `context/units-branches/B10-hotel-mvp.md` as product truth — follow `context/project-overview.md` and `context/specs/units-NN-*.md`.
7. UI copy for hotel is French; money display is CDF. Explain acronyms (see project-overview glossaire).
8. Room board must show status with **text labels** plus color (accessibility).
9. **Restauration channels:** **en ligne** = client self-service (room booking, table ± food, room service if stay). **Sur place** = guest orders via **serveur** → staff registers in Admin → **chef** queue. Do not build dining-room self-order that replaces the serveur.
10. Implement only the active unit spec (`units-NN-feature.md`); do not anticipate later units beyond declared dependencies.
11. **GSAP** only on hotel Client surfaces; Admin ops boards stay shadcn/operational.
12. **Client room booking (units-07):** confirming a stay requires Better Auth sign-in or sign-up (no anonymous confirm). Multi-night stays must always be linked to a client account; V1 applies the same gate to every online room confirmation.
