# B04 — BranchMember + permissions `branch:*`

| | |
|---|---|
| **Phase** | B0 |
| **Status** | `todo` |
| **Dépend de** | B01 |
| **Débloque** | B06 |

## Objectif

Affecter des members à une branche ; permissions Better Auth `branch: create|update|delete|read|assign`.

## Critères

1. Owner / admin peut assigner.  
2. `assertBranchPermission` en place.  
3. Parent ne peut pas gérer les branches.
