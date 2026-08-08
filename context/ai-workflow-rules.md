# AI Workflow Rules — Coccinelle

## Overall approach

- Work **spec-driven**: read `context/specs/units-NN-feature.md` for the active unit and implement exactly that scope.
- Work **incrementally**: one unit at a time; update `context/progress-tracker.md` when starting and finishing a unit.
- Before any architectural or product decision, read in order: `project-overview.md`, `architecture.md`, `ui-context.md`, `code-standards.md`, `ai-workflow-rules.md`, `progress-tracker.md`.
- In docs and specs, **explain acronyms** at first mention (or point to the glossaire in `project-overview.md`).

## Scoping rules

- Implement only the active unit. Do not start the next unit early.
- Do not make speculative refactors, drive-by cleanups, or unrelated file edits.
- Do not reintroduce obsolete hotel plans from `context/units-branches/B10*` or old dashboard hotel contracts.
- Do not migrate voyage payment or build CashSession unless the active spec requires it.
- Do not edit the Cursor plan file under `.cursor/plans/` unless the user asks.
- Respect **en ligne vs sur place**: do not invent dining-room guest self-order that replaces the serveur; online food is client self-service; sur-place food is serveur → enregistrement Admin → chef.

## When to split work

- If a unit mixes schema + large UI + Client PWA in one session and verification fails, stop and ask to split — do not silently expand scope.
- Prefer: schema/lib first, then Admin UI, then Client UI across ordered units (see `units-00-build-plan.md`).

## Missing or ambiguous requirements

- If the spec is ambiguous, check `project-overview.md` and `architecture.md` invariants.
- If still unclear, **ask the user** before inventing product behavior.
- Do not invent OTA, CashSession hard gates, or sur-place self-order as the primary restaurant path.

## Files / areas requiring explicit instruction

- Do not regenerate or mass-edit shadcn primitives under `components/ui/` unless the unit needs a new component via the project shadcn MCP.
- Do not change Better Auth core config (`lib/auth.ts`, `lib/permissions.ts`) without reading Better Auth MCP docs and declaring statements/roles properly.
- Do not delete historical `context/units/*` voyage docs.
- Do not force-push, amend published commits, or skip hooks unless the user explicitly requests it.

## Documentation sync

- After each completed unit: mark it complete in `progress-tracker.md` with date/notes.
- If implementation changes architecture, scope, or standards, update the relevant context file **before** continuing.
- When a unit adds routes or domain modules, keep `architecture.md` boundaries accurate.
- Spec filenames must stay `units-NN-feature.md`.

## MCPs and docs to consult

- Better Auth: before new permissions.
- Prisma: before schema changes.
- shadcn: before adding UI primitives.
- Next.js local docs (`node_modules/next/dist/docs/`) for App Router unknowns.

## Verification before next unit

- [ ] Every item in the unit’s `Verify when done` checklist is true
- [ ] `pnpm typecheck` passes (or project equivalent) for touched code
- [ ] No voyage regression intended; do not break guichet/PWA tickets
- [ ] French UI strings for new hotel surfaces
- [ ] `progress-tracker.md` updated (unit completed, next up set)
