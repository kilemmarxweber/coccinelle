# U18 — Admin plateforme & branding Coccinelle

| | |
|---|---|
| **Phase** | F — Polish |
| **Status** | `done` |
| **Dépend de** | U09 |
| **Débloque** | — |

---

## Objectif visible

L’**admin application** est clairement séparé du back-office agence ; la marque **Coccinelle** remplace les vestiges « Smart Church / Écodim » ; navigation finale cohérente multi-rôles.

## Scope

### Inclus

- `/admin` limité plateforme (orgs, rôles globaux Better Auth plugin **admin**)
- Liens / redirects Better Auth : `APP_ROLE.admin` → `/admin` ; org `owner` → supervision / gérant (droits max) ; `gestionnaire` → **gérant** ; `guichetier` → **guichet** ; `parent` → PWA
- Labels FR : Owner, Gérant (`gestionnaire`), Guichetier (`guichetier`), Client (`parent`)
- Checklist UAT multi-rôles (sessions Better Auth réelles)

### Hors scope

- Refonte marketing landing publique globale
- Nouvelle grille permissions (déjà U04)

## Critères d’acceptation (testables)

1. Aucune occurrence UI visible « Smart Church » dans les shells principaux.
2. `admin` → `/admin` ; `owner` → espace supervision/gérant ; `gestionnaire` → gérant ; `guichetier` → guichet ; `parent` → PWA.
3. Admin plateforme ne mélange plus CRUD transport dans sa nav.
4. Smoke des 5 personas sans cul-de-sac.
5. Redirects n’inventent pas de rôles hors `APP_ROLE` / `ORG_ROLE` (incl. `guichetier`).

## Skills & MCPs (obligatoire)

| Type | À utiliser |
|------|------------|
| Skill | `better-auth-best-practices`, `organization-best-practices` |
| MCP | `user-better-auth` — session, roles, post-login |
| Skill | `shadcn` |
| MCP | `project-0-coccinelle-shadcn` |
| Skill | `next-dev-loop` — UAT runtime |

## Fichiers impactés (indicatif)

- `components/Custom/AppSidebar.tsx`, Navbar
- `lib/auth/post-login-redirect.ts`
- Layouts admin / agence
- `app/layout.tsx` metadata

## Comment tester

1. Recherche globale UI « Smart Church » / Écodim → 0 dans shells.
2. 4 logins → 4 landing corrects.
3. Checklist UAT cochée dans un commentaire PR / bas de cette unit.

## Livré

- Metadata app : Coccinelle
- `/admin` : hub plateforme (orgs + compte), pas de métier transport
- Sidebar plateforme FR : Vue d’ensemble / Organisations / Rôles globaux
- Redirects déjà en place (`lib/auth/post-login-redirect.ts`)
- Labels rôles : `lib/org-role-labels.ts`

## Checklist UAT multi-rôles

| Persona | Compte seed (indicatif) | Landing attendu |
|---------|-------------------------|-----------------|
| Super-admin | rôle app `admin` | `/admin` |
| Owner | `owner@test.com` | `/agence/{orgId}/gerant` |
| Gérant | `gerant@test.com` | `/agence/{orgId}/gerant` |
| Guichetier | `guichetier@test.com` | `/admin/organizations/{orgId}/agences/reservations/guichet` |
| Client | `client@test.com` (`parent`) | `/{orgSlug}/mes-reservations` |
