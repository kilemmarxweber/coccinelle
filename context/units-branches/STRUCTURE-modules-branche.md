# Structure modules sous `branches/[branchId]`

## Approche

**Oui — c’est la bonne approche**, alignée avec le plan multi-branches :

- **Organization** = tenant / société  
- **Branch** = site d’exploitation typé  
- **Modules** = verticales métier activées par `BranchType`  
- **Core partagé** = caisse (cashpaye), plus tard équipe / rapports

Ne **pas** mélanger voyage + hôtel + boutique dans le même menu : le hub n’affiche que le module du type.

## Arborescence URL

```text
.../branches/[branchId]/                 → hub dashboard (menu selon type)
.../branches/[branchId]/agence/          → AGENCE uniquement
    reservations/  guichet/  trajets/  colis/  passages/  clients/
.../branches/[branchId]/hotel/           → HOTEL uniquement
    chambres/  sejours/  restauration/
.../branches/[branchId]/boutique/        → BOUTIQUE uniquement
    produits/  stock/  pos/
.../branches/[branchId]/caisse/          → core partagé (tous types)
```

## Règles

1. Accès via `requireBranchContext({ requireModule })` — mauvais type → redirect hub.  
2. Chemins via `lib/branch/paths.ts` (`agenceRoutes`, `hotelRoutes`, `boutiqueRoutes`).  
3. Menu via `lib/branch/branch-menus.ts`.  
4. Ancien `/admin/.../agences/*` : **legacy** jusqu’à migration B07 (voyage scopé `branchId`).  
5. Lib métier partagée (`lib/reservation`, etc.) reste hors `app/` — seuls les **écrans** vivent sous le module.

## Prochaine étape

Migrer progressivement le guichet / réservations de `.../agences/` → `.../branches/[branchId]/agence/`, en filtrant toujours `organizationId` + `branchId`.

## Hôtel

Les sous-routes `hotel/chambres|sejours|restauration` restent la coquille URL. Le **produit hôtel** se construit via `context/specs/UH01`…`UH07` (B10 obsolete).
