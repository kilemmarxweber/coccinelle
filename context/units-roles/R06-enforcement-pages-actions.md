# R06 — Enforcement pages & actions (catalogue)

| | |
|---|---|
| **Phase** | Sécurité runtime |
| **Status** | `done` |
| **Dépend de** | R01, R04 |
| **Débloque** | R07 |

---

## Objectif visible

Le hub, les pages et les **server actions** (hôtel, caisse, purchases, partners, agence…) respectent le catalogue de permissions. Un serveur **sans** Caisse · Encaisser ne peut pas encaisser même en appelant l’action. `ROLE_CARDS` / `canSeeDashCard` ne sont plus la source d’autorité (migration ou suppression).

## Inclus

1. Helper : `assertOrganizationPermission` (ou dérivé) avec clés FR du catalogue R01.
2. Hub : filtrer menus si **Ressource · Voir**.
3. Pages hospitalité manquantes : gate équivalent `requireDashCard` → permission `voir` (chambres, salles, bons, dépenses, rapports, note séjour, reçu…).
4. Actions :
   - `lib/cash/actions.ts` — ouvrir / fermer / encaisser / voir séparés
   - `lib/hotel/actions.ts`, `service-stock.ts`
   - `lib/purchases/actions.ts`, `lib/partners/actions.ts`
   - Agence déjà gated : aligner sur verbes FR si statements changés
5. Toujours combiner avec `canAccessBranch` (appartenance établissement).
6. Platform `admin` : bypass org (comportement actuel).
7. Déprécier `lib/branch/ops-roles.ts` ROLE_CARDS une fois remplacé.

## Hors scope

- UI création rôles (déjà R03–R05)
- Refonte UX complète des modules

## Critères d’acceptation

1. Rôle Serveur (preset) : restauration OK ; `openCashSession` / encaisser → refus serveur.
2. Rôle Caissier : ouvrir + encaisser OK ; sans `caisse.ouvrir` seul `encaisser` possible si configuré ainsi.
3. URL directe `/hotel/chambres` sans Chambres · Voir → redirect hub.
4. `getActiveExchangeRate` / mutations taux : Taux de change · Voir / Modifier.
5. Plus aucune mutation hôtel critique sur `canAccessBranch` seul.

## Fichiers probables

- `lib/auth/organization-permission.ts`
- `lib/branch/require-branch-context.ts`
- `lib/branch/branch-menus.ts`
- `lib/cash/actions.ts`, `lib/hotel/**`, `lib/purchases/**`, `lib/partners/**`

## Skills & MCPs

| Type | À utiliser |
|------|------------|
| Skill | `better-auth-best-practices`, `organization-best-practices`, `next-dev-loop` |
| MCP | `user-better-auth` |
