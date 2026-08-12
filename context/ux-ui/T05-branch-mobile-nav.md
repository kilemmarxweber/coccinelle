# T05 — Retour hub branche (mobile)

| Meta | |
|------|--|
| **Id** | `branch-mobile-nav` |
| **Dépendances** | T02 utile mais pas bloquant |
| **Estimation** | S |

## Objectif

Sur les pages modules branche, offrir une affordance « Retour hub » visible sur mobile dans le layout/navbar, sans brancher le `MobileNav` admin legacy.

## Fichiers touchés

- `app/admin/organizations/[organizationId]/branches/[branchId]/layout.tsx`
- Éventuellement `components/layout/dashboard-navbar.tsx` (prop/action)

## Skills

1. **Lire** `.agents/skills/shadcn/SKILL.md`.
2. `Button` + `Link` via `render` (Base UI) ; icônes Lucide sans classes size dans Button si skill l’exige — suivre pattern repo voisin.

## MCP

- next-devtools optionnel.
- Prisma **interdit**.

## Étapes

1. Dans le layout branche, ajouter dans `actions` de `DashboardNavbar` un lien/bouton « Hub » ou icône Home vers `branchDashboardPath`, visible surtout sur `md:hidden` (ou toujours, discret).
2. **Ne pas** importer `MobileNav` dans le layout branche.
3. Garder le titre navbar cliquable vers le hub.

## Hors scope

- Bottom tab bar complète.
- Unification avec shell agences legacy.

## Critères de done

- Sur mobile, depuis un module profond, retour hub en un tap sans dépendre du back navigateur seul.

## Vérif

Ouvrir séjours ou bons sur ~390px ; utiliser le nouveau contrôle.
