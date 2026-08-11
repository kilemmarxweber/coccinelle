# Plan — Code-barres produits (resto + vente rapide)

| | |
|---|---|
| **Status** | `done` |
| **Périmètre** | `HotelMenuItem` — restauration + vente rapide caisse (`PosTerminal`) |
| **Hors scope** | Boutique `ShopProduct`, caméra, impression étiquettes |
| **Lié** | `components/pos/pos-terminal.tsx`, `lib/hotel/actions.ts`, `hotel/produits` |

---

## Objectif

1. **Caisse / resto** : scan USB → produit trouvé → **+1 panier** (chaque scan = +1).
2. **Produits** : scanner / saisir le code fabricant, **ou générer** un code interne.

## Décisions

- Champ `barcode` nullable, unique `(branchId, barcode)` (plusieurs `NULL` OK).
- Génération **manuelle** via bouton (pas d’auto à la création).
- Consommables : barcode autorisé (optionnel).
- Lecteur USB wedge uniquement (phase 1).

## Implémentation

| Étape | Fichiers |
|-------|----------|
| Schema | `HotelMenuItem.barcode` + migration |
| Helper | `lib/hotel/barcode.ts` |
| CRUD | `createMenuItemAction` / `updateMenuItemAction` |
| UI produits | champ scan + Générer / Régénérer |
| POS | `useBarcodeScanField` + lookup dans `PosTerminal` |
