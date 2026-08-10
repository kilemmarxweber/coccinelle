# B02 — Bootstrap par type de branche

| | |
|---|---|
| **Phase** | B0 |
| **Status** | `done` |
| **Dépend de** | B01 |
| **Débloque** | B03, B10, B11 |

## Objectif

À la création d’une branche, **charger les éléments nécessaires** selon le type.

| Type | Éléments bootstrap |
|------|-------------------|
| `AGENCE` | Paramètres voyage ; 1–2 trajets démo (optionnel flag) ; BranchMember owner |
| `HOTEL` / `RESTAURANT` | Selon flags : chambres si `hasStays` ; menu F&B si `hasRestaurant` ; taux de change (voir [B13](./B13-hospitalite-modules.md)) |
| `BOUTIQUE` | Catégories + produits + stock initial |

## Critères

1. Créer AGENCE → trajets liés `branchId` (si flag seedDemo).  
2. Créer HOTEL → room types + rooms.  
3. Créer BOUTIQUE → categories + products stock > 0.  
4. Idempotent / transactionnelle.

## Livré

`lib/branch/bootstrap-branch.ts` — appelé depuis `createBranchWithBootstrapAction`.
