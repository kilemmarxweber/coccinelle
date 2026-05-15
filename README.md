# Smart Church

Smart Church is a Next.js 16 admin application for authentication, global user management, and organization role management using Better Auth + Prisma.

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
- `app/api/admin/*`: Server routes for organization role operations.
- `lib/auth.ts`: Better Auth server configuration.
- `lib/auth-client.ts`: Better Auth client plugins and hooks.
- `lib/permissions.ts`: Permission statements, role matrices, and shared authz route/capability maps.
- `lib/authorization.ts`: Server-side permission enforcement helpers.
- `hooks/use-admin-actions.ts`: Client admin actions and capability checks.
- `proxy.ts`: Auth routing + endpoint permission checks (Node.js runtime).

## Environment Variables

Copy `.env.example` to `.env.local` and fill values:

- `NODE_ENV`
- `DATABASE_URL`
- `BETTER_AUTH_URL`
- `BETTER_AUTH_SECRET` (minimum 32 chars)

Environment values are validated in `lib/env.ts`.

## Local Setup

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Quality Commands

```bash
npm run lint
npm run typecheck
npm run test
npm run test:coverage
npm run format:check
npm run check
```

## CI

GitHub Actions workflow in `.github/workflows/ci.yml` runs:

- `npm run lint`
- `npm run typecheck`
- `npm run test`

on pushes to `main` and pull requests.

## Notes

- This project is standardized on npm lockfiles.
- Update Prisma schema/migrations before deploying auth or permission model changes.
