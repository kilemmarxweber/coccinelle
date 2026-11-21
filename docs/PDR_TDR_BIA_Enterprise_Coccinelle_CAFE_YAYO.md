# Coccinelle --- Module BIA Enterprise

## Plan PDR et TDR (Plan de décision / Termes de référence)

**Organisation :** CAFE YAYO\
**Produit :** Coccinelle\
**Module :** BIA --- supervision technique, intégrité, sécurité et
continuité de la base de données\
**Version :** 1.1 --- Première tranche livrée dans Coccinelle\
**Statut :** Cadrage conservé ; le socle métier est en place, l'infrastructure de continuité reste à décider

## 0. Lecture de la version 1.1

Le document 1.0 proposait quatorze modèles, des workers et une chaîne de sauvegarde complète. Cette version sépare ce qui existe déjà, ce qui est livré, et ce qui reste une décision d'infrastructure.

**Déjà dans Coccinelle, à réutiliser et non à recréer :**

-   `AuditEvent` (organisation, département optionnel, auteur, motif, ancienne et nouvelle valeur) ;
-   PCA, caisse centrale et audit interne, au niveau `Organization` ;
-   versements `CashRemittance` et journal `CentralCashEntry` ;
-   écarts de session `CashSession.varianceUsd`.

**Livré avec cette version (BIA-01 partiel, BIA-03, BIA-04 partiel, BIA-06 partiel) :**

-   modèles `IntegrityFinding`, `BiaIncident`, `BiaIncidentEvent` ;
-   trois contrôles en lecture seule : vente encaissée sans sortie de stock, versement préparé sans réception, écart de caisse à la clôture ;
-   empreinte unique `règle + identifiant` : un second passage met à jour le détail et ne rouvre pas un constat qualifié ;
-   ouverture, traitement et clôture d'incident, sans écriture dans les ventes, le stock ou les caisses ;
-   santé PostgreSQL (`SELECT 1`, nombre de connexions si le rôle le permet) ;
-   écran organisation `/admin/organizations/[id]/bia`, export PDF et Excel, accès owner, admin et admin applicatif ;
-   carte BIA Enterprise sur le pilotage CAFE YAYO.

**Toujours hors livraison, tant que les décisions du §3.7 ne sont pas cochées :**

-   workers séparés du cycle HTTP ;
-   `pgBackRest`, archivage WAL, RPO 15 min, RTO 2 h ;
-   rôles PostgreSQL dédiés et stockage externe des sauvegardes ;
-   `SystemLog`, `SecurityEvent`, `DatabaseMetric`, `BackupJob`, `RestoreTest`, `AlertRule` ;
-   correction automatique de toute donnée métier. Un constat n'est pas une réparation.

------------------------------------------------------------------------

# 1. Objet du document

Ce document définit le plan de décision (PDR) et les termes de référence
(TDR) pour concevoir, développer, tester et mettre en production le
module BIA Enterprise de Coccinelle.

BIA est un module transversal au niveau de l'organisation CAFE YAYO. Il
supervise l'application, l'infrastructure de données et les contrôles
techniques et fonctionnels, sans remplacer les modules métier existants
ni l'audit interne.

Les objectifs sont de :

-   surveiller la disponibilité et la santé de PostgreSQL ;
-   détecter les incohérences de données et les événements de sécurité ;
-   centraliser les journaux techniques et les preuves d'audit ;
-   gérer les incidents et les alertes ;
-   automatiser les sauvegardes et vérifier leur restaurabilité ;
-   mesurer les performances de l'application et de la base ;
-   fournir au PCA une vue synthétique, et à l'Admin IT des outils
    techniques contrôlés.

# 2. Contexte technique et fonctionnel

Le cadrage s'appuie sur l'architecture Coccinelle décrite dans le
document PDR/TDTR CAFE YAYO :

-   Next.js 16.3 App Router ;
-   Prisma 7 ;
-   PostgreSQL ;
-   Better Auth ;
-   architecture multi-branches ;
-   couches organisationnelles pour le PCA, la caisse centrale et
    l'audit ;
-   création prévue d'un `AuditEvent` générique ;
-   besoin identifié de sauvegarde et restauration testables et
    documentées ;
-   utilisation de Playwright pour industrialiser les recettes.

Les départements concernés sont Mini Market, Boissons, Fast Food,
Buffet, Crèmerie et Charcuterie. BIA intervient au niveau organisation
et peut recevoir des événements provenant de ces départements.

**À confirmer pendant le cadrage technique :** hébergeur, topologie
PostgreSQL, volumétrie, politique de rétention, moyens de notification,
exigences légales applicables et budget d'infrastructure.

# 3. PDR --- Plan de décision

## 3.1 Décision d'architecture

**Décision proposée :** intégrer BIA à Coccinelle comme un domaine
fonctionnel transversal, avec une interface dédiée et des services de
collecte et de traitement exécutés par des workers indépendants du cycle
HTTP.

BIA ne doit pas être une branche supplémentaire (`Branch`) ni un nouveau
métier commercial. Il appartient au niveau `Organization`.

## 3.2 Principes structurants

1.  Séparation des responsabilités entre métier, audit et supervision
    technique.
2.  Principe du moindre privilège pour les utilisateurs et les comptes
    techniques.
3.  Lecture seule pour les collecteurs lorsque cela est possible.
4.  Journalisation des actions sensibles, y compris les actions
    réalisées dans BIA.
5.  Aucun contrôle d'intégrité ne corrige automatiquement une donnée
    métier.
6.  Toute correction métier reste réalisée par le module métier
    autorisé, avec motif et trace.
7.  Les sauvegardes sont indépendantes de la base principale et
    protégées contre l'altération.
8.  Une sauvegarde n'est considérée comme fiable qu'après vérification
    et test de restauration.
9.  Les alertes doivent être qualifiées, attribuées, suivies et
    clôturées.
10. Les données sensibles et secrets ne doivent jamais être exposés dans
    les logs ou exports.

## 3.3 Périmètre fonctionnel

### Inclus

-   Monitoring PostgreSQL et disponibilité applicative.
-   Collecte des métriques de performance.
-   Contrôles d'intégrité métier et technique.
-   Centralisation des logs techniques et événements de sécurité.
-   Consultation des événements d'audit métier.
-   Gestion des incidents, alertes et notifications.
-   Gestion des sauvegardes, vérifications et tests de restauration.
-   Gestion des accès et traçabilité des actions BIA.
-   Tableaux de bord et rapports exportables.
-   Tests automatisés et documentation d'exploitation.

### Hors périmètre initial

-   Remplacement du système d'authentification Better Auth.
-   Modification automatique des ventes, stocks, caisses ou versements.
-   Administration libre des données métier depuis BIA.
-   Détection comportementale basée sur l'IA sans règles validées.
-   Bascule automatique vers une infrastructure secondaire, sauf
    décision et budget dédiés.
-   Promesse de conformité à une norme ou réglementation non encore
    identifiée.

## 3.4 Distinction Audit interne / BIA

  -----------------------------------------------------------------------
  Domaine                 Audit interne           BIA
  ----------------------- ----------------------- -----------------------
  Finalité                Contrôle des opérations Santé, sécurité et
                          métier                  intégrité technique

  Sources                 Ventes, stocks,         PostgreSQL,
                          caisses, achats,        application,
                          versements              infrastructure,
                                                  événements

  Utilisateur principal   Auditeur                Admin IT ; PCA pour la
                                                  synthèse

  Actions                 Consultation, filtres,  Supervision et
                          export                  administration
                                                  technique autorisée

  Correction              Aucune modification par Pas de correction
                          l'auditeur              automatique des données
                                                  métier
  -----------------------------------------------------------------------

L'auditeur peut consulter les logs métier et les éléments techniques
expressément autorisés, en lecture seule. Les accès aux secrets, aux
données personnelles non nécessaires et aux commandes d'administration
restent interdits.

## 3.5 Profils et droits proposés

  -----------------------------------------------------------------------
  Profil                              Accès recommandé
  ----------------------------------- -----------------------------------
  PCA                                 Synthèse, alertes critiques,
                                      rapports de disponibilité et
                                      incidents

  Coordonnatrice                      Suivi des incidents et indicateurs
                                      autorisés

  Contrôle de gestion                 Anomalies métier et rapports
                                      financiers autorisés

  Comptable                           Aucun accès technique ; accès aux
                                      rapports financiers selon ses
                                      droits métier

  Auditeur                            Journaux métier et preuves
                                      autorisées, lecture seule, export
                                      contrôlé

  Admin IT                            Configuration technique,
                                      monitoring, sauvegardes et
                                      incidents

  Responsable département             Pas d'accès au BIA global ;
                                      consultation éventuelle de ses
                                      propres alertes métier
  -----------------------------------------------------------------------

Les droits doivent être appliqués côté serveur, dans la DAL et les
Server Actions, et non uniquement masqués dans l'interface.

## 3.6 Objectifs de continuité proposés

Les valeurs ci-dessous sont des cibles initiales à valider par
l'organisation après étude de l'infrastructure et des coûts.

  Indicateur                   Cible proposée
  ---------------------------- ----------------------------------------------
  RPO                          15 minutes maximum de perte de données visée
  RTO                          2 heures pour le scénario prioritaire
  Sauvegarde complète          Quotidienne
  Archivage WAL                Continu
  Vérification de sauvegarde   Après chaque exécution
  Test de restauration         Mensuel
  Exercice de reprise          Trimestriel

Ces objectifs ne sont pas garantis par le seul logiciel. Ils nécessitent
une infrastructure, des procédures, des ressources et des tests adaptés.

## 3.7 Décisions à faire valider

-   [ ] Hébergeur et emplacement de PostgreSQL.
-   [ ] Environnement de stockage externe des sauvegardes.
-   [ ] RPO/RTO définitifs.
-   [ ] Durée de conservation des logs et sauvegardes.
-   [ ] Canaux d'alerte : interface, email ou autre canal approuvé.
-   [ ] Responsables de traitement des incidents.
-   [ ] Politique d'accès d'urgence (« break-glass »).
-   [ ] Fenêtres de maintenance.
-   [ ] Budget de monitoring, stockage et sauvegarde.

------------------------------------------------------------------------

# 4. Architecture fonctionnelle cible

BIA comprend les sous-systèmes suivants.

## BIA-01 --- Centre de supervision

-   État de PostgreSQL et disponibilité applicative.
-   Connexions actives et capacité du pool.
-   Utilisation CPU, mémoire et disque, si exposée par l'hébergement.
-   Transactions, verrous et sessions longues.
-   Historique des métriques et disponibilité.
-   Tableau de bord synthétique pour le PCA.

## BIA-02 --- Sécurité et accès

-   Événements de connexion réussie et échouée.
-   Changements de rôles et permissions.
-   Sessions et révocations autorisées.
-   Activités administratives sensibles.
-   Détection de séquences anormales selon des règles explicites.
-   Journal des consultations et exports sensibles de BIA.

Ne pas journaliser les mots de passe, tokens, secrets, clés privées ou
contenus sensibles inutiles.

## BIA-03 --- Moteur de contrôle d'intégrité

Contrôles proposés :

  Contrôle        Exemple de détection
  --------------- ----------------------------------------------------
  Vente / stock   Vente encaissée sans mouvement de stock attendu
  Versement       Versement déclaré sans réception correspondante
  Caisse          Écart entre montant théorique, déclaré et reçu
  Paiement        Référence ou transaction potentiellement dupliquée
  Inventaire      Quantité incohérente après mouvements
  Achat           Quantité réceptionnée différente de la commande
  Audit           Opération sensible sans événement de traçabilité

Chaque contrôle doit définir sa règle, sa fréquence, son périmètre, son
niveau de gravité, son propriétaire et sa procédure de traitement.

Un résultat anormal crée un constat (`IntegrityFinding`) ; il ne modifie
jamais automatiquement la donnée source.

## BIA-04 --- Logs et événements

Deux familles sont conservées et présentées séparément :

-   **Audit métier :** auteur, date, objet, action, ancienne valeur,
    nouvelle valeur, motif et approbation.
-   **Logs techniques :** application, worker, base, erreurs, événements
    de sécurité et mesures techniques.

Les journaux doivent être protégés contre l'altération : droits
d'écriture restreints, stockage séparé lorsque possible, sauvegardes,
contrôle d'intégrité et conservation des preuves.

## BIA-05 --- Incidents et alertes

Cycle de vie :

1.  Détection.
2.  Création de l'incident.
3.  Qualification et niveau de gravité.
4.  Attribution à un responsable.
5.  Investigation et ajout de preuves.
6.  Résolution proposée.
7.  Validation selon le niveau de criticité.
8.  Clôture et archivage.

Gravités : critique, élevée, moyenne et informationnelle.

## BIA-06 --- Backup & Recovery

-   Sauvegardes PostgreSQL complètes.
-   Archivage continu des WAL si l'infrastructure le permet.
-   Chiffrement en transit et au repos.
-   Stockage externe isolé.
-   Contrôle d'intégrité des artefacts.
-   Suivi des durées, tailles et résultats.
-   Tests de restauration dans un environnement isolé.
-   Rapports de restauration et exercices de reprise.

Outils à évaluer : pgBackRest ou une stratégie `pg_basebackup` +
archivage WAL. Le choix final dépendra de l'hébergement, de la version
PostgreSQL et des compétences d'exploitation.

## BIA-07 --- Performance Center

-   Requêtes lentes et statistiques PostgreSQL.
-   Temps de réponse des Server Actions.
-   Erreurs applicatives et taux d'échec.
-   Utilisation du pool de connexions.
-   Temps de génération des rapports.
-   Historique et tendances.

`pg_stat_statements` peut être utilisé après vérification de sa
disponibilité et de sa configuration sur l'environnement cible.

## BIA-08 --- Rapports et exports

-   Rapport de disponibilité.
-   Rapport des incidents.
-   Rapport de sécurité.
-   Rapport d'intégrité.
-   Rapport des sauvegardes et restaurations.
-   Rapport de performance.
-   Exports PDF/Excel avec auteur, date, filtres et périmètre.

------------------------------------------------------------------------

# 5. Architecture technique cible

## 5.1 Vue logique

``` mermaid
flowchart TB
    UI[Interface BIA - Next.js]
    AUTH[Better Auth + permissions]
    DAL[DAL authentifiée]
    API[Services BIA]
    WORKERS[Workers indépendants]
    PG[(PostgreSQL Coccinelle)]
    METRICS[(Stockage métriques et événements)]
    BACKUP[Stockage backup externe]
    ALERTS[Notifications et incidents]

    UI --> AUTH
    AUTH --> DAL
    DAL --> API
    API --> PG
    WORKERS --> PG
    WORKERS --> METRICS
    WORKERS --> BACKUP
    WORKERS --> ALERTS
    METRICS --> API
    ALERTS --> UI
```

## 5.2 Composants

  Couche             Choix recommandé
  ------------------ -----------------------------------
  Frontend           Next.js 16.3 App Router
  Visualisation      Recharts
  Authentification   Better Auth
  Autorisation       Permissions et DAL côté serveur
  ORM                Prisma 7
  Base               PostgreSQL
  Métriques DB       Vues statistiques PostgreSQL
  Logs applicatifs   Pino ou équivalent structuré
  Workers            Processus Node.js séparé
  Scheduler          Cron/scheduler d'infrastructure
  Backup             pgBackRest ou pg_basebackup + WAL
  Tests E2E          Playwright
  Tests techniques   Tests d'intégration PostgreSQL

## 5.3 Séparation des comptes techniques

Prévoir des comptes distincts :

-   compte applicatif Coccinelle ;
-   compte collecteur PostgreSQL en lecture seule ;
-   compte de sauvegarde avec privilèges strictement nécessaires ;
-   compte de restauration limité à l'environnement isolé ;
-   compte d'administration d'infrastructure.

Les secrets sont stockés dans le gestionnaire de secrets de
l'environnement, jamais dans le dépôt Git ni dans les logs.

## 5.4 Organisation de code indicative

Les chemins sont des propositions à adapter à la structure réelle du
dépôt.

``` text
lib/
  bia/
    actions/
      monitoring-actions.ts
      incident-actions.ts
      backup-actions.ts
      integrity-actions.ts
    dal/
      bia-dal.ts
    services/
      monitoring-service.ts
      integrity-engine.ts
      alert-engine.ts
      incident-service.ts
      backup-service.ts
      security-service.ts
    policies/
      bia-permissions.ts
    schemas/
      bia-schemas.ts

app/
  admin/
    bia/
      page.tsx
      monitoring/
      security/
      integrity/
      logs/
      incidents/
      backups/
      performance/
      reports/

workers/
  bia/
    monitoring-worker.ts
    integrity-worker.ts
    alert-worker.ts
    backup-worker.ts

prisma/
  schema.prisma

e2e/
  bia/
    pages/
    fixtures/
    monitoring.spec.ts
    permissions.spec.ts
    integrity.spec.ts
    backup.spec.ts
    incidents.spec.ts
```

------------------------------------------------------------------------

# 6. Modèle de données Prisma proposé

Les modèles ci-dessous sont une liste de conception, pas un schéma
Prisma prêt à appliquer sans vérification des modèles existants.

  Modèle               Responsabilité
  -------------------- ----------------------------------------
  `AuditEvent`         Événements métier
  `SystemLog`          Logs techniques structurés
  `SecurityEvent`      Événements de sécurité
  `DatabaseMetric`     Mesures techniques
  `IntegrityCheck`     Règles de contrôle
  `IntegrityRun`       Exécution d'un contrôle
  `IntegrityFinding`   Anomalie constatée
  `BiaIncident`        Dossier d'incident
  `BiaIncidentEvent`   Historique d'un incident
  `BackupJob`          Exécution d'une sauvegarde
  `BackupArtifact`     Référence et métadonnées d'un artefact
  `RestoreTest`        Test de restauration
  `AlertRule`          Règle de notification
  `BiaNotification`    Notification produite
  `BiaAccessLog`       Accès et actions dans BIA

## 6.1 Champs transversaux recommandés

Pour les événements :

-   `id` : identifiant unique ;
-   `organizationId` : organisation concernée ;
-   `branchId` : branche facultative ;
-   `actorUserId` : utilisateur, si connu ;
-   `source` : application, worker, PostgreSQL ou système ;
-   `eventType` : type d'événement ;
-   `severity` : gravité ;
-   `occurredAt` : date UTC de l'événement ;
-   `correlationId` : corrélation entre opérations ;
-   `metadata` : métadonnées validées et expurgées.

Éviter de recopier des données personnelles ou financières complètes
dans les logs. Préférer des références vers les objets métier autorisés.

## 6.2 Intégrité et immutabilité

-   Interdire `UPDATE` et `DELETE` aux rôles ordinaires sur les tables
    de preuves.
-   Utiliser des privilèges PostgreSQL distincts.
-   Protéger les sauvegardes et exports.
-   Ajouter des empreintes cryptographiques et des contrôles
    périodiques.
-   Conserver les preuves critiques dans un stockage indépendant ou à
    rétention protégée.
-   Tracer toute consultation et tout export sensible.

Une chaîne de hachage seule n'est pas une garantie suffisante si le même
administrateur peut modifier les événements et recalculer les
empreintes.

------------------------------------------------------------------------

# 7. TDR --- Termes de référence des lots de travaux

Chaque lot précise les objectifs, livrables, dépendances et critères de
recette.

## Lot BIA-01 --- Fondations, permissions et journalisation

**Objectifs** - Créer le domaine BIA au niveau organisation. - Définir
les permissions et profils. - Définir les événements d'audit et les logs
techniques. - Tracer les actions réalisées dans BIA.

**Travaux** - Étudier le schéma Prisma existant et réutiliser
`AuditEvent` s'il est déjà créé. - Définir les enums, modèles et
index. - Créer les politiques d'autorisation. - Brancher la
journalisation aux actions sensibles. - Définir les règles d'expurgation
des secrets et données personnelles.

**Livrables** - Schéma de données validé. - Matrice des permissions. -
DAL et services de journalisation. - Tests unitaires et d'intégration.

**Recette** - Un utilisateur sans permission ne peut pas accéder aux
données BIA via l'URL ou les Server Actions. - Un auditeur ne peut ni
modifier ni supprimer un événement. - Une action sensible produit une
trace exploitable. - Aucun secret n'est présent dans les logs de test.

## Lot BIA-02 --- Monitoring PostgreSQL et application

**Objectifs** - Afficher la santé de PostgreSQL. - Mesurer les
performances et la disponibilité. - Détecter les dégradations.

**Travaux** - Configurer le compte collecteur à privilèges minimaux. -
Collecter connexions, transactions, verrous et statistiques. - Évaluer
`pg_stat_statements`. - Développer le worker de collecte. - Stocker les
mesures avec une politique de rétention.

**Livrables** - Worker de monitoring. - Tableau de bord technique. -
Historique des métriques. - Règles initiales d'alerte.

**Recette** - Une indisponibilité simulée est détectée. - Les métriques
sont horodatées et consultables. - Le worker ne bloque pas les requêtes
utilisateur. - Le collecteur ne peut pas modifier les données métier.

## Lot BIA-03 --- Moteur d'intégrité

**Objectifs** - Détecter les incohérences entre ventes, stocks, caisses,
versements et achats. - Conserver les constats et leurs preuves.

**Travaux** - Définir chaque règle avec le métier. - Établir les
requêtes de contrôle. - Créer les exécutions et constats. - Dédupliquer
les constats récurrents. - Permettre qualification, affectation et
résolution.

**Livrables** - Catalogue des contrôles. - Moteur d'exécution. - Tableau
des anomalies. - Procédures de traitement.

**Recette** - Une incohérence de test est détectée. - Le constat
référence les objets concernés. - Une anomalie ne modifie aucune donnée
métier. - Une anomalie résolue conserve son historique.

## Lot BIA-04 --- Sécurité, incidents et alertes

**Objectifs** - Centraliser les événements de sécurité. - Gérer les
incidents. - Notifier les personnes habilitées.

**Travaux** - Collecter les événements Better Auth et les actions
administratives pertinentes. - Définir les règles de détection. -
Développer le cycle de vie des incidents. - Configurer les
notifications. - Tracer les consultations et exports sensibles.

**Livrables** - Security Center. - Gestionnaire d'incidents. - Centre de
notifications. - Matrice de gravité et d'escalade.

**Recette** - Des tentatives de connexion répétées déclenchent une
alerte selon la règle définie. - Un incident peut être affecté, commenté
et clôturé. - Chaque transition de statut est tracée. - Les
notifications ne divulguent aucune donnée sensible.

## Lot BIA-05 --- Backup, restauration et continuité

**Objectifs** - Mettre en œuvre les sauvegardes. - Vérifier les
artefacts. - Prouver la capacité de restauration.

**Travaux** - Évaluer l'hébergement et la stratégie PostgreSQL. -
Configurer sauvegarde complète et archivage WAL. - Chiffrer et
externaliser les sauvegardes. - Contrôler les résultats. - Restaurer
dans un environnement isolé. - Documenter les procédures de reprise.

**Livrables** - Politique de sauvegarde. - Worker de backup. -
Historique des jobs. - Procédure de restauration. - Rapports de tests de
restauration. - Procédure de reprise après incident.

**Recette** - Une sauvegarde est exécutée et vérifiée. - Une
restauration est réalisée sur un environnement isolé. - Les contrôles de
cohérence après restauration sont réussis. - Le rapport indique durée,
point de restauration et résultat. - Les identifiants de production ne
sont pas exposés à l'environnement de test.

## Lot BIA-06 --- Performance Center, rapports et industrialisation

**Objectifs** - Finaliser les tableaux de bord. - Mesurer la performance
applicative. - Industrialiser les tests et l'exploitation.

**Travaux** - Instrumenter les Server Actions et opérations critiques. -
Identifier les requêtes lentes. - Créer les rapports. - Ajouter les
exports autorisés. - Ajouter les scénarios Playwright. - Rédiger le
guide d'exploitation.

**Livrables** - Dashboard Enterprise BIA. - Rapports PDF/Excel. - Tests
E2E. - Documentation technique et utilisateur. - Procès-verbal de
recette.

**Recette** - Les pages BIA sont protégées par permissions. - Les
graphiques utilisent des données réelles. - Les exports respectent les
droits. - Les parcours critiques passent sur desktop et mobile adapté. -
Les tests ne reposent pas sur des temporisations arbitraires
(`waitForTimeout`).

------------------------------------------------------------------------

# 8. Matrice de tests et recette globale

  ID           Scénario                    Résultat attendu
  ------------ --------------------------- --------------------------------
  BIA-E2E-01   Accès PCA                   Synthèse autorisée
  BIA-E2E-02   Accès auditeur              Lecture seule
  BIA-E2E-03   Accès comptable             Pas d'accès technique
  BIA-E2E-04   Connexion refusée répétée   Événement de sécurité
  BIA-E2E-05   Requête lente simulée       Métrique et alerte selon seuil
  BIA-E2E-06   Vente / stock incohérents   Constat d'intégrité
  BIA-E2E-07   Versement non réceptionné   Constat d'intégrité
  BIA-E2E-08   Modification d'un log       Refusée
  BIA-E2E-09   Backup réussi               Artefact vérifié
  BIA-E2E-10   Restauration isolée         Test documenté
  BIA-E2E-11   Export de rapport           Export autorisé et tracé
  BIA-E2E-12   Clôture d'incident          Historique conservé

Prévoir également des tests de charge raisonnables, de perte de
connexion, de reprise du worker et de saturation du stockage.

------------------------------------------------------------------------

# 9. Phasage et dépendances

Ordre recommandé :

``` mermaid
flowchart TD
    A[BIA-01 Fondations] --> B[BIA-02 Monitoring]
    A --> C[BIA-03 Intégrité]
    A --> D[BIA-04 Sécurité et incidents]
    B --> E[BIA-06 Dashboard et rapports]
    C --> E
    D --> E
    A --> F[BIA-05 Backup et restauration]
    F --> E
    E --> G[Recette globale et production]
```

  -----------------------------------------------------------------------
  Phase                   Contenu                 Condition de sortie
  ----------------------- ----------------------- -----------------------
  Cadrage                 Audit du dépôt,         Architecture validée
                          infrastructure, droits  

  Fondations              BIA-01                  Permissions et logs
                                                  testés

  Supervision             BIA-02                  Collecte fiable

  Contrôle                BIA-03 et BIA-04        Anomalies et incidents
                                                  traçables

  Continuité              BIA-05                  Restauration testée

  Finalisation            BIA-06                  Recette globale validée
  -----------------------------------------------------------------------

Les lots BIA-02, BIA-03 et BIA-04 peuvent être développés en parallèle
après stabilisation de BIA-01, avec des contrats d'interface communs.

------------------------------------------------------------------------

# 10. Gouvernance et exploitation

## Responsabilités

  -----------------------------------------------------------------------
  Acteur                              Responsabilité
  ----------------------------------- -----------------------------------
  PCA                                 Valider les objectifs et consulter
                                      les alertes stratégiques

  Coordonnatrice                      Suivre les incidents
                                      organisationnels

  Admin IT                            Exploiter le monitoring, les
                                      sauvegardes et les accès techniques

  Auditeur                            Vérifier les preuves et opérations
                                      métier

  Contrôle de gestion                 Qualifier les anomalies financières

  Développeur                         Corriger les défauts applicatifs
                                      selon le processus de changement
  -----------------------------------------------------------------------

## Procédures obligatoires

-   Gestion des incidents critiques.
-   Gestion des accès et départs utilisateurs.
-   Rotation des secrets.
-   Sauvegarde et restauration.
-   Mise à jour et migration de schéma.
-   Gestion des vulnérabilités.
-   Archivage et rétention des logs.
-   Revue périodique des permissions.
-   Exercice de reprise après incident.

Toute intervention d'urgence doit être documentée et auditée après
exécution.

------------------------------------------------------------------------

# 11. Indicateurs de réussite

  Indicateur                 Mesure
  -------------------------- ----------------------------------------------
  Disponibilité DB           Pourcentage sur la période
  Collecte de métriques      Taux de collecte réussie
  Couverture des contrôles   Contrôles actifs / contrôles prévus
  Détection                  Délai entre anomalie et constat
  Incidents                  Nombre par gravité et ancienneté
  Sauvegardes                Taux de réussite et vérification
  Restaurations              Taux de tests réussis
  Performance                Temps de réponse et requêtes lentes
  Sécurité                   Événements qualifiés et délais de traitement
  Traçabilité                Opérations sensibles avec preuve exploitable

Les seuils cibles doivent être fixés après établissement d'une mesure de
référence sur l'environnement réel.

------------------------------------------------------------------------

# 12. Risques et mesures de maîtrise

  -----------------------------------------------------------------------
  Risque                              Mesure
  ----------------------------------- -----------------------------------
  Collecteur trop privilégié          Compte dédié en lecture seule

  Monitoring qui surcharge PostgreSQL Fréquence et volume de collecte
                                      maîtrisés

  Logs contenant des secrets          Filtrage et expurgation à la source

  Faux positifs d'intégrité           Règles validées avec les
                                      responsables métier

  Suppression ou altération des       Stockage protégé et séparation des
  preuves                             rôles

  Backup inutilisable                 Vérification et restauration
                                      périodique

  Worker arrêté                       Supervision du worker et alerte
                                      indépendante

  Restauration sur production par     Environnement isolé et validation
  erreur                              renforcée

  Exports trop permissifs             Autorisation serveur et
                                      journalisation

  Dépendance à un seul administrateur Comptes de secours contrôlés et
                                      procédures documentées
  -----------------------------------------------------------------------

------------------------------------------------------------------------

# 13. Livrables finaux attendus

À la fin du projet, le prestataire ou l'équipe de développement devra
remettre :

1.  Architecture fonctionnelle et technique validée.
2.  Schéma Prisma et migrations.
3.  Matrice des permissions.
4.  Services BIA et workers.
5.  Interface BIA Enterprise.
6.  Catalogue des contrôles d'intégrité.
7.  Catalogue des règles d'alerte.
8.  Procédure de gestion des incidents.
9.  Politique de sauvegarde et restauration.
10. Rapports de tests de restauration.
11. Tests unitaires, intégration et Playwright.
12. Guide d'installation et de configuration.
13. Guide d'exploitation et de maintenance.
14. Documentation de reprise après incident.
15. Procès-verbal de recette.

------------------------------------------------------------------------

# 14. Conditions de validation du PDR/TDR

Le document est considéré comme validé lorsque :

-   Le périmètre et les exclusions sont approuvés.
-   Les rôles et permissions sont approuvés.
-   Les objectifs RPO/RTO sont validés.
-   L'hébergement et le stockage externe sont connus.
-   Les responsables de chaque lot sont désignés.
-   Les critères de recette sont acceptés.
-   Le calendrier et le budget sont approuvés.

## Décision finale proposée

**BIA Enterprise devient le centre transversal de contrôle technique de
Coccinelle pour CAFE YAYO.**

Il complète le PCA, la caisse centrale et l'audit interne sans les
remplacer. Il assure la surveillance technique, la détection des
anomalies, la protection des preuves, la gestion des incidents et la
continuité de service.

**Priorité de réalisation : BIA-01 → BIA-02 → BIA-03/BIA-04 → BIA-05 →
BIA-06.**

------------------------------------------------------------------------

# 15. Tranche livrée et suite

## 15.1 Règles appliquées

| Code | Source | Gravité | Effet |
| --- | --- | --- | --- |
| `VENTE_SANS_SORTIE` | vente `ENCAISSEE` des 31 derniers jours dont une ligne catalogue n'a pas le mouvement `SORTIE` correspondant | Élevée | constat |
| `VERSEMENT_SANS_RECEPTION` | `CashRemittance` au statut `PREPARED` | Moyenne | constat |
| `ECART_CAISSE` | session `CLOSED` dont l'écart absolu est d'au moins 0,01 $ | Élevée | constat |

Chaque passage écrit une trace `AuditEvent` d'action `RUN_CHECKS`. La clôture d'un incident passe le constat à `RESOLU` et n'appelle aucun service de vente, de stock ou de caisse.

## 15.2 Accès

| Profil Coccinelle | BIA |
| --- | --- |
| Admin applicatif | lecture, contrôles, incidents |
| `owner` (PCA) | lecture, contrôles, incidents |
| `admin` (admin IT de l'organisation) | lecture, contrôles, incidents |
| `user` (département) | aucun accès |

Le rôle auditeur en lecture seule décrit au §4.2 n'existe pas encore comme rôle d'organisation distinct. Il sera ajouté quand ce rôle sera créé, sans ouvrir le BIA aux caissiers.

## 15.3 Prochaine tranche

La tranche suivante ne démarre qu'après validation du §3.7 : hôte, stockage des sauvegardes, RPO, RTO, rétention, canaux d'alerte, responsables d'incident et fenêtres de maintenance. Elle couvrira les sauvegardes testées par restauration, les métriques et les alertes. Elle ne corrigera toujours pas les données métier.

------------------------------------------------------------------------

*Fin du document --- Plan PDR et TDR BIA Enterprise, Coccinelle / CAFE
YAYO, version 1.1.*
