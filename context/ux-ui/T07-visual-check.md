# T07 — Vérification visuelle

| Meta | |
|------|--|
| **Id** | `visual-check` |
| **Dépendances** | T01–T06 |
| **Estimation** | S |

## Objectif

Confirmer en runtime que le polish UX tient : light/dark, mobile ~390px, pas de régression chrome.

## Fichiers touchés

- Aucun (QA) sauf hotfix UI si bug trouvé.

## Skills

1. **Lire et suivre** `.agents/skills/next-dev-loop/SKILL.md`.
2. Prérequis : `pnpm dev` + Next 16.3+ ; `agent-browser` si dispo.
3. Croiser `/_next/mcp` (next-devtools) et vue navigateur.

## MCP

- `project-0-coccinelle-next-devtools` : lister tools, puis erreurs compile / logs.
- shadcn : non requis.
- Prisma **interdit**.

Fallback si MCP errored : lecture terminal `pnpm dev` + navigation manuelle / agent-browser.

## Étapes

1. Checklist :
   - [ ] Hub branche — welcome, sections, pastille rôle
   - [ ] Séjours — chrome, empty, légende, toolbar mobile
   - [ ] Bons de commande — chrome, empty, badges dark
   - [ ] Dépenses — chrome, empty
   - [ ] Retour hub mobile (T05)
   - [ ] Menu admin Plus sans settings/help actifs
2. Light + dark pour chaque.
3. Noter / corriger tout contraste ou double sticky.

## Hors scope

- Perf / bundle.
- E2E Playwright nouveaux (sauf si déjà en place).

## Critères de done

- Checklist cochée ; pas d’erreur compile bloquante sur ces routes.

## Vérif

`pnpm dev` + parcours ci-dessus.
