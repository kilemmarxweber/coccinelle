# T09 — Navbar Accueil + tablette

| Meta | |
|------|--|
| **Id** | `navbar-accueil-tablet` |
| **Dépendances** | T05 (bouton existe) |
| **Estimation** | S |

## Objectif

Bouton **Accueil** visible phone **et** tablette ; navbar moins saturée sur petit écran ; **Établissements** en FR.

## Fichiers touchés

- `app/admin/organizations/[organizationId]/branches/[branchId]/layout.tsx`
- `components/layout/dashboard-navbar.tsx`

## Skills

1. **Lire** `.agents/skills/shadcn/SKILL.md`.
2. `Button` + `Link` via `render` ; icônes Lucide — pattern layout voisin.

## MCP

- next-devtools optionnel.
- Prisma **interdit**.

## Étapes

1. Dans le layout branche : libellé `Hub` → `Accueil` ; **retirer `md:hidden`** pour que le bouton reste visible tablette/desktop.
2. Libellé `Branches` → `Établissements` (lien `organizationBranchesPath` inchangé).
3. Dans `DashboardNavbar` (&lt;sm) : texte « Déconnexion » en `sr-only` ou `hidden sm:inline` — icône reste.
4. (&lt;sm) : masquer le prénom (`hidden sm:inline`) ; avatar reste.
5. **Ne pas** importer `MobileNav` dans le layout branche.
6. Garder le titre navbar cliquable vers le hub.

## Hors scope

- Bottom tab bar complète.
- Copy cloche Alertes (→ T12).

## Critères de done

- À ~768–1024px, Accueil visible dans la navbar.
- À ~390px, Déconnexion non tronquée (icône seule).

## Vérif

Depuis un module profond en phone et tablette : taper Accueil → hub.
