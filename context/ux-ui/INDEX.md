# UX/UI polish — espace branche

Plan lié : polish UX/UI branche (ModulePageChrome, EmptyState, dark badges, nav).

## Ordre d’exécution

1. [T01 shared-primitives](./T01-shared-primitives.md)
2. [T02 branch-hub](./T02-branch-hub.md)
3. [T03 modules-chrome](./T03-modules-chrome.md)
4. [T04 sejours-mobile](./T04-sejours-mobile.md)
5. [T05 branch-mobile-nav](./T05-branch-mobile-nav.md)
6. [T06 admin-stubs](./T06-admin-stubs.md)
7. [T07 visual-check](./T07-visual-check.md)

## Règles globales

- UX/UI only : pas de Prisma schema/migrations, pas de server actions métier, pas de changements de permissions.
- Composer avec shadcn existant ; tokens sémantiques (`bg-primary`, `text-muted-foreground`) — pas de rainbow Tailwind ad hoc.
- Lire le skill **avant** de coder ; lire le schéma MCP **avant** tout `CallMcpTool`.

## Skills (obligatoires selon tâche)

| Skill | Chemin | Quand |
|-------|--------|--------|
| shadcn | `.agents/skills/shadcn/SKILL.md` | T01–T06 (composants, Badge, Button, styling) |
| next-dev-loop | `.agents/skills/next-dev-loop/SKILL.md` | T07 (et spot-check après T03/T04 si `pnpm dev` tourne) |
| AGENTS.md / Next docs | `AGENTS.md` + `node_modules/next/dist/docs/` | Si doute API Next 16 |

## MCP

| Serveur | Id Cursor | Usage |
|---------|-----------|--------|
| shadcn | `project-0-coccinelle-shadcn` | Docs/composants si le serveur est UP ; sinon fallback CLI `pnpm dlx shadcn@latest` via skill |
| next-devtools | `project-0-coccinelle-next-devtools` | Routes, erreurs compile, logs runtime (T07) |
| Prisma | `user-Prisma` | **Interdit** sur ce lot (hors scope) |
| better-auth | `user-better-auth` | **Interdit** sauf bug auth UI non prévu |

Note : si STATUS MCP = errored, continuer via skills + CLI + lecture code ; ne pas bloquer.

## Done global

Hub + séjours + bons + dépenses OK en light/dark et ~390px ; pas de double sticky ; pas de cul-de-sac Paramètres/Aide.
