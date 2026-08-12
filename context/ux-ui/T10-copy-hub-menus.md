# T10 — Copy hub menus + welcome

| Meta | |
|------|--|
| **Id** | `copy-hub-menus` |
| **Dépendances** | T02 |
| **Estimation** | M |

## Objectif

Descriptions des cartes hub **faciles à comprendre** (action / bénéfice), en français, sans jargon ni sigles EN.

## Fichiers touchés

- `lib/branch/branch-menus.ts` — toutes les `description` (hotel / boutique / agence) + libellés rapports trop jargon
- `app/admin/organizations/[organizationId]/branches/[branchId]/branch-dashboard.tsx` — phrase d’accueil

## Skills

1. UX copy only — pas de skill shadcn obligatoire sauf retouche layout welcome.
2. Principes : 1 phrase ~12–15 mots ; verbe d’action ; vocabulaire terrain ; cohérence lexique Accueil/Arrivée/Départ/Restauration.

## MCP

- Aucun requis.
- Prisma **interdit**.

## Étapes

1. Réécrire **toutes** les `description` des cartes hub. Exemples cibles :

| Titre | Après |
|-------|--------|
| Séjours | Réserver une chambre, enregistrer une arrivée ou un départ. |
| Restauration | Prendre une commande et suivre l’addition. |
| Cuisine | Voir les plats à préparer et les marquer prêts. |
| Caisse & Ventes | Ouvrir la caisse et encaisser séjours ou restauration. |
| Bons de commande | Commander chez un fournisseur puis valider à la caisse. |
| Dépenses | Noter une sortie d’argent ou un prêt propriétaire. |
| Produits | Gérer la carte, les prix et le stock cuisine. |
| Service stock | Ouvrir / clôturer le stock du vendeur. |
| Livraison | Enregistrer les livraisons et compter le stock. |
| Taux de Change | Mettre à jour le taux dollar / franc. |

2. Passer les cartes boutique / agence / rapports : remplacer F&B, POS, float, « deltas », etc.
3. Welcome hub : phrase plus directe (ex. « Choisissez une action pour commencer. »).

## Hors scope

- Sous-titres des pages modules (→ T11).
- Changer les `href` / icônes / permissions.

## Critères de done

- Aucun `check-in`, `F&B`, `float`, `POS` dans les descriptions hub.
- Chaque carte = 1 phrase claire actionnable.

## Vérif

Ouvrir le hub ~390px ; chaque carte se comprend en &lt; 2 s.
