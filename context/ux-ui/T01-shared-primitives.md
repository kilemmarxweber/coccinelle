# T01 — Shared primitives

| Meta | |
|------|--|
| **Id** | `shared-primitives` |
| **Dépendances** | aucune |
| **Estimation** | S |

## Objectif

Créer les primitives UI réutilisables pour les modules branche : `ModulePageChrome` (en-tête non sticky sous `DashboardNavbar`), `StatusBadge` (contraste light/dark), et documenter l’usage de `EmptyState` existant.

## Fichiers touchés

- Créer `components/layout/module-page-chrome.tsx`
- Créer `components/ui/status-badge.tsx`
- Lire (ne pas casser) `components/ui/empty-state.tsx`, `components/ui/badge.tsx`, `lib/branch/paths.ts`

## Skills

1. **Lire** `.agents/skills/shadcn/SKILL.md` avant de coder.
2. Respecter : tokens sémantiques, `flex` + `gap-*` (pas `space-y-*`), `size-*`, `cn()`, composer `Badge` / `Button` / `Link` existants.
3. Pas d’override de couleurs de composants shadcn pour le “look” — variants + `className` layout.

## MCP

- `project-0-coccinelle-shadcn` : si UP, docs Badge/Button ; sinon `pnpm dlx shadcn@latest docs badge`.
- **Ne pas** appeler Prisma / better-auth.

## Étapes

1. `ModulePageChrome` : props `organizationId`, `branchId`, `title`, `subtitle?`, `actions?`, `children?` optionnel. Lien retour via `branchDashboardPath` + icône ArrowLeft. Conteneur `mx-auto max-w-*` laissé au parent ou prop `className`.
2. **Pas de `sticky`** — la `DashboardNavbar` l’est déjà.
3. `StatusBadge` : wrapper autour de `Badge` ; tone `pending | info | success | danger | muted` avec classes `bg-*/15` + texte lisible light **et** dark (`text-amber-800 dark:text-amber-200`, etc., ou tokens warning/success si dispo).
4. Exporter proprement ; pas de logique métier.

## Hors scope

- Brancher dans les pages modules (→ T03).
- Modifier `PageHeader` sticky.

## Critères de done

- Composants compilent, typés, réutilisables.
- StatusBadge lisible en `.dark`.
- ModulePageChrome sans second sticky.

## Vérif

Import smoke dans un fichier temporaire non requis ; T03 validera l’intégration.
