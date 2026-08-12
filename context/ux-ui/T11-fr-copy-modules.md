# T11 — FR + copy modules

| Meta | |
|------|--|
| **Id** | `fr-copy-modules` |
| **Dépendances** | T08, T10 utiles |
| **Estimation** | M |

## Objectif

Franciser séjours / caisse (et sous-titres bons / dépenses) ; rendre sous-titres, légendes et empty states intuitifs.

## Fichiers touchés

- `app/admin/organizations/[organizationId]/branches/[branchId]/hotel/sejours/sejours-client.tsx`
- `app/admin/organizations/[organizationId]/branches/[branchId]/caisse/caisse-client.tsx`
- `app/admin/organizations/[organizationId]/branches/[branchId]/bons-commande/bons-commande-client.tsx`
- `app/admin/organizations/[organizationId]/branches/[branchId]/depenses/depenses-client.tsx`

## Skills

1. shadcn si retouche layout actions (`w-full sm:w-auto`).
2. Ne pas renommer ids code (`HubTab`, `STATUS.NO_SHOW`, etc.) — chaînes UI seulement.

## MCP

- Prisma **interdit**.

## Lexique

| Actuel | Nouveau |
|--------|---------|
| Check-in | Arrivée |
| Check-out | Départ |
| No-show | Non-présentation |
| F&B | Restauration |

## Étapes

1. **Séjours** : sous-titre chrome, légende calendrier, `STATUS_LABEL`, boutons, toasts, empty states → FR intuitif.
   - Sous-titre cible : `Calendrier des chambres · arrivées et départs` (taux change en complément court si besoin).
2. **Caisse** : onglets / badges / empty « F&B » → Restauration ; Check-out → Départ.
3. **Bons** : subtitle → ex. `Commandes fournisseurs de cet établissement · stock mis à jour à la validation`.
4. **Dépenses** : subtitle → ex. `Sorties d’argent, dépôts et prêts · un document à signer`.
5. Empty states : titre = état, description = prochaine action, CTA inchangé si déjà FR.
6. Optionnel : CTA primaires actions chrome `w-full sm:w-auto` si débordement mobile.

## Hors scope

- Refonte complète des rapports.
- Renommage routes URL / query `tab=fnb`.

## Critères de done

- UI sans Check-in / Check-out / F&B / No-show EN.
- Empty states actionnables en FR.

## Vérif

Parcourir séjours (agenda + liste), caisse, bons, dépenses — light et dark.
