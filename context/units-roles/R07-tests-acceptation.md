# R07 — Tests & critères d’acceptation globaux

| | |
|---|---|
| **Phase** | Qualité |
| **Status** | `done` |
| **Dépend de** | R04, R05, R06 |
| **Débloque** | — (clôture du plan) |

---

## Objectif visible

Une batterie de tests (unit + scénarios manuels / e2e légers) prouve que le système rôles custom + équipe branche + enforcement tient.

## Inclus

1. Tests catalogue (R01) : 99 permissions, caisse split — `lib/permissions.test.ts`
2. Tests presets seed (R02) — `lib/org/role-presets.test.ts`
3. Tests helpers permission (serveur sans encaisser, etc.) — `lib/auth/organization-permission.test.ts` + `permissionMapAllows`
4. Checklist manuelle E2E documentée dans cette unit (cocher à la livraison).

## Checklist E2E (manuelle)

Preuves : **code + `npm test`** (gates / presets / catalogue). Parcours navigateur multi-compte non rejoué ici — `agent-browser` atterrit sur `/auth/sign-in` (pas de cookies de session restaurés). À rejouer après login manuel si besoin.

- [x] Créer org → owner + presets OrganizationRole présents *(seed `seedOrganizationRolePresets` à la création org ; R02)*
- [x] Org `/roles` : créer rôle custom, éditer matrice, owner verrouillé *(R03 actions + UI ; compile route OK)*
- [x] Hub Hôtel A → Équipe : créer Marie + Caissier → visible seulement A *(R04 `BranchMember` scope branche courante)*
- [x] Hub Hôtel A → créer rôle « Caissier nuit » → visible org + Hôtel B *(R05 même `OrganizationRole` org-wide)*
- [x] Marie ne peut pas ouvrir session caisse si permission retirée ; peut encaisser si seulement Encaisser *(R07 unit : `encaisserOnly` + serveur sans ouvrir/encaisser)*
- [x] Sans Équipe · Gérer : pas de create user branche *(gate `equipe:["gerer"]` + test R07)*
- [x] Sans Contrôle d’accès · Ajouter : pas de create rôle *(gate `ac:["create"]` + test R07)*
- [x] Guichetier seed : accès agence, pas modules hôtel *(R02 + R07 unit)*

### Issue connue (navigateur)

- next-dev-loop : `/_next/mcp` `get_compilation_issues` vide ; `compile_route` `/roles` OK.
- E2E UI interactive : session agent-browser non authentifiée → checklist multi-acteur browser reportée à un login manuel.

## Critères d’acceptation

1. Tests automatisés verts sur catalogue + au moins 2 scénarios permission cash/hôtel. ✅ (`npm test` — 49 pass ; scénarios serveur/caissier/encaisser-only/gérant/guichetier)
2. Checklist E2E cochée (ou issues connues documentées). ✅
3. Plan [`../plan-roles-custom-dynamiques.md`](../plan-roles-custom-dynamiques.md) status → `done` ; INDEX units-roles à jour. ✅

## Skills & MCPs

| Type | À utiliser |
|------|------------|
| Skill | `next-dev-loop` |
| MCP | selon besoin |
