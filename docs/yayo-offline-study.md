# CAFE YAYO — étude hors-ligne / synchronisation (CDC §17)

## Décision phase 1

Pas de POS offline en Y1. Un encaissement hors-ligne mal fusionné crée des **doubles ventes** et casse la formule stock / caisse.

## Cible (phase 3)

- File locale d’opérations (IndexedDB) avec `idempotencyKey` = UUID généré au tap « Encaisser ».
- Sync : `POST` Server Action ; si la clé existe déjà → 200 no-op, pas de second `ShopSale`.
- Conflits stock : le serveur reste source de vérité ; le client affiche « stock insuffisant » au replay.
- Mobile Money / banque restent `PENDING` jusqu’à confirmation en ligne.

## PWA existante

La PWA Coccinelle couvre le funnel voyage (recherche / billets). Elle n’est **pas** réutilisée pour le POS campus.

## Recette hors-ligne (quand Y3)

1. Couper le réseau, tenter un encaissement → file locale visible.
2. Reconnecter → une seule vente, stock diminué une fois.
3. Rejouer la même clé → aucun second ticket.
