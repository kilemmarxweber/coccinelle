# U14 — PWA checkout (draft + passagers + colis)

| | |
|---|---|
| **Phase** | D — Client en ligne |
| **Status** | `done` |
| **Dépend de** | U13, U03 |
| **Débloque** | U15 |

---

## Objectif visible

Depuis un départ, le client entre dans un **checkout** avec brouillon (`ReservationDraft`), saisit passagers et options colis (destinataire), récap prix vivant.

## Scope

### Inclus

- Création / reprise `ReservationDraft` (token URL, expiration)
- Route `/[orgSlug]/checkout/[draftToken]`
- Étapes Passagers + Options (stepper U06)
- Validation Zod alignée domaine ; plafonds places en ligne
- Sauvegarde auto draft (debounce)
- CTA vers étape paiement (U15) sans créer encore la réservation finale si paiement pas confirmé

### Hors scope

- Encaissement réel (U15)
- PDF

## Critères d’acceptation (testables)

1. « Continuer » depuis détail → draft créé, URL avec token.
2. Refresh page → données passagers restaurées tant que non expiré.
3. Token expiré → message + retour recherche.
4. Colis sans destinataire → bloqué (U03).
5. Nb places &gt; restantes → bloqué (U02).

## Skills & MCPs (obligatoire)

| Type | À utiliser |
|------|------------|
| Skill | `prisma-client-api` (`ReservationDraft`) |
| MCP | `user-Prisma` |
| Skill | `shadcn` (forms) |
| MCP | `project-0-coccinelle-shadcn` |
| Skill | `next-dev-loop` |

## Fichiers impactés (indicatif)

- `app/[orgSlug]/checkout/**`
- Actions draft create/update
- `lib/reservation/` extensions

## Comment tester

1. Remplir passagers → F5 → données présentes.
2. Attendre / forcer expiration → comportement clair.
3. Tentative surbooking depuis draft.
