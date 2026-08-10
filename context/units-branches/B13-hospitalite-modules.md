# B13 — Modules hospitalité (Hôtel / Restaurant)

| | |
|---|---|
| **Phase** | B3+ |
| **Status** | `done` |
| **Dépend de** | B01, B02, B03, B10 |
| **Plan** | [`../plan-hospitalite-modules-hotel-restaurant.md`](../plan-hospitalite-modules-hotel-restaurant.md) |

## Objectif

À la création d’une branche hospitalité, choisir **Séjours** et/ou **Restaurant**.  
Livraison stock commune. Type affiché : **Hôtel** ou **Restaurant**.

## Livré

- Enum `BranchType.RESTAURANT` + `Branch.hasStays` / `hasRestaurant`
- Backfill HOTEL existants → les deux modules `true`
- Helpers `lib/branch/hospitality.ts`
- Formulaire création : checkboxes modules + dérivation type
- Bootstrap conditionnel (chambres / menu F&B)
- Menus dashboard filtrés + guards pages/actions
- Caisse & tableau de bord adaptés aux flags

## Critères

1. Resto seul → type Restaurant, pas Séjours/Chambres, Livraison OK  
2. Hôtel + resto → comportement historique  
3. Séjours seul → Hôtel sans resto/cuisine  
4. URL hors module → redirect hub  
5. AGENCE / BOUTIQUE inchangés  
