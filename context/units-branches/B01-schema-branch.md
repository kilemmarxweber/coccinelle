# B01 — Schéma Branch + BranchMember

| | |
|---|---|
| **Phase** | B0 — Fondations |
| **Status** | `done` |
| **Dépend de** | — |
| **Débloque** | B02, B04, B07 |

## Objectif

Modéliser `Branch` (typée) et `BranchMember` en base.

## Scope

- Enum `BranchType` : `AGENCE` \| `HOTEL` \| `BOUTIQUE`
- Modèles `Branch`, `BranchMember`
- Modèles bootstrap minimaux : `HotelRoomType`, `HotelRoom`, `ShopCategory`, `ShopProduct`
- `Trajet.branchId` optionnel (nullable) pour rattachement progressif

## Critères d’acceptation

1. `prisma db push` / migrate OK.  
2. CRUD Prisma possible sur Branch.  
3. Contrainte unique `(organizationId, code)`.

## Livré

Voir schéma Prisma + client généré.
