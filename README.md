# Coccinelle

Application Next.js de réservation de billets bus / avion (guichet, trajets, organisations) avec Better Auth + Prisma.

## Tech Stack

- Next.js 16 App Router
- React 19
- Better Auth (admin + organization plugins)
- Prisma with PostgreSQL
- Tailwind CSS + shadcn/ui components
- TypeScript + ESLint + Node test runner (`tsx --test`)

## Architecture Overview

- `app/`: App Router pages and API handlers.
- `app/api/auth/[...all]/route.ts`: Better Auth request handler.
- `lib/auth.ts`: Better Auth server configuration.
- `lib/auth-client.ts`: Better Auth client plugins and hooks.
- `lib/permissions.ts`: Permission statements and organization role matrices.
- `proxy.ts`: Auth routing + endpoint permission checks (Node.js runtime).

## Environment Variables

Copy `.env.exemple` to `.env` (or `.env.local`) and fill values:

- `DATABASE_URL`
- `BETTER_AUTH_URL`
- `BETTER_AUTH_SECRET` (minimum 32 chars)

## Local Setup

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Quality Commands

```bash
pnpm lint
pnpm typecheck
pnpm test
```

## Notes

- Rôles org produit : `owner`, `gestionnaire`, `guichetier`, `parent` (Client).
- Units d’implémentation : `context/units/`.
