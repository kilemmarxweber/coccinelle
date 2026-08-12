# T08 — Retour chrome unifié

| Meta | |
|------|--|
| **Id** | `retour-chrome` |
| **Dépendances** | T01 (ModulePageChrome existe) |
| **Estimation** | S |

## Objectif

Unifier le lien retour module → hub avec le libellé **Retour** (FR), partout.

## Fichiers touchés

- `components/layout/module-page-chrome.tsx` — `backLabel` défaut `"Retour"`
- Ad-hoc → Retour (ou migrer vers ModulePageChrome si petit diff) :
  - `app/admin/organizations/[organizationId]/branches/[branchId]/hotel/service-stock/service-stock-client.tsx`
  - `app/admin/organizations/[organizationId]/branches/[branchId]/boutique/produits/produits-client.tsx`
  - `app/admin/organizations/[organizationId]/branches/[branchId]/boutique/stock/stock-client.tsx`
  - `app/admin/organizations/[organizationId]/branches/[branchId]/boutique/pos/pos-client.tsx`
  - `app/admin/organizations/[organizationId]/branches/[branchId]/_components/branch-module-placeholder.tsx`

## Skills

1. **Lire** `.agents/skills/shadcn/SKILL.md` si modification Button/Link.
2. Composer `Button` + `Link` via `render` (Base UI) — pattern ModulePageChrome existant.

## MCP

- shadcn optionnel.
- Prisma **interdit**.

## Étapes

1. Dans `ModulePageChrome`, changer le défaut `backLabel = "Retour"` (au lieu de `"Dashboard"`).
2. Remplacer les libellés `Dashboard` / `Hub` / `Retour au dashboard` dans les retours ad-hoc listés.
3. Préférer migrer vers `ModulePageChrome` si le diff reste petit ; sinon remplacer le libellé seulement.
4. **Pas de `sticky`** sur le chrome.

## Hors scope

- Navbar Accueil / Établissements (→ T09).
- Réécriture des descriptions hub / sous-titres (→ T10 / T11).

## Critères de done

- Séjours / bons / dépenses / caisse affichent **Retour**.
- Plus de libellé Dashboard/Hub sur ces retours page.

## Vérif

Ouvrir un module branche ; le lien ghost sous le titre = « Retour » vers le hub.
