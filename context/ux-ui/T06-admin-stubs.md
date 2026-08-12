# T06 — Admin stubs Paramètres / Aide

| Meta | |
|------|--|
| **Id** | `admin-stubs` |
| **Dépendances** | aucune |
| **Estimation** | XS |

## Objectif

Éviter les cul-de-sac UX : masquer ou désactiver les entrées Paramètres et Aide dans la mobile nav admin tant que les pages sont stubs.

## Fichiers touchés

- `components/layout/mobile-nav.tsx`
- Éventuellement références dans `admin-top-bar.tsx` (titres seulement — ne pas casser)

## Skills

1. **Lire** `.agents/skills/shadcn/SKILL.md` si modification UI menu.
2. Pattern : `disabled` + libellé « bientôt », ou retrait de l’item.

## MCP

- Aucun requis.
- Prisma / better-auth **interdit**.

## Étapes

1. Dans le menu « Plus » / `MobileNavMoreMenu`, retirer ou désactiver navigation vers `/admin/settings` et `/admin/help`.
2. Ne pas supprimer les routes `app/admin/settings` et `app/admin/help` (contenu hors scope).

## Hors scope

- Implémenter les pages Paramètres / Aide.
- Notifications « bientôt » déjà inertes (sauf si même fichier, laisser).

## Critères de done

- Impossible d’atteindre un stub vide via la bottom nav / menu Plus.

## Vérif

Console admin mobile → menu Plus : plus de lien actif vers settings/help.
