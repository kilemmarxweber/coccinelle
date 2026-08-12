# T13 — Visual check FR / UX

| Meta | |
|------|--|
| **Id** | `visual-check-fr` |
| **Dépendances** | T08–T12 |
| **Estimation** | S |

## Objectif

Confirmer en runtime : français, bouton Retour, Accueil tablette, copy compréhensible, pas de régression chrome.

## Fichiers touchés

- Aucun (QA) sauf hotfix UI si bug trouvé.

## Skills

1. **Lire et suivre** `.agents/skills/next-dev-loop/SKILL.md`.
2. Prérequis : `pnpm dev` + Next 16.3+ ; `agent-browser` si dispo.
3. Croiser `/_next/mcp` (next-devtools) et vue navigateur.

## MCP

- `project-0-coccinelle-next-devtools` : lister tools, puis erreurs compile / logs.
- Prisma **interdit**.

Fallback si MCP errored : lecture terminal `pnpm dev` + navigation manuelle / agent-browser.

## Étapes

1. Checklist :
   - [ ] Hub — welcome + descriptions intuitives (pas de jargon EN)
   - [ ] Navbar — Accueil visible à ~390px **et** ~768–1024px
   - [ ] Module — lien **Retour** (pas Dashboard / Hub)
   - [ ] Séjours — légende / boutons Arrivée · Départ
   - [ ] Bons / Dépenses — sous-titres clairs + empty actionnables
   - [ ] Caisse — plus de F&B EN
   - [ ] Menu Plus admin — Paramètres (bientôt) disabled, pas d’Aide (régression T06)
   - [ ] Light + dark ; pas de double sticky
2. Noter / corriger contraste ou libellé bloquant seulement.

## Hors scope

- Perf / bundle.
- E2E Playwright nouveaux.

## Critères de done

- Checklist cochée ; pas d’erreur compile bloquante sur ces routes.

## Vérif

`pnpm dev` + parcours ci-dessus.
