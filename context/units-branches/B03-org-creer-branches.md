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
       - Type (Agence / Hôtel / Boutique)
       - Nom + code
       - Option « données démo »
  → Créer → redirect org hub / première branche
```

## Critères

1. Impossible de créer une branche sans org.  
2. Type obligatoire.  
3. Bootstrap appelé automatiquement.  
4. Au moins 1 branche recommandée avant d’accéder au métier.

## Livré

- Redirect post-create org → `/admin/organizations/[id]/branches/new`
- Formulaire type + bootstrap ; liste `/admin/organizations/[id]/branches`
- Dashboard branche → `/admin/organizations/[id]/branches/[branchId]`

