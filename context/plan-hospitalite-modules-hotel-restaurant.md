# Plan — Modules hospitalité (Hôtel / Restaurant)

| | |
|---|---|
| **Status** | `done` (MVP phases 1–4) |
| **Contexte** | Création de branche sous `app/admin/organizations/[organizationId]/branches/` |
| **Dépend de** | B01 (schéma), B02 (bootstrap), B03 (création), B10 (hôtel MVP) |
| **Lié** | [`units-branches/B10-hotel-mvp.md`](./units-branches/B10-hotel-mvp.md), [`plan-hotel-caisse-sejours-restauration.md`](./plan-hotel-caisse-sejours-restauration.md) |

---

## 1. Objectif métier

À la création d’une branche « hospitalité », permettre de choisir les **actions / modules** :

- **Séjours** (hébergement : chambres + séjours)
- **Restaurant** (F&B : restauration, cuisine, produits vendus)

La **livraison** (entrées / décomptes stock) reste disponible **dans les deux cas** (et quand les deux sont actifs).

Cas réels couverts :

- hôtels **avec** restaurant
- hôtels **sans** restaurant
- restaurants **sans** hébergement

---

## 2. Matrice des combos (conditions)

| Modules cochés | `BranchType` stocké | Libellé UI | Séjours / chambres | Resto / cuisine / produits vente | Livraison |
|----------------|---------------------|------------|--------------------|----------------------------------|-----------|
| Séjours + Restaurant | `HOTEL` | **Hôtel** | Oui | Oui | Oui |
| Séjours seul | `HOTEL` | **Hôtel** | Oui | Non | Oui |
| Restaurant seul | `RESTAURANT` | **Restaurant** | Non | Oui | Oui |
| Aucun | — | — | **Invalide** (bloqué à la création) | | |

**Règle dure :** `(hasStays || hasRestaurant) === true`.

Si les **deux** sont choisis → gestion + dashboard **identiques** au comportement hôtel actuel.

Si **restaurant seul** → retirer séjours + gestion chambres ; le type / nom métier n’est plus « Hôtel » mais **Restaurant**.

---

## 3. Décisions d’architecture (recommandées)

### 3.1 Type + flags (pas seulement l’UI)

Éviter de surcharger `HOTEL` pour tout masquer en front.

1. Étendre l’enum Prisma `BranchType` avec **`RESTAURANT`**.
2. Ajouter sur `Branch` deux booléens explicites (préférables à un JSON opaque pour les queries / guards) :
   - `hasStays` — chambres + séjours
   - `hasRestaurant` — restauration + cuisine + produits de vente F&B
3. Dériver le `type` à la création :
   - `hasStays && hasRestaurant` → `HOTEL` + flags `true/true`
   - `hasStays && !hasRestaurant` → `HOTEL` + `true/false`
   - `!hasStays && hasRestaurant` → `RESTAURANT` + `false/true`

### 3.2 Chemins URL

Conserver le préfixe module **`/hotel/*`** pour `HOTEL` **et** `RESTAURANT` en phase 1 (moins de refacto).

- `moduleForBranchType` : `HOTEL | RESTAURANT` → `"hotel"`
- Le **gating** se fait sur `hasStays` / `hasRestaurant`, pas sur le préfixe URL
- Alias `/restaurant/*` = optionnel plus tard

### 3.3 Helpers centraux

Créer `lib/branch/hospitality.ts` (ou équivalent) :

- `isHospitality(type)` → `HOTEL | RESTAURANT`
- `canAccessStays(branch)` / `canAccessRestaurant(branch)`
- `branchTypeLabel(type)` → « Hôtel » | « Restaurant » | …
- `assertHospitalityModule(branch, "stays" | "restaurant")` pour actions serveur

Toute page et toute server action hospitalité doit passer par ces helpers.

---

## 4. Conditions détaillées

### 4.1 Création (`create-branch-form` + `actions.ts`)

- Remplacer / enrichir la carte type « Hôtel » par **Hospitalité** (ou garder Hôtel + sous-choix).
- Afficher 2 checkboxes : **Séjours**, **Restaurant** (défaut recommandé : les deux cochés pour rétrocompat UX).
- Zod : au moins un module ; mapper type + flags.
- Bootstrap (`bootstrap-branch.ts`) conditionnel :
  - `hasStays` → types de chambres + inventaire
  - `hasRestaurant` → menu démo F&B
  - jamais de chambres si `!hasStays`

### 4.2 Navigation / dashboard (`branch-menus.ts`, `branch-dashboard.tsx`)

| Entrée menu | Visible si |
|-------------|------------|
| Séjours | `hasStays` |
| Chambres | `hasStays` |
| Restauration | `hasRestaurant` |
| Cuisine | `hasRestaurant` |
| Produits (carte) | `hasRestaurant` |
| Livraison | `hasStays \|\| hasRestaurant` |
| Caisse / Taux / Rapports | toujours (hospitalité) |

Labels welcome / navbar / liste branches : **Restaurant** si `type === RESTAURANT`, sinon **Hôtel**.

**Ne pas** lister les noms d’équipe / modules inactifs dans le titre.

### 4.3 Garde-fous routes & actions (critique)

| Route / action | Si flag absent |
|----------------|----------------|
| `/hotel/chambres`, `/hotel/sejours` | redirect hub si `!hasStays` |
| `/hotel/restauration`, `/hotel/cuisine` | redirect si `!hasRestaurant` |
| `/hotel/produits` | redirect si `!hasRestaurant` (phase 1) |
| `/hotel/livraison` | OK si hospitalité |
| Server actions séjour / chambre | `assert` `hasStays` |
| Server actions F&B commande / cuisine | `assert` `hasRestaurant` |

Cacher le menu **ne suffit pas** : URL directe + actions serveur doivent refuser.

`requireBranchContext({ requireModule: "hotel" })` doit accepter **`HOTEL` et `RESTAURANT`**.

### 4.4 Caisse

| Profil | Comportement caisse |
|--------|---------------------|
| Les deux | Inchangé (folios séjour + files F&B) |
| Séjours seul | Folios / nuitées ; pas de file resto |
| Restaurant seul | Files F&B / vente rapide ; pas de folios chambre |

### 4.5 Rapports

- KPI occupation / séjours → seulement si `hasStays`
- KPI ventes F&B / articles cuisine → si `hasRestaurant`
- Flux livraison / stock → hospitalité (les deux flags utiles)
- Tableau de bord : masquer blocs hors modules

### 4.6 Migration branches existantes

Toutes les branches `HOTEL` actuelles :

```text
hasStays = true
hasRestaurant = true
```

Aucune branche `RESTAURANT` tant qu’on n’en crée pas.

### 4.7 Édition ultérieure (phase 2)

Pouvoir activer / désactiver un module après création, avec gardes :

- désactiver `hasStays` interdit s’il existe séjours actifs / chambres occupées
- désactiver `hasRestaurant` interdit s’il existe commandes ouvertes

Sinon : modules figés à la création (dette produit acceptable en MVP).

---

## 5. Plan d’exécution par phases

### Phase 0 — Cadrage (avant code)

- [x] Matrice des 3 combos (dont hôtel sans resto)
- [x] Valider `BranchType.RESTAURANT` + `hasStays` / `hasRestaurant`
- [x] Valider URL reste `/hotel/*` pour les deux
- [x] Valider : produits + cuisine uniquement si `hasRestaurant`

### Phase 1 — Données

1. [x] Prisma : enum `RESTAURANT` + booléens `hasStays`, `hasRestaurant`
2. [x] Migration SQL + backfill `HOTEL` → `true/true`
3. [x] Helpers `lib/branch/hospitality.ts`
4. [x] Étendre types TS (`user-branches`, `paths.moduleForBranchType`, etc.)

### Phase 2 — Création

1. [x] UI formulaire : checkboxes modules + textes d’aide
2. [x] `createBranchWithBootstrapAction` : Zod + persistance
3. [x] `bootstrapBranchByType` : seed conditionnel
4. [x] Liste branches : badge / compteurs adaptés

### Phase 3 — UX & accès

1. [x] `branch-menus.ts` filtré par flags
2. [x] Labels dashboard / layout / liste
3. [x] Guards pages sous `hotel/*`
4. [x] Guards server actions `lib/hotel/actions.ts`
5. [x] Caisse & rapports filtrés

### Phase 4 — Polish

1. [x] Labels type Restaurant / Hôtel
2. [x] Notifications cloche pour hospitalité (`HOTEL` + `RESTAURANT`)
3. [ ] Édition modules après création (hors scope MVP)
4. [ ] Smoke test manuel des 3 combos

---

## 6. Fichiers touchés (indicatif)

| Zone | Fichiers |
|------|----------|
| Schéma | `prisma/schema.prisma` |
| Création | `branches/new/components/create-branch-form.tsx`, `branches/actions.ts` |
| Bootstrap | `lib/branch/bootstrap-branch.ts` |
| Menus / labels | `lib/branch/branch-menus.ts`, `branch-dashboard.tsx`, `layout.tsx`, `branches/page.tsx` |
| Paths / accès | `lib/branch/paths.ts`, `require-branch-context.ts`, `user-branches.ts` |
| Métier | `lib/hotel/actions.ts`, pages `hotel/*`, `caisse/*`, `rapports/*` |
| Client Prisma HMR | `lib/prisma.ts` (`PRISMA_SCHEMA_REV`) |

---

## 7. Critères d’acceptation

1. Création **resto seul** → type **Restaurant**, pas de Séjours/Chambres au menu, Livraison présente ; URL `/hotel/sejours` → redirect hub.
2. Création **hôtel + resto** → comportement **identique** à l’existant.
3. Création **séjours seul** → Hôtel sans resto/cuisine/produits vente ; Livraison présente.
4. Actions serveur hors module → erreur / refus (pas seulement UI).
5. Anciennes branches `HOTEL` → `hasStays` + `hasRestaurant` à `true`.
6. AGENCE / BOUTIQUE **non impactés**.
7. `requireModule: "hotel"` fonctionne pour `RESTAURANT`.

---

## 8. Smoke test manuel

```text
1. Créer branche Hospitalité : Séjours + Restaurant
   → Dashboard = menus actuels hôtel ; type « Hôtel »
2. Créer branche : Restaurant seul
   → Type « Restaurant » ; pas Chambres/Séjours ; Livraison + Resto + Cuisine OK
3. Créer branche : Séjours seul
   → Type « Hôtel » ; pas Resto/Cuisine ; Chambres/Séjours + Livraison OK
4. Coller URL interdite → redirect hub
5. Vérifier AGENCE / BOUTIQUE inchangés
```

---

## 9. Hors scope (volontaire)

- Renommer le dossier URL `hotel/` → `hospitality/` (trop large pour le MVP)
- Marketplace / livraison client à domicile (≠ livraison stock consommables)
- Migration auto de données métier lors du toggle modules (phase 2)

---

## 10. Ordre recommandé vs units branches

```text
B01/B02/B03 (déjà en place)
  → ce plan (modules hospitalité)
  → complète / affine B10 (hôtel MVP) et plan-hotel-caisse-…
```

Prochaine action concrète après validation : **Phase 1 (schéma + migration + helpers)**.
