# T12 — Alertes + a11y FR

| Meta | |
|------|--|
| **Id** | `a11y-alertes` |
| **Dépendances** | aucune (peut suivre T09) |
| **Estimation** | XS |

## Objectif

Libellés accessibilité et cloche d’alertes en français clair.

## Fichiers touchés

- `components/layout/branch-notifications-bell.tsx` — titre / aria **Alertes** + description FR (Arrivée / Départ)
- `components/ui/dialog.tsx` — `Close` → `Fermer` (sr-only)
- `components/ui/sheet.tsx` — idem
- `components/ui/spinner.tsx` — `Loading` → `Chargement`
- Optionnel : `components/layout/admin-top-bar.tsx` si aria Notifications EN

## Skills

1. shadcn si toucher Dialog/Sheet — lire skill avant.

## MCP

- Prisma / better-auth **interdits**.

## Étapes

1. Remplacer `Notifications` (aria + titre popover) par **Alertes**.
2. Réécrire la description popover sans jargon EN (`check-in` / `check-out` / `F&B`).
3. `Close` → `Fermer` ; `Loading` → `Chargement` dans dialog / sheet / spinner.

## Hors scope

- Logique du feed d’alertes / polling.

## Critères de done

- Pas de `Close` / `Loading` / titre `Notifications` EN sur ces surfaces.

## Vérif

Ouvrir la cloche Alertes ; ouvrir un dialog module et vérifier le sr-only Fermer.
