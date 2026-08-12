# T02 — Branch hub polish

| Meta | |
|------|--|
| **Id** | `branch-hub` |
| **Dépendances** | aucune (indépendant de T01) |
| **Estimation** | S |

## Objectif

Polir le hub branche : message d’accueil sans emoji, pastille rôle sans chevauchement mobile, sections/menus en tokens primary/muted au lieu du rainbow Tailwind.

## Fichiers touchés

- `app/admin/organizations/[organizationId]/branches/[branchId]/branch-dashboard.tsx`
- `lib/branch/branch-menus.ts`
- `components/ui/dashboard-menu-card.tsx`

## Skills

1. **Lire** `.agents/skills/shadcn/SKILL.md`.
2. Semantic colors only ; différenciation via icônes, pas `text-teal-400` / `violet-400` / etc.

## MCP

- shadcn si UP pour patterns Card/Link ; sinon code existant.
- Prisma **interdit**.

## Étapes

1. Retirer l’emoji `👋` du titre d’accueil.
2. Remplacer le layout `absolute` de la pastille « Droit » par un flex (titre + badge) pour éviter le chevauchement sur petit écran.
3. Dans `branch-menus.ts`, remplacer `titleColor` / `iconColor` rainbow par `text-primary` / `text-muted-foreground` / `text-foreground` (et `iconBg` type `bg-primary/15`).
4. Ajuster les défauts de `DashboardSection` / `DashboardMenuCard` en conséquence.

## Hors scope

- Changer la structure des menus métier (quelles cartes apparaissent).
- Animation welcome (garder le collapse 30s).

## Critères de done

- Hub lisible mobile ; pas de pastille qui coupe le texte.
- Sections cohérentes avec le thème orange/primary.

## Vérif

Ouvrir `/admin/organizations/.../branches/[branchId]` light + dark, ~390px.
