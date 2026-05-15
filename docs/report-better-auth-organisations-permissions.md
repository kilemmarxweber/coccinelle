# Rapport d’audit — Better Auth : organisations, rôles et permissions

**Périmètre :** implémentation actuelle au stade MVP (plugins `admin` + `organization`, contrôle d’accès personnalisé, rôles dynamiques par organisation).

**Références MCP :**

- Better Auth : `search-better-auth-docs`, `ask-question-about-better-auth` ([Organizations](https://better-auth.com/docs/plugins/organization), [Admin](https://better-auth.com/docs/plugins/admin)).
- Next.js DevTools : `nextjs_docs` — conventions Next.js **16.x** ([Proxy — Getting Started](https://nextjs.org/docs/app/getting-started/proxy), référence fichier [proxy.js](https://nextjs.org/docs/app/api-reference/file-conventions/proxy)).

---

## 1. Synthèse exécutive

Le projet va **nettement au-delà** du gabarit minimal Better Auth : matrices de permissions applicatives et par organisation, rôles dynamiques persistés (`organizationRole`), validation des payloads JSON de permissions, garde-fous métier (escalade de rôles, alignement avec l’organisation active) et journaux d’audit sur les routes métier sous `app/api/admin/`.

Les principaux axes d’amélioration sont : **(a)** double vocabulaire de permissions (ressources par défaut du plugin vs ressources métier `organizationMembers` / `domain*`), **(b)** préférer, côté serveur, les API officielles `auth.api.hasPermission` pour l’org quand c’est possible afin de rester aligné avec le moteur Better Auth (rôles dynamiques inclus), **(c)** compléter le client (`ac` / `roles`) si vous vous appuyez fortement sur `checkRolePermission` côté UI — et **(d)** garder les commentaires / guides à jour avec Next.js 16 (voir §3.1 : **`middleware` → `proxy`**).

---

## 2. Ce qui est concrètement en place

### 2.1 Configuration serveur (`lib/auth.ts`)

- **Better Auth** avec adaptateur Prisma et secrets / `baseURL` via `lib/env`.
- **Plugin `admin`** avec `createAccessControl` : fusion des `defaultStatements` admin, des statements par défaut **organization** du package, et de vos **statements personnalisés** (`customPermissionStatements` depuis `lib/permissions.ts`).
- **Plugin `organization`** avec :
  - même instance `ac` (requis pour le contrôle d’accès dynamique, conforme à la doc),
  - `dynamicAccessControl: { enabled: true }`,
  - `creatorRole: ORG_ROLE.OWNER` (`owner`),
  - cartographie explicite des rôles statiques (`owner`, `orgAdmin`, `orgManager`, `member`, rôles « legacy » `admin` / `custom`).

### 2.2 Client (`lib/auth-client.ts`)

- `adminClient()` et `organizationClient({ dynamicAccessControl: { enabled: true } })` — cohérent avec le serveur pour l’activation du stockage des rôles dynamiques (table `organizationRole`, voir doc [Dynamic Access Control](https://better-auth.com/docs/plugins/organization#dynamic-access-control)).

### 2.3 Modèle de données (Prisma)

- Tables attendues pour le plugin organization : `Organization`, `Member`, `Invitation`, session avec `activeOrganizationId`, etc.
- Table **`organizationRole`** avec champ `permission` en `Json` — aligné avec le mode rôles dynamiques.

### 2.4 Couche « permissions métier » (`lib/permissions.ts`)

- Ressources applicatives personnalisées : `globalUsers`, `globalRoles`, `globalAudit`, `organizationMembers`, `organizationOrgRoles`, `domainEvents`, `domainAttendance`.
- **Matrices** `appRolePermissionMatrix` et `organizationRolePermissionMatrix` pour les rôles **statiques** (app + org).
- Règles pour les routes admin Better Auth (`ADMIN_AUTHZ_ROUTE_RULES`, `getAdminAuthzRequiredForEndpoint`) — invoquées depuis **`proxy.ts`** (convention Next.js 16, voir §3.1).
- Gouvernance des noms de rôles : `RESERVED_ORGANIZATION_ROLES`, `IMMUTABLE_ORGANIZATION_ROLES`, hiérarchie `ORGANIZATION_ROLE_POWER` / `canManageTargetOrganizationRole`.

### 2.5 Autorisation serveur réutilisable (`lib/authorization.ts`)

- `requireGlobalPermission` — basé sur le rôle utilisateur global et la matrice statique.
- `requireOrganizationPermission` — enchaîne :
  1. membre + rôle dans `Member`,
  2. si insuffisant selon la matrice statique org, chargement du rôle dynamique `organizationRole` et évaluation via `sanitizeOrganizationRolePermission` + `hasRequiredOrganizationPermissions`.
- `requireAnyPermission` — union de contrôles global / organisation.

### 2.6 Rôles dynamiques — API d’administration dédiées

- **`app/api/admin/organization-roles/route.ts`** — proxy sécurisé vers `auth.api.listOrgRoles`, `createOrgRole`, `updateOrgRole`, `deleteOrgRole` avec contrôles supplémentaires (org active, réservation des noms, immutabilité, comptage des membres avant suppression, validation des permissions JSON).
- **`app/api/admin/organization-roles/assign/route.ts`** — assignation via `auth.api.updateMemberRole` avec anti-escalade et contrôle `organizationOrgRoles: ["assign"]`.
- **`app/api/admin/organization-members/`** — onboarding via `auth.api.addMember` avec mêmes principes (+ audit).

### 2.7 Validation des permissions JSON (`lib/organization-role-permissions.ts`)

- Catalogue autorisé pour les rôles dynamiques : sous-ensemble aligné avec les actions org + domaines (pas les ressources globales-only), normalisation défensive et messages d’erreur structurés.

### 2.8 Tests automatisés

- `tests/permissions.test.ts` et `tests/role-governance.test.ts` couvrent une partie importante des matrices et règles de gouvernance.

---

## 3. Points de vigilance ou écarts

### 3.1 Next.js 16 : `middleware` remplacé par **`proxy`** (correction)

D’après la documentation Next.js **16.2.x** (via MCP **Next.js DevTools**, `nextjs_docs`) :

- La convention **`middleware.ts` / `export function middleware`** est **dépréciée** et renommée en **`proxy.ts` / `export function proxy`** (fonctionnalité équivalente, changement de nom pour clarifier le rôle « proxy réseau » devant l’app).
- Un seul fichier `proxy.ts` à la racine (ou dans `src/` si l’app est sous `src`) est pris en charge par le framework — **sans** fichier `middleware.ts` séparé.

**Constat sur ce dépôt :** la racine contient déjà `proxy.ts` avec `export async function proxy` et `export const config.matcher` — ce qui est **conforme** à Next.js 16. L’absence de `middleware.ts` n’est donc **pas** un oubli de branchement : c’est le modèle actuel.

À noter côté doc Next.js :

- Le **Proxy** utilise par défaut le **runtime Node.js** (plus seulement Edge) — la doc décourage toutefois d’y faire du chargement lent / une auth complète ; l’enforce fin doit rester dans les routes, Server Actions et Better Auth.
- Les routes **`/api/auth/organization/*`** laissées en `NextResponse.next()` dans votre `proxy.ts` restent un **choix produit** (logique org + Prisma dans les handlers / `authorization.ts`), pas une exigence Edge imposée par Next 16.

**Recommandation :** si un ancien guide interne parle encore de « ajouter un `middleware.ts` », le mettre à jour vers **`proxy.ts`** et, pour les projets existants, utiliser le codemod officiel `npx @next/codemod@canary middleware-to-proxy .` (cf. [Migration to Proxy](https://nextjs.org/docs/app/api-reference/file-conventions/proxy#migration-to-proxy)).

### 3.2 Deux systèmes de noms de ressources pour l’organisation

La doc officielle décrit les ressources par défaut **`organization`**, **`member`**, **`invitation`** avec des actions courtes (`create`, `update`, …) — cf. section *Permissions* de la doc Organization.

Le projet utilise en parallèle des ressources **métier** (`organizationMembers`, `organizationOrgRoles`, …), fusionnées dans le même `ac` que les défauts. C’est valide tant que tout est déclaré dans `createAccessControl`, mais cela crée :

- une **dissymétrie UI / serveur** : par exemple dans `use-organization-management.ts`, le bouton de test appelle `authClient.organization.hasPermission({ permissions: { member: ["create"] } })` (vocabulaire **member** du plugin), alors que les routes custom exigent `organizationMembers: ["create"]` dans vos matrices ;
- un risque de confusion pour les mainteneurs et pour les payloads de rôles dynamiques si la doc interne ne précige pas quel vocabulaire utiliser où.

**Recommandation :** documenter un **canon** (idéalement un seul vocabulaire pour les nouvelles fonctionnalités) ou fournir des helpers TypeScript qui mappent `member.*` ⇄ `organizationMembers.*` si vous devez conserver les deux pour compatibilité Better Auth.

### 3.3 Double implémentation des contrôles d’accès organisation

Les helpers dans `authorization.ts` recalculent les droits (matrice statique + JSON dynamique) au lieu d’utiliser systématiquement `auth.api.hasPermission` avec les en-têtes de session.

Selon les réponses du support Better Auth (MCP), le **modèle recommandé** pour les routes custom est d’**appeler `auth.api.hasPermission` côté serveur**, ce qui réutilise le même moteur que le plugin (y compris pour les rôles dynamiques), tout en gardant vos règles métier (escalade, org active) en couche additive.

Ce n’est **pas faux** comme implémentation actuelle (elle est même très explicite), mais elle augmente le risque de **désynchronisation** si Better Auth évolut les règles internes ou si vous enrichissez `ac`.

### 3.4 Client Organization : `ac` et `roles` non passés au `organizationClient`

La documentation illustre souvent : `organizationClient({ ac, roles: { … }, dynamicAccessControl: … })` pour la cohérence typage / `checkRolePermission`.

Ici, seul `dynamicAccessControl` est passé. Les appels réseau (`hasPermission`, CRUD org) fonctionnent généralement, mais le **rôle des helpers purement clients** peut être incomplet sans `ac`/`roles`.

### 3.5 Sémantique des permissions sur `PATCH` rôle dynamique

La mise à jour d’un rôle dynamique réutilise `organizationOrgRoles: ["create"]` comme condition d’autorisation. Fonctionnellement ça peut correspondre au pouvoir « gérer la définition des rôles », mais le nom **`create`** pour une **mise à jour** est trompeur pour la lecture du code et les audits.

### 3.6 Options Better Auth non exploitées

- **`organizationHooks`** (before/after membres, rôles, invitations) : vous centralisez plutôt la logique dans des routes `/api/admin/*`; les hooks pourraient dupliquer ou compléter (par ex. même règle d’escalade si quelqu’un appelle directement l’endpoint natif Better Auth).
- **`dynamicAccessControl.maximumRolesPerOrganization`** : non limité — à envisager selon produit/offre.

### 3.7 Documentation README vs outillage

Le README indique `npm` alors que votre convention de projet est **pnpm** — anecdote de DX, mais source d’erreurs pour les contributeurs.

---

## 4. Recommandations prioritaires

| Priorité | Action |
|---------|--------|
| Haute | Unifier ou **documenter clairement** le double vocabulaire (`member` vs `organizationMembers`, etc.) et aligner les tests UI (`hasPermission`) sur les mêmes clés que le serveur. |
| Moyenne | Évaluer le remplacement progressif de la logique dans `requireOrganizationPermission` par des appels à **`auth.api.hasPermission`** (en conservant escalade + org active en surcouche). |
| Moyenne | Passer **`ac` (+ `roles` si besoin)** au `organizationClient` pour coller au guide officiel et sécuriser l’usage de `checkRolePermission`. |
| Basse | Renommer ou documenter l’usage de **`organizationOrgRoles: ["create"]`** pour les mises à jour, ou introduire une action dédiée dans `ac` si le modèle le permet. |
| Basse | Envisager **`maximumRolesPerOrganization`** et **`organizationHooks`** pour les invariantes métier également valables sur les endpoints natifs. |

---

## 5. Conclusion

Le socle Better Auth (**admin + organization + contrôle d’accès dynamique**) est correctement configuré et la base de données supporte bien le modèle MVP. Les **routes custom** sous `app/api/admin/` démontrent une bonne conscience sécurité (validation, audit, anti-escalade).

Les améliorations les plus impactantes pour une revue sérieuse sont : **réduction de la divergence de vocabulaire** entre plugin Better Auth et vos ressources métier, et **réalignement avec les primitives `hasPermission` du serveur** pour limiter la dette de logique dupliquée — en conservant `proxy.ts` comme couche optionnelle conforme à Next.js 16 (sans confondre avec l’ancien nom `middleware`).

---

*Document généré pour accompagner la revue MVP — peut être annexé au statut technique existant (`docs/technical-status.md`).*
