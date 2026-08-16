# U04 — Permissions rôles org (Better Auth)

| | |
|---|---|
| **Phase** | A — Fondations |
| **Status** | `done` — **évolué par** [`../units-roles/INDEX.md`](../units-roles/INDEX.md) (rôles custom DAC) |
| **Dépend de** | — |
| **Débloque** | U07, U09, U12, U15, U16, U18 |

---

## Objectif visible

Les 4 rôles produit sont correctement branchés sur Better Auth : **owner** (crée l’org), **gestionnaire** (gère l’agence), **guichetier** (vend au comptoir), **parent** (client). Chaque gate serveur passe par `auth.api.hasPermission`.

## Mapping produit → Better Auth (source de vérité)

| Rôle produit | Slug Better Auth | Qui ? | Ne fait **pas** |
|--------------|------------------|-------|-----------------|
| **Owner** | `owner` | Crée l’organisation, la supervise (super-admin **de l’org**) | — (droits max org) |
| **Gérant** | `gestionnaire` | Gère l’agence au quotidien : trajets, planning, tarifs, équipe, rapports | **Créer** une organisation |
| **Guichetier** | `guichetier` (**à ajouter** dans `ORG_ROLE`) | Personne au comptoir : réservation billets, encaissement, embarquement | Pilotage agence / création org |
| **Client** | `parent` | Voyageur : réserve en ligne, consulte ses billets | Accès guichet / gérant |

> **Ne pas confondre** avec `APP_ROLE.admin` (super-admin **plateforme**, toutes les orgs) — autre couche Better Auth (plugin admin).

### Interdit (erreur corrigée)

- ~~Gérant = `owner`~~  
- ~~Guichetier = `gestionnaire`~~  

## Source technique Better Auth

| Couche | Fichier / API |
|--------|----------------|
| Statements + rôles | `lib/permissions.ts` — `createAccessControl`, `ORG_ROLE`, `organizationRoleStatements`, `organizationRoles` |
| Plugin org | `lib/auth.ts` — `organization({ ac, roles })` ; **seul** un user autorisé crée une org (owner / règles `allowUserToCreateOrganization`) |
| Client | `lib/auth-client.ts` |
| Gate serveur | `auth.api.hasPermission({ organizationId, permissions })` |
| Helper | `lib/auth/inscription-permission.ts` (+ helper générique si besoin) |

### Interdit techniquement

- RBAC parallèle hors Better Auth
- `if (role === "…")` comme seule autorité (le slug alimente les statements ; la **permission** décide)

## Scope

### Inclus

1. Ajouter `ORG_ROLE.GUICHETIER = "guichetier"` (+ labels, catalogue, seeds).

2. Étendre `accessControlStatements` (exemple cible — valider via MCP) :

   ```ts
   inscription: ["create", "share", "update", "delete"],
   trajet: ["create", "update", "delete", "read"],
   depart: ["create", "update", "cancel", "read"],
   embarquement: ["scan", "update", "read"],
   rapport: ["read"],
   equipe: ["manage", "read"], // optionnel
   ```

3. **Grille `organizationRoleStatements`** :

   | Slug | Permissions cibles |
   |------|--------------------|
   | `owner` | Preset `ownerAc` + **toutes** les resources métier (`inscription:*`, `trajet:*`, `depart:*`, `embarquement:*`, `rapport:read`, `equipe:manage`) |
   | `gestionnaire` | Pilotage agence : `trajet:*`, `depart:*`, `rapport:read`, `equipe:manage` (ou read), `inscription: read/update/share` (supervision) — **pas** création d’org ; pas besoin de vendre au comptoir tous les jours (peut avoir `inscription:create` en backup ou non — défaut : **oui en lecture/supervision**, vente quotidienne = guichetier) |
   | `guichetier` | Vente : `inscription: create, share, update` (pas `delete` sauf décision), `depart:read`, `embarquement:scan/update/read` — **pas** `trajet:create`, **pas** `rapport:read`, **pas** `equipe:manage` |
   | `parent` | `memberAc` minimal — **pas** d’`inscription` guichet |

4. `allowUserToCreateOrganization` : **pas** pour `gestionnaire` / `guichetier` / `parent` ; réservé aux règles owner / admin plateforme (doc Better Auth).

5. Toutes les actions guichet → permission `inscription:*` pour rôle `guichetier` (et `owner` ; `gestionnaire` selon grille ci-dessus).

6. Documenter le mapping dans INDEX + labels UI FR (`Gérant`, `Guichetier`, `Owner`, `Client`).

### Hors scope

- Shells UI (U07, U09)
- Renommer le slug historique `parent` (garder pour le client)

## Critères d’acceptation (testables)

1. `guichetier` : `hasPermission({ inscription: ["create"] })` → true ; vente guichet OK.
2. `parent` : même check → false ; guichet refusé.
3. `gestionnaire` : peut gérer trajets / planning / rapports ; **ne peut pas** créer une organisation.
4. `owner` : crée l’org + tous les droits org ; supervise.
5. `guichetier` : **pas** d’accès rapports gérant (`rapport:read` → false).
6. Aucun gate réservation sans `hasPermission` (ou helper).
7. MCP Better Auth consulté avant édition de `lib/permissions.ts`.

## Suite (rôles custom)

U04 a posé la grille figée owner / gestionnaire / guichetier / parent.  
La suite produit est dans [`../plan-roles-custom-dynamiques.md`](../plan-roles-custom-dynamiques.md) : seuls `admin` / `user` / `owner` restent système ; le reste est custom + matrice FR + équipe par branche (units R01–R07).

## Skills & MCPs (obligatoire)

| Type | À utiliser |
|------|------------|
| Skill | `better-auth-best-practices` — **lire en premier** |
| Skill | `organization-best-practices` — roles, `ac`, `hasPermission`, création d’org |
| Skill | `better-auth-security-best-practices` |
| MCP | `user-better-auth` → `search_docs` / `get_doc` : organization permissions, access control, `hasPermission`, `allowUserToCreateOrganization` |

## Fichiers impactés (indicatif)

- `lib/permissions.ts` — ajout `guichetier`
- `lib/auth.ts` / `lib/auth-client.ts`
- `lib/auth/inscription-permission.ts`
- `lib/organization-role-permission-catalog.ts`, `lib/org-role-labels.ts`
- Seeds membres (owner, gestionnaire, guichetier, parent)
- Actions réservations (gates)

## Comment tester

1. 4 comptes : owner, gestionnaire, guichetier, parent.
2. Owner crée une org.
3. Gestionnaire : CRUD trajet OK ; createOrganization refusé.
4. Guichetier : vente OK ; page rapports refusée.
5. Parent : PWA OK ; guichet refusé.
