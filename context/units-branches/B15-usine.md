# B15 — Branche Usine (eau / vins · crédit · marketeur)

| | |
|---|---|
| **Phase** | B4+ (commerce) |
| **Status** | `done` |
| **Dépend de** | B01, B02, B03, B11, paie commerce, service stock, bons de commande |
| **Plan** | [`../plan-usine-production-commerce.md`](../plan-usine-production-commerce.md) |

## Objectif

Nouveau `BranchType.USINE` : production **eau** et/ou **vins**, vente **cash / crédit**, rôle **marketeur**, stock dépôt + float (comme resto), **paie & bulletins** identiques à `BOUTIQUE`. Consommables uniquement via BC + **fournisseur enregistré**.

## Phases (voir le plan)

| Phase | Contenu | Status |
|-------|---------|--------|
| **U0** | Enum + flags + hub paie commerce | `done` |
| **U1** | Fournisseurs + BC | `done` |
| **U2** | Recettes + lots | `done` |
| **U3** | Float marketeur | `done` |
| **U4–U6** | Crédit, tranches, réservations, WhatsApp | `done` |
| **U7** | POS cash | `done` |
| **U8** | Rôle marketeur | `done` |
| **U9** | Rapports | `done` |

## Critères smoke

1. Usine créée (eau et/ou vins) → paie comme boutique.  
2. BC fournisseur → dépôt consommables.  
3. Lot → finis au dépôt.  
4. Float marketeur → cash et crédit.  
5. Crédit : identité client, document, échéance, WhatsApp, acompte/complément/solde, prolongation. Réservation : tout client.
