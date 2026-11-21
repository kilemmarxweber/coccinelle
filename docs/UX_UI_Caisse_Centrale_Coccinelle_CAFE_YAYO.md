# Caisse centrale --- Spécification UX/UI

## Coccinelle · CAFE YAYO

**Version :** 1.0\
**Date :** 21 novembre 2026\
**Statut :** Proposition UX/UI --- maquette fonctionnelle à valider

------------------------------------------------------------------------

## 1. Objectif

Concevoir un module de caisse centrale moderne, élégant et sécurisé pour
Coccinelle, permettant de suivre les entrées, les sorties, les
transferts et les soldes de trésorerie de CAFE YAYO.

La caisse centrale est un module de trésorerie organisationnel. Elle est
distincte des caisses opérationnelles des départements, tout en pouvant
recevoir leurs versements et leur fournir des fonds selon les
autorisations définies.

## 2. Direction artistique

### Style recommandé : Fintech Enterprise

-   **Fond général :** `#F5F7FA`
-   **Menu latéral :** `#14243A`
-   **Couleur principale :** `#2563EB`
-   **Entrées de fonds :** `#16A36A`
-   **Sorties de fonds :** `#DC4545`
-   **Cartes :** blanc, coins arrondis, ombres légères
-   **Typographie :** Inter ou Geist
-   **Espacement :** généreux, grille cohérente et formulaires aérés
-   **Icônes :** Lucide, avec un usage cohérent et non décoratif

L'interface doit être responsive, accessible au clavier, lisible sur
ordinateur et tablette, et conserver une hiérarchie visuelle claire.

## 3. Navigation principale

Menu latéral recommandé :

1.  Vue d'ensemble
2.  Caisse centrale
3.  Entrées de fonds
4.  Sorties de fonds
5.  Transferts de fonds
6.  Historique des opérations
7.  Clôture et rapprochement
8.  Rapports financiers
9.  Contrôle et validation
10. Paramètres et règles de caisse

Le menu doit afficher le nom du module, l'organisation et, si
nécessaire, la caisse ou le périmètre actif.

## 4. Tableau de bord

La page d'accueil présente les indicateurs essentiels :

-   Solde disponible par devise
-   Total des entrées sur la période
-   Total des sorties sur la période
-   Nombre d'opérations en attente
-   Écarts de rapprochement éventuels
-   Dernières opérations
-   Alertes nécessitant une action

### Cartes de synthèse

  Indicateur              Présentation
  ----------------------- ---------------------------------------
  Solde disponible        Carte principale, ventilée par devise
  Total des entrées       Vert
  Total des sorties       Rouge
  Opérations en attente   Orange
  Écarts constatés        Alerte visible si non nul

Les montants d'exemple présents dans les maquettes sont fictifs. Les
données réelles doivent provenir du système.

### Filtres du tableau de bord

-   Aujourd'hui
-   Cette semaine
-   Ce mois
-   Période personnalisée
-   Devise
-   Type d'opération
-   Statut

## 5. Formulaire d'entrée de fonds

Le formulaire doit être divisé en blocs visuels et n'afficher que les
champs utiles au type d'entrée choisi.

### Bloc A --- Informations de l'opération

  Champ                        Type                   Obligatoire
  ---------------------------- ---------------------- ---------------
  Type d'entrée                Liste                  Oui
  Date et heure de réception   Date/heure             Oui
  Provenance                   Liste ou recherche     Oui
  Département d'origine        Liste conditionnelle   Selon le type
  Référence externe            Texte                  Non

Types d'entrée proposés :

-   Versement d'un département
-   Approvisionnement de caisse
-   Dépôt bancaire
-   Remboursement
-   Autre recette

Départements possibles :

-   Mini Market
-   Boissons
-   Fast Food
-   Buffet
-   Crèmerie
-   Charcuterie

### Bloc B --- Montant et paiement

  Champ                           Type                               Obligatoire
  ------------------------------- ---------------------------------- ---------------
  Montant reçu                    Montant positif                    Oui
  Devise                          CDF / USD ou devises configurées   Oui
  Mode de réception               Liste                              Oui
  Compte ou caisse destinataire   Liste                              Oui
  Référence de transaction        Texte                              Selon le mode

Modes de réception :

-   Espèces
-   Mobile Money
-   Virement bancaire
-   Autre moyen autorisé

Le système doit conserver les soldes séparés par devise. Il ne doit
jamais additionner directement des montants de devises différentes.

### Bloc C --- Justificatifs

-   Référence du reçu ou de la pièce
-   Pièce jointe (photo ou PDF)
-   Motif ou commentaire
-   Auteur de la saisie

### Bloc D --- Récapitulatif

Afficher avant soumission :

-   Montant et devise
-   Provenance
-   Destination
-   Type d'entrée
-   Justificatifs
-   Effet attendu sur le solde, clairement présenté comme prévisionnel
    tant que l'opération n'est pas validée

Bouton principal : **Soumettre l'entrée**.

## 6. Formulaire de sortie de fonds

Le formulaire doit rendre le décaissement particulièrement explicite et
prévenir les erreurs.

### Bloc A --- Informations du décaissement

  Champ                          Type                            Obligatoire
  ------------------------------ ------------------------------- --------------
  Catégorie de dépense           Liste                           Oui
  Date et heure                  Date/heure                      Oui
  Bénéficiaire                   Texte ou fournisseur existant   Oui
  Département demandeur          Liste conditionnelle            Selon le cas
  Demande ou référence interne   Texte                           Non

Catégories proposées :

-   Paiement fournisseur
-   Achat de marchandises
-   Frais de fonctionnement
-   Salaires et avances
-   Transport et logistique
-   Maintenance et réparation
-   Autre dépense

### Bloc B --- Montant et mode de paiement

  Champ                     Type              Obligatoire
  ------------------------- ----------------- ---------------
  Montant à décaisser       Montant positif   Oui
  Devise                    Liste             Oui
  Mode de décaissement      Liste             Oui
  Caisse ou compte source   Liste             Oui
  Référence de paiement     Texte             Selon le mode

Modes de décaissement :

-   Espèces
-   Mobile Money
-   Virement bancaire
-   Autre moyen autorisé

### Bloc C --- Justificatifs et motif

-   Motif détaillé de la sortie
-   Facture, reçu, bon ou pièce justificative
-   Référence de la demande
-   Bénéficiaire
-   Auteur de la saisie

### Bloc D --- Contrôles avant soumission

Le système doit vérifier :

-   Le solde disponible dans la devise concernée
-   Les droits de l'utilisateur
-   Les plafonds de décaissement
-   La présence des justificatifs exigés
-   L'absence de doublon de référence
-   Le circuit d'approbation applicable

Une sortie ne doit pas rendre le solde négatif, sauf mécanisme
exceptionnel explicitement autorisé, contrôlé et audité.

Bouton principal : **Soumettre la sortie**.

## 7. Transferts de fonds

Le transfert doit être une opération distincte d'une entrée ou d'une
sortie ordinaire.

Champs recommandés :

-   Caisse ou compte source
-   Caisse ou compte destinataire
-   Montant
-   Devise
-   Date
-   Motif
-   Référence
-   Justificatif
-   Initiateur
-   Validateur éventuel

Règles :

-   Source et destination doivent être différentes.
-   Le solde source doit être suffisant.
-   Un transfert dans la même devise conserve la devise.
-   Un transfert avec conversion doit utiliser un taux explicite, daté
    et autorisé.
-   Les deux côtés du transfert doivent être liés par un identifiant
    unique.
-   Un transfert ne doit pas être comptabilisé deux fois.

## 8. Historique des opérations

La table d'historique doit être filtrable, paginée et exportable selon
les permissions.

Colonnes recommandées :

-   Référence
-   Date et heure
-   Type
-   Libellé
-   Provenance ou bénéficiaire
-   Caisse
-   Devise
-   Montant
-   Auteur
-   Validateur
-   Statut
-   Actions autorisées

Filtres :

-   Recherche textuelle
-   Période
-   Entrée / sortie / transfert
-   Devise
-   Département
-   Catégorie
-   Auteur
-   Statut
-   Référence

Statuts possibles :

-   Brouillon
-   Soumise
-   En attente d'approbation
-   Approuvée
-   Rejetée
-   Comptabilisée
-   Annulée par contre-opération

L'utilisateur ne doit voir que les actions autorisées par son rôle et
l'état de l'opération.

## 9. Clôture et rapprochement

Prévoir un écran de clôture par caisse, devise et période.

Informations à afficher :

-   Solde d'ouverture
-   Total des entrées
-   Total des sorties
-   Solde théorique
-   Solde physique déclaré
-   Écart
-   Commentaire explicatif
-   Pièces justificatives
-   Personne ayant effectué le comptage
-   Personne ayant contrôlé la clôture

Le système doit empêcher une clôture silencieuse en présence d'un écart.
L'écart doit être expliqué et soumis au circuit de validation prévu.

## 10. Workflow d'une opération

1.  **Création :** le caissier saisit l'opération et joint les pièces
    requises.
2.  **Vérification automatique :** le système contrôle les champs, le
    solde, les plafonds, les références et les permissions.
3.  **Approbation :** un responsable autorisé approuve ou rejette selon
    les règles.
4.  **Comptabilisation :** seule une opération approuvée est portée au
    solde.
5.  **Traçabilité :** les événements de création, modification avant
    validation, approbation, rejet, comptabilisation et contre-opération
    sont journalisés.

### Principe de séparation des tâches

Le créateur d'une opération sensible ne devrait pas pouvoir l'approuver
lui-même, sauf exception explicitement configurée et auditée.

## 11. Rôles et permissions

  -----------------------------------------------------------------------
  Rôle                                Permissions principales
  ----------------------------------- -----------------------------------
  Caissier central                    Créer et consulter ses opérations,
                                      soumettre

  Responsable de caisse               Contrôler, approuver selon ses
                                      plafonds, clôturer

  Direction financière                Consulter les synthèses et
                                      rapports, valider selon délégation

  Auditeur interne                    Accès en lecture aux opérations et
                                      preuves autorisées

  Administrateur IT                   Gérer les paramètres techniques,
                                      sans droit implicite de validation
                                      financière

  PCA / Direction                     Consulter les indicateurs et
                                      alertes de haut niveau
  -----------------------------------------------------------------------

Les permissions doivent être appliquées côté serveur. Masquer un bouton
dans l'interface ne constitue pas une protection suffisante.

## 12. Règles de sécurité et d'intégrité

-   Une opération validée ne doit pas être supprimée ni modifiée
    directement.
-   Une erreur doit être corrigée par une annulation ou une
    régularisation liée à l'opération d'origine.
-   Les journaux d'audit doivent être append-only et protégés contre la
    modification ordinaire.
-   Chaque opération possède une référence unique.
-   Les montants doivent être stockés avec une précision adaptée à la
    devise.
-   Les calculs de solde doivent être transactionnels et cohérents.
-   Les validations doivent être contrôlées côté serveur.
-   Les pièces jointes doivent être protégées et accessibles uniquement
    aux personnes autorisées.
-   Les secrets et données sensibles ne doivent jamais être écrits dans
    les logs.
-   Les exports doivent être journalisés.
-   Les opérations concurrentes doivent être protégées contre les
    doubles dépenses et les doubles comptabilisations.

## 13. Notifications et alertes

Alertes à prévoir :

-   Opération en attente d'approbation
-   Sortie dépassant un seuil
-   Solde insuffisant
-   Écart de clôture
-   Référence potentiellement dupliquée
-   Justificatif manquant
-   Tentative d'action non autorisée
-   Échec de transfert ou de comptabilisation

Chaque alerte doit préciser son niveau, son contexte, sa date et
l'action attendue.

## 14. Rapports

Rapports recommandés :

-   Journal chronologique des entrées
-   Journal chronologique des sorties
-   Mouvements par devise
-   Mouvements par département
-   Mouvements par catégorie
-   Soldes par caisse
-   État des opérations en attente
-   Rapport de clôture
-   Rapport des écarts
-   Rapport des annulations et régularisations
-   Historique des validations

Formats possibles : PDF, XLSX et impression. Les exports doivent
respecter les permissions et conserver les filtres utilisés.

## 15. Principes UX des formulaires

-   Présenter les champs dans un ordre logique : contexte, montant,
    paiement, justificatifs, récapitulatif.
-   Marquer clairement les champs obligatoires.
-   Utiliser des libellés explicites et des exemples de saisie.
-   Afficher les erreurs près du champ concerné.
-   Préserver les données saisies en cas d'erreur de validation.
-   Ne pas préremplir un montant financier avec une valeur fictive.
-   Formater les montants selon la locale, sans perdre la précision
    stockée.
-   Afficher la devise à proximité immédiate du montant.
-   Confirmer les opérations sensibles avec un récapitulatif clair.
-   Prévoir les états chargement, succès, erreur, brouillon et
    indisponibilité.
-   Rendre les formulaires utilisables au clavier et sur tablette.
-   Ne pas utiliser uniquement la couleur pour distinguer entrée et
    sortie : ajouter libellés et icônes.

## 16. Architecture fonctionnelle recommandée

La caisse centrale doit rester un module organisationnel, distinct des
caisses départementales.

Composants fonctionnels :

-   Gestion des caisses et comptes
-   Gestion des devises
-   Entrées de fonds
-   Sorties de fonds
-   Transferts
-   Workflow d'approbation
-   Journal des mouvements
-   Clôture et rapprochement
-   Documents et justificatifs
-   Rapports
-   Alertes
-   Journal d'audit

### Règle de calcul

Pour chaque caisse et chaque devise :

`Solde = Solde d'ouverture + Entrées comptabilisées - Sorties comptabilisées + Transferts entrants - Transferts sortants`

Les opérations en attente ou rejetées ne modifient pas le solde
comptabilisé.

## 17. Critères d'acceptation

-   Un utilisateur autorisé peut créer une entrée avec les informations
    obligatoires.
-   Un utilisateur autorisé peut soumettre une sortie et le système
    contrôle le solde disponible.
-   Une opération en attente n'affecte pas le solde comptabilisé.
-   Une opération approuvée est comptabilisée une seule fois.
-   Les transferts sont équilibrés et traçables des deux côtés.
-   Les devises sont séparées dans les soldes et rapports.
-   Les utilisateurs ne peuvent pas accéder aux actions non autorisées
    via une requête directe.
-   Une opération validée ne peut pas être supprimée ou altérée
    directement.
-   Les corrections passent par des contre-opérations traçables.
-   Les clôtures affichent les écarts et exigent leur explication.
-   Les recherches, filtres et exports respectent les permissions.
-   Les événements critiques sont consignés dans le journal d'audit.

## 18. Décisions à confirmer avant réalisation

Les choix suivants doivent être confirmés avec les responsables de CAFE
YAYO :

1.  **Architecture de caisse**
    -   Une seule caisse centrale
    -   Une caisse centrale avec sous-caisses par devise ou type de
        fonds
    -   Une caisse centrale avec caisses départementales rattachées
2.  **Style visuel**
    -   Premium clair : blanc, bleu nuit et vert
    -   Dark premium : bleu nuit, noir et accents verts
    -   Mixte : interface claire avec menu sombre
3.  **Circuit de validation**
    -   Un seul responsable autorisé
    -   Caissier puis responsable approbateur
    -   Validation selon des seuils de montant
4.  Devises autorisées et règles de conversion
5.  Seuils d'approbation par type d'opération
6.  Modes de paiement acceptés
7.  Pièces justificatives obligatoires par catégorie
8.  Règles de clôture et fréquence de rapprochement

------------------------------------------------------------------------

**Note :** ce document est une proposition de conception UX/UI et de
règles fonctionnelles. Il ne constitue pas une preuve d'implémentation.
Les montants montrés dans les exemples d'interface sont fictifs.
