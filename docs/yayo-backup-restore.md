# CAFE YAYO — sauvegarde et restauration PostgreSQL

Procédure testable (livrable CDC §19). Base locale `coccinel` (voir `.env` `DATABASE_URL`).

## Sauvegarde

```bash
pg_dump -Fc -d coccinel -f cafe-yayo-$(date +%Y%m%d).dump
```

Sur Windows (PowerShell) :

```powershell
pg_dump -Fc -d coccinel -f "cafe-yayo-$(Get-Date -Format yyyyMMdd).dump"
```

Conserver le fichier hors du serveur d’application. Tester une restauration **au moins une fois** avant la recette.

## Restauration (environnement de test)

```bash
pg_restore --clean --if-exists -d coccinel_test cafe-yayo-YYYYMMDD.dump
```

Vérifier après restore : connexion Better Auth, une vente boutique, un versement caisse centrale.

## Hébergement / propriété des données

- Le code source reste celui du prestataire / dépôt Coccinelle.
- Les données métier (ventes, stocks, caisses, audit) appartiennent à CAFE YAYO.
- Un dump complet permet la récupération sans l’application (PostgreSQL standard).
