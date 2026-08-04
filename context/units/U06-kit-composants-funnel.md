# U06 — Kit composants funnel airline

| | |
|---|---|
| **Phase** | B — Funnel & guichet |
| **Status** | `done` |
| **Dépend de** | U05 |
| **Débloque** | U07, U13 |

---

## Objectif visible

Des composants UI **réutilisables** reproduisent le funnel compagnie aérienne : barre de recherche, carte résultat, récap prix, stepper — visibles sur une **page démo** ou le design-system.

## Scope

### Inclus

- `SearchBar` (départ, arrivée, date, mode)
- `DepartResultCard` (prix, places, mode, CTA)
- `CheckoutStepper` (étapes)
- `PriceSummary` (billets + colis)
- `PassengerForm` (base)
- Page démo `/design-system/funnel` (ou section design-system)
- Brancher `SearchBar` + cartes sur le moteur U05 (données réelles en démo)

### Hors scope

- Parcours guichet complet (U07)
- Routes PWA (U13)
- Paiement réel

## Critères d’acceptation (testables)

1. Ouvrir la page démo : recherche → liste de cartes avec données U05.
2. Le stepper affiche au moins 4 étapes nommées (Recherche, Passagers, Options, Paiement).
3. `PriceSummary` met à jour un total affiché quand on change le nb d’adultes (mock local OK).
4. Composants accessibles (labels) et cohérents shadcn.
5. Aucune duplication de logique prix : réutiliser `lib/reservation/pricing.ts` si possible.

## Skills & MCPs (obligatoire)

| Type | À utiliser |
|------|------------|
| Skill | `shadcn` (composition, forms, styling) |
| MCP | `project-0-coccinelle-shadcn` — search / add / examples (Card, Button, Tabs, Field…) |
| Skill | `next-dev-loop` — valider la démo en runtime |

## Fichiers impactés (indicatif)

- `components/funnel/*` (nouveau)
- `app/design-system/**`

## Comment tester

1. `next dev` → page démo funnel.
2. Lancer une recherche seed → cartes.
3. Vérifier responsive mobile basique.
