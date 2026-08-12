# UX/UI polish — espace branche

Plan lié : polish UX/UI branche (ModulePageChrome, EmptyState, dark badges, nav) + lot FR / Retour / Copy UX.

## Ordre d’exécution

### Lot 1 — Polish chrome

1. [T01 shared-primitives](./T01-shared-primitives.md)
2. [T02 branch-hub](./T02-branch-hub.md)
3. [T03 modules-chrome](./T03-modules-chrome.md)
4. [T04 sejours-mobile](./T04-sejours-mobile.md)
5. [T05 branch-mobile-nav](./T05-branch-mobile-nav.md)
6. [T06 admin-stubs](./T06-admin-stubs.md)
7. [T07 visual-check](./T07-visual-check.md)

### Lot 2 — FR / Retour / Copy UX

8. [T08 retour-chrome](./T08-retour-chrome.md)
9. [T09 navbar-accueil-tablet](./T09-navbar-accueil-tablet.md)
10. [T10 copy-hub-menus](./T10-copy-hub-menus.md)
11. [T11 fr-copy-modules](./T11-fr-copy-modules.md)
12. [T12 a11y-alertes](./T12-a11y-alertes.md)
13. [T13 visual-check-fr](./T13-visual-check-fr.md)

## Règles globales

- UX/UI only : pas de Prisma schema/migrations, pas de server actions métier, pas de changements de permissions.
- Composer avec shadcn existant ; tokens sémantiques (`bg-primary`, `text-muted-foreground`) — pas de rainbow Tailwind ad hoc.
- Lire le skill **avant** de coder ; lire le schéma MCP **avant** tout `CallMcpTool`.
- Ne pas renommer les ids code (`HubTab`, `STATUS.NO_SHOW`, props `DashboardNavbar`) — chaînes UI seulement.

## Skills (obligatoires selon tâche)

| Skill | Chemin | Quand |
|-------|--------|--------|
| shadcn | `.agents/skills/shadcn/SKILL.md` | T01–T06, T08–T09, T12 si UI |
| next-dev-loop | `.agents/skills/next-dev-loop/SKILL.md` | T07, T13 |
| AGENTS.md / Next docs | `AGENTS.md` + `node_modules/next/dist/docs/` | Si doute API Next 16 |

## MCP

| Serveur | Id Cursor | Usage |
|---------|-----------|--------|
| shadcn | `project-0-coccinelle-shadcn` | Docs/composants si le serveur est UP ; sinon fallback CLI `pnpm dlx shadcn@latest` via skill |
| next-devtools | `project-0-coccinelle-next-devtools` | Routes, erreurs compile, logs runtime (T07, T13) |
| Prisma | `user-Prisma` | **Interdit** sur ce lot (hors scope) |
| better-auth | `user-better-auth` | **Interdit** sauf bug auth UI non prévu |

Note : si STATUS MCP = errored, continuer via skills + CLI + lecture code ; ne pas bloquer.

## Lexique FR (lot 2)

| Actuel | Nouveau |
|--------|---------|
| Hub (nav) | Accueil |
| Dashboard (page) | Retour |
| Branches | Établissements |
| Notifications | Alertes |
| Check-in | Arrivée |
| Check-out | Départ |
| No-show | Non-présentation |
| F&B | Restauration |
| POS (UI) | Point de vente |
| Close / Loading | Fermer / Chargement |

## Done global

- Lot 1 : Hub + séjours + bons + dépenses OK en light/dark et ~390px ; pas de double sticky ; pas de cul-de-sac Paramètres/Aide.
- Lot 2 : Accueil visible phone+tablette ; Retour unifié ; descriptions hub/modules intuitives ; plus de jargon EN visible sur ces surfaces.
