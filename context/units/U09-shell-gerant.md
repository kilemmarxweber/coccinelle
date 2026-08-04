# U09 — Shell navigation gérant

| | |
|---|---|
| **Phase** | C — Espace gérant |
| **Status** | `done` |
| **Dépend de** | U04 |
| **Débloque** | U10, U11, U12, U18 |

---

## Objectif visible

Le **gérant** (slug Better Auth `gestionnaire`) arrive dans un espace dédié avec une **navigation métier** (Vue d’ensemble, Planning, Trajets, Réservations, Équipe, Rapports) distincte du guichet et de l’admin plateforme. Il **gère** l’agence ; il **ne crée pas** l’organisation (`owner` seul).

## Scope

### Inclus

- Layout / sidebar gérant (chemins cibles `/agence/[orgId]/gerant/...` **ou** restructuration claire sous org existante — documenter la convention)
- Menu items selon matrice + permissions Better Auth (`rapport:read`, `trajet:*`, `depart:*` pour `gestionnaire` / `owner`)
- Redirect post-login : `gestionnaire` → espace gérant ; `owner` peut aussi y accéder (supervision)
- Pages placeholder si sous-modules pas encore livrés
- Member `guichetier` **ne voit pas** le menu gérant complet (`hasPermission` échoue sur `rapport:read` / `trajet:create`)

### Hors scope

- Contenu dashboard (U10)
- Contenu planning (U11)
- Branding final Coccinelle (U18)
- Création d’organisation (réservée `owner` / admin plateforme)

## Convention de chemins (livrée)

Espace gérant : **`/agence/[orgId]/gerant/...`** (hors `/admin`).

Helpers : `lib/agence/routes.ts`. Sidebar dédiée : `components/Custom/GerantSidebar.tsx` (séparée de `AppSidebar` admin plateforme).

Gate shell : `rapport:read` via `lib/auth/gerant-access.ts` → `assertOrganizationPermission` / Better Auth `hasPermission`. Guichetier → redirect guichet legacy.

---

## Critères d’acceptation (testables)

1. Login `gestionnaire` → shell gérant avec au moins 5 entrées de menu.
2. Login `guichetier` → pas d’accès (ou menu réduit) aux pages gérant.
3. Login `gestionnaire` : impossible de créer une nouvelle organisation.
4. Navigation shell sans casser la session org Better Auth.
5. Titre / branding : plus de « Smart Church » sur cet espace.

## Skills & MCPs (obligatoire)

| Type | À utiliser |
|------|------------|
| Skill | `organization-best-practices` |
| Skill | `better-auth-best-practices` (session / redirect / permissions) |
| Skill | `shadcn` (Sidebar) |
| MCP | `user-better-auth` |
| MCP | `project-0-coccinelle-shadcn` |

## Fichiers impactés (indicatif)

- Nouveau layout `app/agence/...` ou refactor `agences/layout`
- `lib/auth/post-login-redirect.ts`
- `components/Custom/AppSidebar.tsx` (séparation)

## Comment tester

1. Comptes `gestionnaire` / `guichetier` / `owner` : menus et droits conformes au mapping U04.
2. Chaque lien du shell : 200 ou placeholder contrôlé.
