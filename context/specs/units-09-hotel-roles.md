# Unit 09: Rôles hôtel Better Auth

**File:** `units-09-hotel-roles.md` · **Track:** Admin  
**Focus:** hôtel uniquement — ne pas refondre l’agence.

## Goal

Séparer les rôles hôtel de l’agence dans Better Auth (*authentication* / organisation access control) : réceptionniste et caissier distincts ; client = slug `client` (plus de `parent`) ; `guichetier` sans aucun droit `hotel_*`.

## Design

| Produit | Slug | Domaine |
|---------|------|---------|
| Owner | `owner` | Org + hôtel |
| Gérant | `gestionnaire` | Org + hôtel |
| Réceptionniste | `receptioniste` | Hôtel |
| Caissier | `caissier` | Hôtel |
| Serveur | `serveur` | Hôtel F&B |
| Client | `client` | Public (pas Admin hôtel) |
| Guichetier | `guichetier` | Agence only — hors polish ; strip `hotel_*` |

Matrices (permission-based, jamais `if role ===` seul) :

- `receptioniste` : `hotel_room:read|update`, `hotel_stay:create|update|read`
- `caissier` : `hotel_stay:read|update`, `hotel_room:read`
- `serveur` : `hotel_fnb` create/update/read
- `gestionnaire` / `owner` : `hotel_*` complets (+ `rapport:read` gérant)
- `client` : preset member only
- `guichetier` : voyage (inscription / embarquement) **sans** `hotel_*`

Supersede l’ADR units-03 qui mappait réception/caissier → `guichetier` et client → `parent`.

## Implementation

- Étendre `ORG_ROLE` / matrices dans `lib/permissions.ts` ; sync `lib/auth.ts`, `lib/auth-client.ts`, labels, catalog, formulaires membres.
- Consult Better Auth MCP avant nouveaux statements / rôles.
- Tests `lib/permissions.test.ts` : matrices hôtel + `guichetier` sans `hotel_*` + pas de slug `parent`.
- Soft migrate `Member.role` `parent` → `client` (seed).
- Seed comptes hôtel : `receptioniste@test.com`, `caissier@test.com`, `serveur@test.com` (+ owner/gérant/client) ; `BranchMember` sur branche HOTEL.
- Mettre à jour hub menus / capability flags si les checks ciblent encore `guichetier` pour l’hôtel.
- Docs : ADR dans `progress-tracker.md`, `architecture.md`.

## Dependencies

- units-03 (permissions `hotel_*` déjà déclarées).

## Verify when done

- [ ] Slugs `receptioniste`, `caissier`, `client` présents ; `parent` retiré du code actif
- [ ] `guichetier` n’a plus de permission `hotel_*`
- [ ] Matrices réception ≠ caissier (tests verts)
- [ ] Seed comptes hôtel documenté (password test)
- [ ] typecheck / permissions tests passent
- [ ] Voyage / agence non refondus (hors strip `hotel_*` sur guichetier)
