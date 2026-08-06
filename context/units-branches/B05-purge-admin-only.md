# B05 — Purge données (garde admin)

| | |
|---|---|
| **Phase** | B0 |
| **Status** | `done` |
| **Dépend de** | — |
| **Débloque** | Tests propres B03+ |

## Objectif

Supprimer **toutes** les données métier / orgs / users de test, **sauf** le user `role = admin` (et son account credential).

## Critères

1. `SELECT * FROM "user"` → uniquement admin.  
2. Plus d’organizations / reservations / trajets.  
3. Script documenté : `pnpm exec tsx prisma/scripts/purge-keep-admin.ts`.

## Livré

Purge exécutée — user conservé : `kilemmarxweber@gmail.com` (`role=admin`).
