# B03 — Création Organization → Branches

| | |
|---|---|
| **Phase** | B0 |
| **Status** | `done` |
| **Dépend de** | B01, B02 |
| **Débloque** | B06 |

## Objectif

Après `organization.create`, l’admin peut **créer une ou plusieurs branches** en choisissant le **type** ; le bootstrap B02 s’exécute.

## Flow UX

```text
Créer org (nom + slug)
  → Succès
  → Écran « Ajouter des branches »
       - Type (Agence / Hôtellerie-restaurant / Commerce)
       - Si Hôtellerie-restaurant : modules Séjours ± Restaurant
       - Si Agence : Avion / Bus / Bateau
       - Si Commerce : Pharmacie / Boutique / Alimentation
       - Nom + code
       - Option « données démo »
  → Créer → redirect org hub / première branche
```

> Modules hôtellerie-restaurant : [B13](./B13-hospitalite-modules.md).  
> Modules agence & boutique : [B14](./B14-agence-boutique-modules.md).

## Critères

1. Impossible de créer une branche sans org.  
2. Type obligatoire.  
3. Bootstrap appelé automatiquement.  
4. Au moins 1 branche recommandée avant d’accéder au métier.

## Livré

- Redirect post-create org → `/admin/organizations/[id]/branches/new`
- Formulaire type + bootstrap ; liste `/admin/organizations/[id]/branches`
- Dashboard branche → `/admin/organizations/[id]/branches/[branchId]`

