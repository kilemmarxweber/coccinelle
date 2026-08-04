# U03 — Destinataire colis

| | |
|---|---|
| **Phase** | A — Fondations |
| **Status** | `done` |
| **Dépend de** | — |
| **Débloque** | U07, U14, U17 |

---

## Objectif visible

Lorsqu’un colis est ajouté (avec ou sans passager), l’agent / client doit renseigner **qui récupère** le colis à destination ; ces infos sont stockées et visibles sur la fiche.

## Scope

### Inclus

- Champs `destinataireNom`, `destinataireTel`, `destinataireId` (pièce) sur `Colis`
- Validation Zod : obligatoires si colis présent
- Section guichet colis mise à jour
- Affichage destinataire sur détail réservation / colis

### Hors scope

- Workflow statuts colis complets (U17)
- Compte utilisateur pour le destinataire
- PWA options colis (U14 réutilisera les champs)

## Critères d’acceptation (testables)

1. Réservation avec colis sans destinataire → validation refusée.
2. Réservation colis seul avec destinataire → créée ; champs visibles en détail.
3. Réservation sans colis → pas d’exigence destinataire.
4. Migration appliquée ; seeds colis mis à jour si présents.

## Skills & MCPs (obligatoire)

| Type | À utiliser |
|------|------------|
| Skill | `prisma-cli`, `prisma-client-api` |
| Skill | `shadcn` — Field / Input |
| MCP | `user-Prisma` (champs modèle) |
| MCP | `project-0-coccinelle-shadcn` |

## Fichiers impactés (indicatif)

- `prisma/schema.prisma`, `prisma/seeds/colis.seed.ts`
- `lib/reservation/schema.ts`, `create-reservation.ts`
- `.../guichet/guichet-colis-section.tsx`
- `.../reservation-detail.tsx`

## Comment tester

1. Guichet : tenter colis sans destinataire → erreur.
2. Remplir destinataire → succès + affichage fiche.
