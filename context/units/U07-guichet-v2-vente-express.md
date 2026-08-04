# U07 — Guichet V2 + vente express

| | |
|---|---|
| **Phase** | B — Funnel & guichet |
| **Status** | `done` |
| **Dépend de** | U03, U04, U05, U06 |
| **Débloque** | U08 |

---

## Objectif visible

L’agent vend via un **funnel airline accéléré** (recherche → client → passagers → colis → paiement → confirmation) avec mode **Vente express** (départ du jour → cash → confirmation).

## Scope

### Inclus

- Refonte UI guichet sur composants U06 + moteur U05
- Étapes linéaires avec bandeau places restantes
- Raccourci colis seul + destinataire (U03)
- Mode express : présélection départs du jour, espèces par défaut
- Home guichet minimal (CTA Vendre + 5 dernières ventes si simple)
- Respect permissions **Better Auth** (U04) : actions vente via `hasPermission` — rôle produit Guichetier = slug **`guichetier`** (pas `gestionnaire`)

### Hors scope

- PDF/QR (U08)
- Routes `/agence/.../guichet` finales si migration path trop large — acceptable de rester sous chemin agences actuel **si** UX funnel livrée
- Embarquement (U16)

## Critères d’acceptation (testables)

1. Parcours complet : 1 adulte cash sur départ du jour → réservation `CONFIRME` / paiement `PAYE`.
2. Mode express : ≤ 90 s pour un agent entraîné (smoke manuel chronométré).
3. Départ plein : impossible de finaliser (message U02).
4. Colis seul avec destinataire OK.
5. Member Better Auth `guichetier` peut compléter le parcours ; `parent` est refusé ; `gestionnaire` n’est pas le persona principal de cet écran (U04 / `hasPermission`).
6. Ancien wizard monolithe remplacé ou redirigé vers le nouveau.

## Skills & MCPs (obligatoire)

| Type | À utiliser |
|------|------------|
| Skill | `shadcn` |
| MCP | `project-0-coccinelle-shadcn` |
| Skill | `organization-best-practices`, `better-auth-best-practices` — gates `hasPermission` uniquement |
| MCP | `user-better-auth` si doute sur le check permission |
| Skill | `next-dev-loop` |
| Skill | `prisma-client-api` (création via domaine existant) |

## Fichiers impactés (indicatif)

- `app/.../reservations/guichet/**`
- `components/funnel/**`
- Actions réservations

## Comment tester

1. Login guichetier → Vendre → express.
2. Login owner (droits max) → même parcours + colis si permission.
3. Tentative surbooking.
4. Login gestionnaire (gérant) : pas le parcours cible guichet (ou accès limité selon grille U04).
5. Login parent → refusé.
