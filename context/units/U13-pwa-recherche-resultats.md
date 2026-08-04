# U13 — PWA recherche & résultats

| | |
|---|---|
| **Phase** | D — Client en ligne |
| **Status** | `done` |
| **Dépend de** | U05, U06 |
| **Débloque** | U14 |

---

## Objectif visible

Un voyageur ouvre `/[orgSlug]`, recherche un trajet (style compagnie aérienne) et voit des **résultats** cliquables avec prix et places.

## Scope

### Inclus

- Routes publiques `/[orgSlug]` et `/[orgSlug]/recherche`
- Résolution org par slug (404 si inconnu)
- UI SearchBar + DepartResultCard (U06) branchées sur U05
- Page détail `/[orgSlug]/departs/[departId]` + CTA « Continuer »
- Mobile-first, français, CDF

### Hors scope

- Auth obligatoire (peut être anonyme jusqu’au checkout U14/U15)
- Draft / paiement
- Manifest PWA complet (peut être minimal)

## Critères d’acceptation (testables)

1. Slug org valide → page marque / recherche.
2. Recherche avec critères seed → cartes résultats.
3. Filtre bus/avion fonctionne.
4. Clic carte → détail avec horaires + prix catégories + CTA.
5. Slug invalide → 404.
6. Pas de données d’une autre org.

## Skills & MCPs (obligatoire)

| Type | À utiliser |
|------|------------|
| Skill | `shadcn` |
| MCP | `project-0-coccinelle-shadcn` |
| Skill | `next-dev-loop` |
| Skill | `organization-best-practices` (slug org) |
| MCP | `user-better-auth` si lecture org via Better Auth |

## Fichiers impactés (indicatif)

- `app/[orgSlug]/**`
- Réutilisation `components/funnel/**`

## Comment tester

1. Navigateur mobile / responsive : recherche → résultats → détail.
2. Vérifier isolation multi-org avec 2 slugs.
