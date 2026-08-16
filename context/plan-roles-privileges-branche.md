# Plan — Rôles & privilèges dynamiques (`BranchMember`)

| | |
|---|---|
| **Status** | `done` — P0→P6 livrés |
| **Périmètre** | Branches hospitalité (`HOTEL` / `RESTAURANT`) — rôles métier en base, privilèges CRUD+view, UI Paramètres, split caissier séjours / caissier resto |
| **Contexte** | Aujourd’hui la matrice est **codée en dur** dans `lib/branch/ops-roles.ts` (`ROLE_CARDS` + `canSeeDashCard`). Pas de table Role/Privilege ; un seul slug `caissier` mélange encaissement séjour **et** resto. Besoin terrain : **configurer / retirer** les droits sans redéployer, et séparer clairement hôtel vs restauration. |
| **Lié** | [`plan-roles-dashboards-hospitalite.md`](./plan-roles-dashboards-hospitalite.md) (matrice hub V1 livrée), [`plan-hotel-caisse-sejours-restauration.md`](./plan-hotel-caisse-sejours-restauration.md), [`plan-hospitalite-modules-hotel-restaurant.md`](./plan-hospitalite-modules-hotel-restaurant.md), [`plan-multi-branches.md`](./plan-multi-branches.md) |

---

## 1. Besoin métier (reformulé)

1. Les métiers (`serveur`, `caissier`, `receptionniste`, …) ne doivent plus être seulement des **strings magiques** : ils vivent en **base** (catalogue de rôles).
2. Chaque rôle a des **privilèges** explicites : `create`, `read`, `update`, `delete`, `view` — sur des **ressources** (modules / cartes / actions).
3. Un gérant / propriétaire peut **modifier ou retirer** ces privilèges depuis une carte **Paramètres** du dashboard branche (sans toucher au code).
4. **Deux caissiers distincts** :
   - **Caissier séjours (hôtel)** → encaissement folios / check-out / taux liés séjour ; **ne vend pas** en restauration (pas POS resto, pas ouvrir commandes salle).
   - **Caissier restauration** → caisse F&B / notes hors chambre / service stock côté salle ; **ne gère pas** chambres, planning séjours, check-in/out.
5. L’UI et les **gardes route + actions serveur** respectent la même source de vérité (pas seulement masquer une carte).

### Ce que ce plan n’est pas

- Ce n’est **pas** le `Member.role` organisation (`owner` / `gestionnaire`) — couche org inchangée.
- Ce n’est **pas** Better Auth AC plateforme (`User.role = admin`).
- Ce n’est **pas** multi-rôles simultanés sur une même branche en V1 (1 `BranchMember.role` → 1 rôle catalogue).
- Ce n’est **pas** un IAM enterprise (ACL par ligne métier / row-level) — scope = **module + action**.

---

## 2. Améliorations retenues (idée → réalité)

| Idée brute | Décision | Pourquoi |
|------------|----------|----------|
| « Tout en base dynamiquement » | Catalogue **`BranchRole`** + **`BranchRolePrivilege`** ; seed des rôles système ; override editable | Dynamique sans perdre des defaults sûrs |
| CRUD + view | Enum `PrivilegeAction` : `CREATE` \| `READ` \| `UPDATE` \| `DELETE` \| `VIEW` | `VIEW` = voir carte / page ; `READ` = lister / exporter données ; CRUD = mutations |
| Ressources = modules hub | `PrivilegeResource` = ids stables alignés `DASH_CARD` (+ sous-actions caisse si besoin) | Réutilise hub + gardes déjà en place |
| Un seul `caissier` | Split seed : `caissier_sejours` + `caissier_resto` ; garder `caissier` legacy → alias migration | Terrain hôtel ≠ resto |
| Paramètres dashboard | Nouvelle carte `parametres` (hub) → page rôles / matrice | Gérant & propriétaire seulement (privilège sur ressource `parametres`) |
| Qui édite la matrice ? | Owner org + `proprietaire` + `gerant`/`manager` **avec** `parametres:UPDATE` | Évite qu’un caissier s’ouvre la caisse lui-même |
| Rôles système protégés | Flag `isSystem` : slug non renommable / non supprimable ; privileges **éditables** | Stabilité seed + flexibilité terrain |
| Rôles custom | V1.1 : créer un rôle « libre » clone d’un système | V1 = éditer privileges des rôles seedés suffit |
| Scope branche vs org | Rôles **par organisation** (partagés entre branches de l’org) **ou** globaux seed | V1 : **catalogue org** (`organizationId`) + copie seed à la 1ʳᵉ config ; alternative plus simple : **catalogue global** seed-only + overrides par branche |
| Décision V1 scope | **Catalogue global seed** (`BranchRole` sans `branchId`) + table **`BranchRolePrivilege`** globale ; option **override branche** en V1.1 | Moins de duplication ; Paramètres = éditer le catalogue (owner/gérant de la branche courante = même effet org-wide en V1) |
| Contournement URL | `requirePrivilege(resource, action)` sur pages **et** actions sensibles | Même règle que plan R3, enrichie |

### Règles métier V1 (non négociables)

1. **Caissier séjours** : `caisse` + `sejours` + `taux_change` + rapports séjour / ventes séjour — **pas** `restauration` CREATE/UPDATE vente, **pas** `cuisine` ops, **pas** `chambres` UPDATE statut ménage comme réception.
2. **Caissier resto** : `caisse` (encaisser commandes F&B) + `restauration` VIEW/READ + `cuisine` VIEW + `service_stock` selon float — **pas** `sejours` CREATE/UPDATE, **pas** `chambres`, **pas** check-in/out.
3. **Serveur** : restauration + mes commandes ; pas caisse.
4. **Réceptionniste** : séjours + chambres + rapport séjours ; pas vente resto.
5. **Propriétaire / admin plateforme** : bypass total (comme aujourd’hui).
6. Retirer un privilège = **immédiat** sur hub + routes + actions (pas seulement UI).
7. Ne pas casser AGENCE / BOUTIQUE : ressources voyage/boutique restent full pour owner ; matrice hospitalité prioritaire.

---

## 3. Modèle de données (Prisma)

### Enums

```prisma
enum PrivilegeAction {
  CREATE
  READ
  UPDATE
  DELETE
  VIEW
}

/// Ressource = module / carte (aligné DASH_CARD + parametres)
enum PrivilegeResource {
  CAISSE
  TAUX_CHANGE
  SEJOURS
  RESTAURATION
  CUISINE
  SERVICE_STOCK
  CHAMBRES
  SALLES
  PRODUITS_HOTEL
  LIVRAISON
  BONS_COMMANDE
  DEPENSES
  RAPPORT_TABLEAU
  RAPPORT_VENTES
  RAPPORT_ACHATS
  RAPPORT_FINANCIER
  RAPPORT_ARTICLES
  RAPPORT_MES_COMMANDES
  RAPPORT_SEJOURS
  CLIENTS_PARTENAIRES
  PARAMETRES
  // Boutique / agence (V1.1 ou seed full owner)
  POS
  BOUTIQUE_PRODUITS
  BOUTIQUE_STOCK
  GUICHET
  RESERVATIONS
  CLIENTS
  TRAJETS
  COLIS
  EMBARQUEMENT
}
```

> **Alternative plus souple** (recommandée si on évite de migrer l’enum à chaque carte) : `resource` en `String` (`"caisse"`, `"sejours"`, …) avec constante TS `DASH_CARD` / `PRIVILEGE_RESOURCE` — **décision retenue V1 : string + index**, enum Prisma optionnel plus tard.

### Tables

```prisma
model BranchRole {
  id          String   @id @default(uuid())
  /// Slug stable assigné à BranchMember.role
  slug        String   @unique
  label       String
  description String?
  /// Seed Coccinelle — non supprimable
  isSystem    Boolean  @default(true)
  /// Ordre UI Paramètres
  sortOrder   Int      @default(0)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  privileges  BranchRolePrivilege[]
}

model BranchRolePrivilege {
  id        String   @id @default(uuid())
  roleId    String
  /// Ex. "caisse", "sejours", "parametres"
  resource  String
  action    PrivilegeAction
  allowed   Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  role      BranchRole @relation(fields: [roleId], references: [id], onDelete: Cascade)

  @@unique([roleId, resource, action])
  @@index([roleId])
  @@index([resource])
}
```

### Lien `BranchMember`

- **Inchangé structurellement** : `BranchMember.role` reste un `String` = **slug** `BranchRole.slug`.
- Plus de logique « hardcodée seule » : résolution = `find BranchRole by slug` → privileges.
- Migration soft des slugs existants :
  - `caissier` → proposer split UI ; défaut temporaire = **union** des deux matrices (comportement actuel) **ou** mapper vers `caissier_sejours` si branche `hasStays` only / `caissier_resto` si resto only / sinon forcer réassignation owner.
  - `branch_manager` → `gerant`.

### Seed des rôles système (V1)

| Slug | Label | Intention |
|------|-------|-----------|
| `serveur` | Serveur(euse) | Commandes salle + mes commandes |
| `caissier_sejours` | Caissier séjours | Encaissement hôtel / folios — **pas vendre resto** |
| `caissier_resto` | Caissier restauration | Encaissement F&B — **pas gérer chambres** |
| `caissier` | Caissier (legacy) | Compat : privileges = union temporaire ; UI marque « à remplacer » |
| `receptionniste` | Réceptionniste | Séjours + chambres + rapport séjours |
| `manager` | Manager | Pilotage (= gérant) |
| `gerant` | Gérant | Pilotage + Paramètres ; pas ops front caisse/resto/cuisine |
| `proprietaire` | Propriétaire | Full (ou bypass code) |

### Matrice seed — caissiers (cœur du besoin)

Légende : V = VIEW, R = READ, C/U/D = mutations.

| Resource | Caissier séjours | Caissier resto |
|----------|:----------------:|:--------------:|
| `caisse` | V R C U | V R C U |
| `taux_change` | V R U | V R U |
| `sejours` | V R U (encaisser / checkout) | — |
| `chambres` | V (dispo lecture) optionnel | — |
| `restauration` | — | V R |
| `cuisine` | — | V |
| `service_stock` | — | V R U (float) |
| `rapport_ventes` | V R (scope séjour) | V R (scope F&B) |
| `rapport_sejours` | V R | — |
| `rapport_mes_commandes` | — | — |
| `parametres` | — | — |

**Règle produit explicite :**

- Hôtel caissier **ne peut pas vendre** → pas `restauration` CREATE / pas parcours commande serveur.
- Resto caissier **ne peut pas gérer les chambres** → pas `chambres` UPDATE/DELETE, pas `sejours` CREATE/UPDATE check-in.

---

## 4. Résolution runtime (remplace la matrice hardcodée)

```text
1. Platform admin / org owner → ALL allowed
2. Charger BranchMember.role (slug) pour (user, branch)
3. Charger BranchRole + privileges (cache mémoire / Redis optionnel)
4. can(resource, action) = privilege.allowed === true
5. canSeeDashCard(cardId) = can(cardId, VIEW)   // rétrocompat
6. requirePrivilege(cardId, VIEW) sur pages
7. Actions sensibles : requirePrivilege(resource, CREATE|UPDATE|DELETE)
```

Fichiers cibles :

| Fichier | Rôle |
|---------|------|
| `lib/branch/ops-roles.ts` | Garder slugs/labels ; **déléguer** `canSeeDashCard` → privileges DB (fallback seed TS si DB vide) |
| `lib/branch/privileges.ts` | `getRolePrivileges`, `canPrivilege`, `requirePrivilege` |
| `lib/branch/privilege-seed.ts` | Matrice seed = source de vérité initiale |
| `…/parametres/` | UI matrice rôles |
| `…/branch-menus.ts` | Card `parametres` |
| Forms membres | Select slugs depuis `BranchRole` (actifs) |

---

## 5. UX — carte Paramètres

### Hub

- Nouvelle carte **Paramètres** (`DASH_CARD.PARAMETRES = "parametres"`).
- Visible si `can("parametres", VIEW)`.
- Section dédiée (ex. **ADMINISTRATION**) pour ne pas mélanger avec ops.

### Page `…/branches/[branchId]/parametres` (ou `/parametres/roles`)

1. **Liste des rôles** (tabs ou sidebar) : Serveur, Caissier séjours, Caissier resto, …
2. **Matrice** : lignes = ressources (groupées : Ops / Stock / Rapports / Admin) ; colonnes = `VIEW | READ | CREATE | UPDATE | DELETE` (checkboxes).
3. Actions :
   - Enregistrer (diff privileges)
   - **Réinitialiser au seed** (rôle système)
   - Désactiver une action (retirer) → `allowed = false` ou delete row selon implémentation
4. Aide contextuelle par rôle (ex. « Ce caissier n’encaisse que les séjours — pas la salle »).
5. Audit simple V1 : `updatedAt` + toast ; V1.1 journal `PrivilegeChangeLog`.

### Assignation membre

- Select métier alimenté par `BranchRole` (label FR).
- Afficher badge « legacy caissier » si slug `caissier` encore utilisé → CTA « Choisir séjours ou resto ».

---

## 6. Gardes & périmètre caisse

### Routes

| Zone | Caissier séjours | Caissier resto |
|------|------------------|----------------|
| `/caisse` | OK (folios / paiements séjour) | OK (commandes F&B) |
| `/hotel/sejours` | OK | redirect hub |
| `/hotel/chambres` | lecture seule ou redirect | redirect |
| `/hotel/restauration` | redirect | VIEW OK (pas prendre commande si pas CREATE) |
| `/hotel/cuisine` | redirect | VIEW OK |
| `/parametres` | redirect | redirect |

### Affinage caisse (important)

La page **Caisse & Ventes** est partagée. En V1 :

- Filtrer les **sources d’encaissement** selon privileges :
  - `sejours` UPDATE → encaisser folio / note chambre
  - `restauration` READ + `caisse` CREATE → encaisser commande salle / comptoir
- Si un seul des deux : l’UI caisse n’affiche **que** les files concernées (évite « vendre » côté hôtel).

---

## 7. Phases de livraison

| Phase | Contenu | Critère de done |
|-------|---------|-----------------|
| **P0** | Plan + modèle Prisma + migration + seed rôles/privileges | Tables peuplées ; slugs uniques |
| **P1** | `privileges.ts` + brancher `canSeeDashCard` / `requireDashCard` sur DB | Serveur sans caisse (comportement = actuel) |
| **P2** | Split `caissier_sejours` / `caissier_resto` + migration douce `caissier` | Deux profils distincts sur hub |
| **P3** | Carte + page **Paramètres** (matrice editable) | Gérant retire `restauration` VIEW → carte disparaît |
| **P4** | Gardes actions (createStay, createOrder, openCash, …) | API refuse même si URL forcée |
| **P5** | Caisse filtrée par domaine (séjour vs F&B) | Caissier hôtel ne voit pas file resto |
| **P6** | Polish : labels membres, doc, tests smoke, marquer plan `done` | Build OK |

---

## 8. Mapping seed détaillé (référence implémentation)

Reprendre la matrice actuelle de [`plan-roles-dashboards-hospitalite.md`](./plan-roles-dashboards-hospitalite.md) §2, puis **scinder la colonne Caissier** :

| Carte | Serveur | Caissier séjours | Caissier resto | Réception | Gérant | Owner |
|-------|:-------:|:----------------:|:--------------:|:---------:|:------:|:-----:|
| Caisse | | ✅ | ✅ | | | ✅ |
| Taux | | ✅ | ✅ | | ✅ | ✅ |
| Séjours | | ✅ | | ✅ | ✅ | ✅ |
| Restauration | ✅ | | ✅ VIEW | | | ✅ |
| Cuisine | | | ✅ VIEW | | | ✅ |
| Service stock | | | ✅ | | ✅ | ✅ |
| Chambres / salles | | | | ✅ | ✅ | ✅ |
| Bons / Dépenses | | | | | ✅ | ✅ |
| Rapports ventes | | ✅* | ✅* | | ✅ | ✅ |
| Mes commandes | ✅ | | | | | ✅ |
| Rapport séjours | | ✅ | | ✅ | ✅ | ✅ |
| **Paramètres** | | | | | ✅ | ✅ |

\*Scope reporting : séjour vs F&B selon rôle (filtre `Payment` / `HotelOrder` / folio).

Privileges par carte : au minimum `VIEW` pour apparaître ; `CREATE`/`UPDATE`/`DELETE` selon ops (ex. séjours check-in = UPDATE).

---

## 9. Risques & mitigations

| Risque | Mitigation |
|--------|------------|
| Gérant s’ouvre la caisse via Paramètres | OK produit (c’est le but) ; owner peut reset seed ; option V1.1 : privileges `parametres` non éditables sauf owner |
| Membres `caissier` legacy trop permissifs | Banner + script migration ; deadline soft |
| Perf : query privileges à chaque page | Cache request-scoped + éventuel `unstable_cache` par `roleId` |
| Enum Prisma trop rigide | `resource` string |
| Divergence hub vs action | Une seule API `canPrivilege` |
| Branche HOTEL+resto (Continental) | Les deux caissiers coexistent ; assignation claire à l’embauche |

---

## 10. Checklist d’acceptation

- [x] Seed : tous les rôles système + privileges en base
- [x] Membre **caissier_sejours** → hub sans Restauration / Cuisine / Chambres (ops) ; caisse + séjours OK
- [x] Membre **caissier_resto** → hub sans Séjours / Chambres ; caisse + resto/cuisine VIEW OK
- [x] Caissier séjours ne peut **pas** créer de commande restauration (action refusée)
- [x] Caissier resto ne peut **pas** check-in / gérer chambre (action refusée)
- [x] Carte **Paramètres** visible gérant/owner ; matrice editable ; retrait VIEW masque la carte
- [x] Owner / admin : bypass inchangé
- [x] Legacy `caissier` : comportement documenté + chemin de migration UI
- [x] Serveur / réception : non régression vs plan hospitalité R0–R5

---

## 11. Journal d’exécution

| Phase | Status | Notes |
|-------|--------|-------|
| P0 | `done` | Prisma BranchRole + PrivilegeAction + seed |
| P1 | `done` | `privileges.ts` + requireDashCard async DB |
| P2 | `done` | `caissier_sejours` / `caissier_resto` + legacy union |
| P3 | `done` | Carte + page `/parametres` matrice editable |
| P4 | `done` | Gardes createStay / checkIn / order / quickSale / cash |
| P5 | `done` | Caisse filtrée séjour vs F&B / vente rapide |
| P6 | `done` | Forms membres + seed seed.ts + plan |

---

## 12. Décisions ouvertes (à valider avant P0)

1. **Scope catalogue** : global (décision V1 ci-dessus) vs par organisation vs override par branche ?
2. **Legacy `caissier`** : union temporaire ou migration forcée à la connexion ?
3. **`VIEW` vs `READ`** : fusionner en un seul droit « voir » pour simplifier l’UI Paramètres (5 → 4 colonnes) ?
4. Reporting ventes : un seul rapport filtré, ou deux cards (`rapport_ventes_sejours` / `rapport_ventes_resto`) ?

**Proposition par défaut si pas de feedback :** (1) global, (2) union + banner, (3) garder 5 actions mais UI groupée VIEW/READ, (4) un rapport filtré.
