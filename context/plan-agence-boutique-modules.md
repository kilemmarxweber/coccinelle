# Plan — Modules Agence (transport) & Boutique (verticales)

| | |
|---|---|
| **Status** | `done` (MVP) |
| **Contexte** | Création de branche — même pattern que l’hospitalité |
| **Lié** | [`plan-hospitalite-modules-hotel-restaurant.md`](./plan-hospitalite-modules-hotel-restaurant.md), [`units-branches/B14-agence-boutique-modules.md`](./units-branches/B14-agence-boutique-modules.md) |

## Agence — modes de transport

| Cases | Flags | Bootstrap démo |
|-------|-------|----------------|
| Avion | `hasAvion` | Trajet Kinshasa → Lubumbashi (AVION) |
| Bus | `hasBus` | Trajet Kinshasa → Matadi (BUS) |
| Bateau | `hasBateau` | Trajet Kinshasa → Mbandaka (BATEAU) |

**Règle :** au moins un mode. Enum `ModeTransport` étendu avec `BATEAU`.

## Boutique / Commerce — verticales

| Cases | Flags | Bootstrap démo |
|-------|-------|----------------|
| Pharmacie | `hasPharmacie` | Catégorie Pharmacie + produits |
| Boutique | `hasShop` | Catégorie Boutique + produits |
| Alimentation | `hasAlimentation` | Catégorie Alimentation + produits |

**Règle :** au moins une verticale. `BranchType` reste `BOUTIQUE`.

## Backfill

- Agences existantes → `hasAvion` + `hasBus`
- Boutiques existantes → `hasShop`

## Helpers

`lib/branch/agency-shop.ts` — derive / labels / listes de modes.
