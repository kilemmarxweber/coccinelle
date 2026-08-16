# R01 — Catalogue permissions FR (access control)

| | |
|---|---|
| **Phase** | Fondations |
| **Status** | `done` |
| **Dépend de** | — |
| **Débloque** | R02, R03, R06 |

---

## Objectif visible

Le fichier `lib/permissions.ts` (et catalogue UI) expose les **99 permissions** en termes français. Les actions métier utilisent des verbes FR. La caisse distingue **Ouvrir / Fermer / Encaisser**.

## Inclus

1. Étendre `accessControlStatements` avec ressources métier (agence, hôtel, boutique, équipe) et actions FR :
   - `voir`, `ajouter`, `modifier`, `supprimer`, `partager`, `scanner`, `annuler`, `gerer`, `assigner`, `ouvrir`, `fermer`, `encaisser`
2. Mapper les libellés UI FR (`Ressource · Action`) — ex. fichier `lib/permission-labels-fr.ts` ou catalogue dédié.
3. Statements `owner` = catalogue entier + presets Better Auth `ownerAc` (organization/member/invitation/ac).
4. Retirer / déprécier progressivement l’ancienne grille figée comme **seule** source (`organizationRoleStatements` pour gestionnaire/guichetier) — les customs viennent en R02 ; garder compat lecture si besoin.
5. Documenter le mapping code ↔ libellé FR.
6. MCP Better Auth consulté avant édition des statements (compat DAC).

### Caisse (obligatoire)

```ts
caisse: ["voir", "ouvrir", "fermer", "encaisser", "modifier"]
```

Pas de `ajouter` / `create` ambigu sur caisse.

### Liste des 99 permissions

Voir plan [`../plan-roles-custom-dynamiques.md`](../plan-roles-custom-dynamiques.md) § Catalogue — recopier dans le catalogue TypeScript comme source de vérité unique.

## Hors scope

- UI matrice (R03)
- Seed OrganizationRole (R02)
- Remplacement `ROLE_CARDS` runtime (R06)

## Critères d’acceptation

1. Les 99 paires ressource×action existent dans le catalogue / statements.
2. Libellés FR disponibles pour chaque permission.
3. `caisse` expose ouvrir / fermer / encaisser séparément.
4. `owner` (statements code) couvre le catalogue métier.
5. Tests unitaires catalogue (count + présence clés caisse).
6. MCP Better Auth consulté (noter dans la PR / commit message ou commentaire unit).

## Fichiers probables

- `lib/permissions.ts`
- `lib/permission-labels-fr.ts` (ou équivalent)
- `lib/organization-role-permission-catalog.ts`
- `lib/permissions.test.ts`

## Skills & MCPs

| Type | À utiliser |
|------|------------|
| Skill | `better-auth-best-practices`, `organization-best-practices` |
| MCP | `user-better-auth` — access control statements, dynamic roles |
