# Plan — Rôles opérationnels hospitalité & dashboards par profil

| | |
|---|---|
| **Status** | `in_progress` — R0→R5 livrés (matrice, assignation, hub, gardes, rapports perso) |
| **Périmètre** | Branches `HOTEL` / `RESTAURANT` — hub dashboard, menus, rapports perso, garde-fous routes |
| **Hors scope V1** | Agence transport (`guichetier` / `parent`) ; refonte complète Better Auth AC ; multi-rôles simultanés sur une même branche |
| **Lié** | [`plan-stock-service-depot-float.md`](./plan-stock-service-depot-float.md), [`plan-hotel-caisse-sejours-restauration.md`](./plan-hotel-caisse-sejours-restauration.md), [`plan-multi-branches.md`](./plan-multi-branches.md) |

---

## 1. Besoin (reformulé + améliorations)

Aujourd’hui le hub branche montre **toutes** les cartes selon le type de branche — **pas** selon le métier de la personne. Or le terrain exige des postes distincts :

| Rôle terrain | Intention |
|--------------|-----------|
| **Serveur(euse)** | Prend les commandes (Restauration), gère / voit le float (Service stock), suit **ses** commandes (rapport perso) |
| **Caissier(ère)** | Encaissement (Caisse & Ventes), taux, F&B/cuisine opérationnels, séjours, **Rapport Ventes** |
| **Réceptionniste** | Séjours (check-in / out), disponibilités, **Rapport séjours** sur période |
| **Gérant / Manager** | Pilotage & stock / achats / rapports — **sans** ops front : pas Caisse, pas Restauration, pas Cuisine |
| **Propriétaire** | Vue complète (Owner) — tous les dashboards |

### Améliorations retenues (idée → réalité produit)

| Idée brute | Décision | Pourquoi |
|------------|----------|----------|
| « Créer les rôles serveur, caissier… » | Rôles **opérationnels sur `BranchMember.role`** (par branche) | Un même employé peut être caissier à l’hôtel A et serveur à la brasserie B |
| Confondre avec `Member.role` org (`owner`, `gestionnaire`) | **Couches séparées** : org = propriété / périmètre ; branche = métier quotidien | Owner org reste propriétaire partout ; le slug `gestionnaire` peut default → gérant branche |
| Gérant = Manager | **Même matrice dashboard** (`gerant` \| `manager`) | Vocabulaire UI distinct, droits hub identiques en V1 |
| Serveur « voit service-stock » | Accès **lecture + ops float** (ouverture/confirm selon règles stock existantes) | Aligné float F&B déjà livré |
| Rapport commandes serveur | Card dédiée **« Mes commandes »** filtrée `createdByUserId` / serveur de la commande, période + stats + graphs | Pas le rapport ventes global (réservé caissier / owner) |
| Réceptionniste | Card **« Rapport séjours »** : check-in / out, statuts, occupation / dispo sur période | Complète Séjours ops |
| Masquer les cartes suffit | **Hub filtré + garde route** (403 / redirect hub) | Sinon URL directe contourne le dashboard |
| Propriétaire | Org role `owner` **ou** branch role `proprietaire` → **full menu** | Bypass matrice métier |

---

## 2. Matrice dashboard (cartes hub)

Identifiants stables (`BranchMenuItem.id`) pour filtrer :

| Id carte | Module |
|----------|--------|
| `caisse` | Caisse & Ventes |
| `taux_change` | Taux de change |
| `sejours` | Séjours |
| `restauration` | Restauration |
| `cuisine` | Cuisine |
| `service_stock` | Service stock |
| `chambres` | Chambres |
| `salles` | Salles de réunion |
| `produits_hotel` | Produits F&B |
| `livraison` | Livraison |
| `bons_commande` | Bons de commande |
| `depenses` | Dépenses |
| `rapport_tableau` | Tableau de bord |
| `rapport_ventes` | Rapport ventes |
| `rapport_achats` | Rapport achats |
| `rapport_financier` | Rapport financier |
| `rapport_articles` | Rapport article |
| `rapport_mes_commandes` | **Nouveau** — commandes du serveur |
| `rapport_sejours` | **Nouveau** — check-in / out & dispo |

### Qui voit quoi (hospitalité)

| Carte | Serveur | Caissier | Réception | Gérant / Manager | Propriétaire |
|-------|:-------:|:--------:|:---------:|:----------------:|:------------:|
| Caisse | | ✅ | | | ✅ |
| Taux de change | | ✅ | | ✅ | ✅ |
| Séjours | | ✅ | ✅ | ✅ | ✅ |
| Restauration | ✅ | ✅ | | | ✅ |
| Cuisine | | ✅ | | | ✅ |
| Service stock | ✅ | | | ✅ | ✅ |
| Chambres / salles / produits / livraison | | | ✅\* | ✅ | ✅ |
| Bons commande / Dépenses | | | | ✅ | ✅ |
| Tableau de bord | | ✅ | ✅ | ✅ | ✅ |
| Rapport ventes | | ✅ | | ✅ | ✅ |
| Rapports achats / financier / articles | | | | ✅ | ✅ |
| **Mes commandes** | ✅ | | | | ✅ |
| **Rapport séjours** | | | ✅ | ✅ | ✅ |

\*Réceptionniste : **chambres** (dispo) + séjours ; salles si `hasStays` / produit salles actif — V1 : séjours + chambres + rapport séjours.

**Gérant / Manager** = tout sauf `caisse`, `restauration`, `cuisine` (et donc pas « Mes commandes » serveur).

---

## 3. Modèle de données & constantes

### `BranchMember.role` (string)

Valeurs V1 :

```text
serveur | caissier | receptionniste | manager | gerant | proprietaire | branch_manager
```

- `branch_manager` : legacy — traité comme **gérant** (full sauf ops front) pour ne pas casser l’existant.
- Migration soft : pas d’enum Prisma obligatoire (string libre déjà en place).

### Résolution du rôle effectif

```text
1. Si User.role = admin plateforme → full
2. Si Member.orgRole = owner → proprietaire (full)
3. Sinon BranchMember.role de la branche courante
4. Si orgRole = gestionnaire et branch role vide / branch_manager → gerant
5. Défaut prudent : gerant (évite d’ouvrir la caisse à tout le monde) OU conserver full pour legacy ?
```

**Décision V1** : défaut d’affichage pour `branch_manager` legacy = **gérant** (pas caisse/resto/cuisine). Les owners gardent full. Documenter dans UI membres : « Choisissez le métier branche ».

### Fichiers cibles

| Fichier | Rôle |
|---------|------|
| `lib/branch/ops-roles.ts` | Slugs, labels FR, matrice `cardIdsByRole`, `resolveOpsRole`, `canSeeCard` |
| `lib/branch/branch-menus.ts` | Ajouter `id` sur items ; `menuSectionsForRole(...)` |
| `…/branch-dashboard.tsx` + `page.tsx` | Passer rôle résolu ; welcome badge = métier |
| `…/members/*` | Select métier branche à la création / édition |
| `lib/branch/require-branch-context.ts` | Option `requireOpsCards?: string[]` |
| `…/rapports/mes-commandes/` | Page serveur |
| `…/rapports/sejours/` | Page réception |
| `lib/hotel/reports/*` | Actions scoped période |

---

## 4. UX

### Assignation (Équipe)

Dans créer / éditer membre :

1. Rôle **organisation** (owner, gestionnaire, …) — inchangé.
2. **Métier par branche** (select) pour chaque branche cochée — V1 simplifiée : **un même métier** pour toutes les branches sélectionnées (suffisant pour la plupart des cas).
3. Aide contextuelle : « Serveur = commandes + stock service + mes stats ».

### Hub

- Badge welcome : « Bonjour X — Serveur(euse) » (métier, pas `User.role` admin/user).
- Sections vides masquées.
- Cards rapport perso en section **ANALYSES & RAPPORTS** (ou **MON ACTIVITÉ** pour serveur).

### Rapports nouveaux

**Mes commandes (serveur)**  
- Période (jour / 7j / 30j / custom)  
- KPI : nb commandes, CA attribué, ticket moyen, par statut  
- Graphs : CA / jour, top produits, répartition statuts  
- Scope : commandes où l’utilisateur est créateur / serveur (`createdByUserId` ou champ existant)

**Rapport séjours (réception)**  
- Période : arrivées / départs  
- KPI : check-in, check-out, en cours, no-show / annulés si dispo  
- Dispo : chambres libres vs occupées (snapshot)  
- Liste filtrable + graph occupation

---

## 5. Phases de livraison

| Phase | Contenu | Critère de done |
|-------|---------|-----------------|
| **R0** | Plan + `ops-roles.ts` + ids cartes menus | Matrice unitaire testable |
| **R1** | Assignation `BranchMember.role` (forms + actions) | Créer membre serveur / caissier persiste |
| **R2** | Hub filtré + badge métier | Login serveur → 3–4 cards max |
| **R3** | Garde routes (redirect hub si carte interdite) | URL `/caisse` refusée au serveur |
| **R4** | Page + card **Mes commandes** | Stats + graphs période |
| **R5** | Page + card **Rapport séjours** | Check-in/out + dispo |
| **R6** | Polish : seed labels, doc plan status `done`, tests smoke | Build OK |

---

## 6. Règles non négociables V1

1. **Propriétaire / admin** voient toujours tout.
2. **Gérant = Manager** sur le hub (même exclusion caisse / resto / cuisine).
3. **Serveur** n’accède pas à la caisse ni aux rapports ventes globaux.
4. **Filtrage hub + garde route** (les deux).
5. Rôle métier = **branche**, pas seulement org.
6. Ne pas casser les branches AGENCE / BOUTIQUE : matrice appliquée surtout en hospitalité ; ailleurs conserver menu type (ou full pour owner).

---

## 7. Risques & mitigations

| Risque | Mitigation |
|--------|------------|
| Membres existants tous `branch_manager` → perdent caisse | Message migration UI ; owner peut réassigner ; option temporaire « full » via `proprietaire` |
| Serveur sans `createdByUserId` sur anciennes commandes | KPI « mes commandes » = 0 jusqu’aux nouvelles ; documenter |
| Double emploi Manager / Gérant | Labels distincts, même matrice |
| Contournement API | Actions sensibles (open cash, close stock) restent auth branch ; garde page en plus |

---

## 8. Checklist d’acceptation

- [ ] Créer un membre **serveur** → hub = Restauration + Service stock + Mes commandes
- [ ] **Caissier** → Caisse, taux, resto, cuisine, séjours, rapport ventes
- [ ] **Réceptionniste** → Séjours (+ chambres) + Rapport séjours
- [ ] **Gérant / Manager** → pas Caisse / Resto / Cuisine ; reste OK
- [ ] **Owner** → tout
- [ ] Serveur ouvre `/caisse` → redirect hub
- [ ] Mes commandes : filtre période + graph
- [ ] Rapport séjours : check-in/out période + dispo

---

## 9. Journal d’exécution

| Phase | Status | Notes |
|-------|--------|-------|
| R0 | `done` | `ops-roles.ts` + ids cartes + filtre menus |
| R1 | `done` | Métier branche sur create/edit membre |
| R2 | `done` | Hub filtré + badge métier |
| R3 | `done` | `requireDashCard` caisse/resto/cuisine/stock/séjours/ventes |
| R4 | `done` | `/rapports/mes-commandes` |
| R5 | `done` | `/rapports/sejours` |
| R6 | `todo` | Seed legacy roles → réassignation manuelle owner |
