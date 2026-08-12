# T03 — Modules chrome + empty + badges

| Meta | |
|------|--|
| **Id** | `modules-chrome` |
| **Dépendances** | T01 |
| **Estimation** | M |

## Objectif

Appliquer `ModulePageChrome`, `EmptyState` et `StatusBadge` sur bons de commande, dépenses, séjours et (en-tête) caisse — sans toucher à la logique métier.

## Fichiers touchés

- `.../bons-commande/bons-commande-client.tsx`
- `.../depenses/depenses-client.tsx`
- `.../hotel/sejours/sejours-client.tsx`
- `.../caisse/caisse-client.tsx` (chrome / empty si applicable)

## Skills

1. **Lire** `.agents/skills/shadcn/SKILL.md`.
2. Empty states → composant `EmptyState` existant (ou `Empty` shadcn si déjà installé — préférer le pattern déjà utilisé dans le repo : `components/ui/empty-state.tsx`).
3. Badges → `StatusBadge` / `Badge`, pas de spans custom.

## MCP

- shadcn si UP.
- next-devtools optionnel pour compile errors après edit.
- Prisma **interdit**.

## Étapes

1. Remplacer le bloc titre + lien « Dashboard » ad hoc par `ModulePageChrome` (garder les boutons d’actions dans `actions`).
2. Listes vides : `EmptyState` avec icône Lucide + titre + CTA optionnel (ex. « Nouveau bon »).
3. Remplacer classes `text-amber-800` / `text-sky-800` etc. par tones `StatusBadge`.
4. Séjours : empty de la liste actifs/check-outs via `EmptyState` (calendrier UI → T04).
5. Caisse : aligner l’en-tête sur le même chrome si structure similaire.

## Hors scope

- Validation PO, ouverture caisse, check-in/out.
- Refactor des mega-clients (découpage fichiers).

## Critères de done

- Quatre surfaces avec chrome cohérent.
- Empty states non dashed-text.
- Badges lisibles en dark.

## Vérif

Parcourir bons, dépenses, séjours, caisse ; listes vides si possible.
