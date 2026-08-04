# U02 — Capacité & anti-surbooking

| | |
|---|---|
| **Phase** | A — Fondations |
| **Status** | `done` |
| **Dépend de** | U01 (recommandé pour contexte bus/avion) |
| **Débloque** | U05, U07, U10, U11 |

---

## Objectif visible

Chaque départ a une **capacité** ; l’UI montre les **places restantes** ; une réservation qui dépasse la capacité est **refusée**.

## Scope

### Inclus

- Champ `capacitePlaces` sur `TrajetDepart` (+ défaut raisonnable bus/avion en seed)
- Fonction domaine `placesRestantes(departId)` = capacité − passagers `occupePlace`
- Contrôle **atomique** dans `create-reservation.ts` (transaction / lock) avant insert
- Affichage places restantes sur liste départs (trajets / guichet actuel)
- Message d’erreur clair si surbooking tenté

### Hors scope

- Plan de sièges avion
- UI funnel complète (U06–U07)
- Dashboard KPI (U10)

## Critères d’acceptation (testables)

1. Un départ à capacité 2 : réserver 2 adultes OK ; une 3ᵉ place est refusée avec erreur métier.
2. Un bébé (`occupePlace = false`) ne consomme pas de place.
3. Deux créations concurrentes qui satureraient la capacité : au plus une réussit (test manuel ou script).
4. L’UI affiche « X places restantes » cohérent après une vente.
5. Colis seul (`nombrePlaces = 0`) ne consomme pas de place.

## Skills & MCPs (obligatoire)

| Type | À utiliser |
|------|------------|
| Skill | `prisma-cli`, `prisma-client-api` (transactions) |
| MCP | `user-Prisma` → doc transactions / isolation |
| Skill | `next-dev-loop` — vérifier refus d’erreur en `next dev` |

## Fichiers impactés (indicatif)

- `prisma/schema.prisma`, seeds `trajetDepart`
- `lib/reservation/create-reservation.ts`
- `lib/reservation/` (nouvelle helper capacité)
- UI départs / guichet trajet section

## Comment tester

1. Seed un départ capacité basse.
2. Guichet : vendre jusqu’au plein, tenter +1.
3. Vérifier compteur places restantes à l’écran.
