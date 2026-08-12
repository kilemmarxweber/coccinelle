# T04 — Séjours calendrier / mobile

| Meta | |
|------|--|
| **Id** | `sejours-mobile` |
| **Dépendances** | T03 (empty déjà fait) |
| **Estimation** | S |

## Objectif

Rendre la légende calendrier et la toolbar lisibles en dark et sur mobile (~390px), sans changer le comportement du calendrier.

## Fichiers touchés

- `.../hotel/sejours/sejours-client.tsx` (zone calendrier / légende / contrôles vue)

## Skills

1. **Lire** `.agents/skills/shadcn/SKILL.md`.
2. Préférer tokens / paires light+dark cohérentes ; éviter `slate-600` seul.

## MCP

- next-devtools optionnel.
- Prisma **interdit**.

## Étapes

1. Légende : classes dark-safe pour check-in / occupé / historique / libre (ex. `text-orange-500`, `text-sky-600 dark:text-sky-400`, `text-muted-foreground`, `text-emerald-600 dark:text-emerald-400`).
2. Toolbar : sur mobile, stack vertical ou `overflow-x-auto` contrôlé avec `flex-nowrap` + gap — éviter wrap chaotique de tous les boutons.
3. Ne pas modifier handlers `navigate` / `setView` / sélection de cellules.

## Hors scope

- Logique occupation / check-in.
- Refonte complète du tableau calendrier.

## Critères de done

- Légende lisible en `.dark`.
- Toolbar utilisable à 390px sans chevauchement illisible.

## Vérif

Onglet Agenda/Calendrier séjours, light + dark, viewport mobile.
