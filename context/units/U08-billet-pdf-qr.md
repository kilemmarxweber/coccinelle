# U08 — Billet PDF / QR / impression

| | |
|---|---|
| **Phase** | B — Funnel & guichet |
| **Status** | `done` |
| **Dépend de** | U07 |
| **Débloque** | U15, U16 |

---

## Objectif visible

Depuis une réservation confirmée, l’agent (et plus tard le client) obtient un **billet** avec code réservation, codes passagers et **QR** ; impression navigateur OK.

## Scope

### Inclus

- Génération QR par passager (token / code `PASS-*` signé ou encodé — documenter le format)
- Vue billet imprimable (HTML print-ready) et/ou PDF minimal
- Boutons « Imprimer » / « Télécharger » sur fiche réservation
- Contenu : org, trajet, date/heure, passagers, montant, codes

### Hors scope

- Scan embarquement (U16 consomme le QR)
- WhatsApp share avancé (lien optionnel OK)
- Design marketing luxe

## Critères d’acceptation (testables)

1. Après vente guichet, bouton Imprimer ouvre un aperçu lisible.
2. Chaque passager a un QR scannable (contenu décodable = code passager ou URL vérif).
3. Réimpression depuis la fiche sans recréer la réservation.
4. Bébé apparaît sur le billet sans consommer de siège (mention claire).

## Skills & MCPs (obligatoire)

| Type | À utiliser |
|------|------------|
| Skill | `shadcn` (Dialog / Button) |
| Skill | `next-dev-loop` |
| MCP | `project-0-coccinelle-shadcn` |
| Doc lib QR au choix (ex. `qrcode`) — pas de MCP dédié |

## Fichiers impactés (indicatif)

- `lib/reservation/boarding-token.ts` (ou équivalent)
- Composant `ticket-print-view`
- `reservation-detail.tsx` / page post-vente guichet

## Format QR (U08 → U16)

Contenu texte du QR par passager :

- **Token signé (défaut)** : `CCNL1.<codeUnique>.<sig8>`
  - `CCNL1` = version 1
  - `codeUnique` = `PASS-*`
  - `sig8` = HMAC-SHA256(`BOARDING_TOKEN_SECRET` | `BETTER_AUTH_SECRET`, code) hex tronqué 8 car.
- **Brut accepté à la lecture** : `PASS-*` seul (pointage manuel)

Implémentation : `lib/reservation/boarding-token.ts` (`encodeBoardingToken` / `parseBoardingQrPayload`).

## Comment tester

1. Vendre → Imprimer → vérifier codes.
2. Décoder QR avec téléphone / outil.
3. Print preview CSS (pas de nav chrome sur la feuille).
