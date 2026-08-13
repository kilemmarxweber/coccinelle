# Plan — Clients partenaires (sociétés) : base CRM, multi-espaces, prix négocié & paiement différé

| | |
|---|---|
| **Status** | `in_progress` — Phases A–D partielles livrées (CRM hôtel + agence, lien séjour, BANK, crédit fin) |
| **Périmètre** | Branche `HOTEL` (`hasStays`) — chambres (`ROOM`) **et** salles (`MEETING`) · **+ AGENCE** (même CRM `BranchPartner`) |
| **Contexte** | Une **société / organisation partenaire** réserve 1 ou plusieurs chambres / salles. Fiche partenaire = coordonnées société (sans pièce d’identité). La **pièce d’identité + scan/photo** est saisie sur **chaque séjour** (occupant), y compris si facturé à une société. Prix négocié à la main ; paiement avant ou à la fin (cash / banque). |
| **Lié** | [`plan-prix-negociable-sejour.md`](./plan-prix-negociable-sejour.md) (tarif appliqué / forfait), [`plan-salle-reservation-caution-consommation.md`](./plan-salle-reservation-caution-consommation.md), [`plan-sejour-note-chambre.md`](./plan-sejour-note-chambre.md), [`plan-hotel-caisse-sejours-restauration.md`](./plan-hotel-caisse-sejours-restauration.md), [`plan-reservation-groupee-sejours.md`](./plan-reservation-groupee-sejours.md) (**wizard multi-chambres** + occupants sur place) |

---

## 1. Besoin métier (reformulé)

Cas typique **client partenaire** (souvent une **société**) :

1. L’hôtel tient une **base de partenaires** (fiche société : nom, contacts, téléphone, **adresse**, notes commerciales).
2. Fiche partenaire : raison sociale, contact, **adresse société** (pas de pièce d’identité).
3. **Identité occupant (tout séjour)** : à la réservation, saisie **adresse + pièce d’identité** (type, n°, scan/photo) sur le séjour — walk-in **et** occupant facturé à une société.
4. Le partenaire **réserve 1 ou N espaces** (chambres et/ou salles) sur une même période — parfois pour des **occupants différents** (employés) sous la même facture société ; **chaque occupant** a sa propre pièce.
5. Le **tarif n’est pas le catalogue** : le staff saisit un **prix négocié** (nuitée ou forfait) **à la main** — déjà partiellement couvert par le mode négociable / `FLAT`.
6. Le règlement est **flexible** :
   - **Avant** le séjour (acompte ou total à la réservation / check-in) ;
   - **À la fin** du séjour (solde au check-out — « crédit partenaire ») ;
   - Méthodes : **cash** ou **banque** (virement / dépôt banque) — en plus des moyens déjà en caisse si utiles.
7. La réception doit voir rapidement : **qui doit quoi**, quels séjours sont liés, quel solde société reste ouvert ; consulter / réafficher la pièce d’identité **de l’occupant** depuis le séjour.

Ce n’est **pas** le `Client` voyage (agence / `User`) : c’est un **compte commercial hôtel**, branch-scoped, sans compte login obligatoire.

---

## 2. Améliorations retenues (idée → réalité terrain)

| Idée brute | Décision | Pourquoi |
|------------|----------|----------|
| « Base de clients partenaires » | Modèle dédié **`BranchPartner`** (hôtel + agence, pas le `Client` transport) | `Client` est lié à `User` + réservations voyage ; CRM commercial branch-scoped |
| « Souvent une société » | Fiche avec `name` (raison sociale), contact, téléphone, email, **adresse obligatoire**, `taxId` optionnel, notes | CRM minimal utile dès V1 |
| Adresse + pièce d’identité | Champs adresse structurés + **type / n° pièce** + **fichier image** (scan ou photo caméra / galerie) | Identification & traçabilité réception ; preuve pour crédit partenaire |
| Stockage de l’image | URL / chemin fichier (`idDocumentImageUrl`) — upload local ou objet storage ; aperçu + remplacer | Pas de blob en base ; poids maîtrisé (JPEG/PNG/WebP, max ~5 Mo) |
| Qui porte la pièce ? | **V1 : pièce de l’occupant sur chaque `HotelStay`** (walk-in et partenaire). Fiche société = adresse commerciale, **sans** pièce d’identité. | Société ≠ personne ; registre / police = occupant réel |
| 1 ou plusieurs chambres / salles | **`PartnerBooking`** (dossier) + **N `HotelStay`** liés | Planning chambre/salle reste 1 stay = 1 espace ; le dossier regroupe facturation & paiement |
| Réduction / prix négocié | Réutiliser `unitPriceApplied` / `flatAmount` / `rateNote` **par stay** ; option **tarif défaut partenaire** prérempli | Pas de second moteur de prix ; audit déjà prévu |
| Payer avant ou à la fin | Enum `PartnerPayTiming` : `PREPAID` \| `AT_CHECKOUT` ; acomptes toujours possibles | Clarté UX + garde-fous check-out |
| Cash ou banque | Ajouter `PaymentMethod.BANK` (+ référence virement optionnelle) | Aujourd’hui : `CASH` / `MOBILE_MONEY` / `CARTE` seulement |
| Occupant ≠ société | `guestName` = personne physique ; `partnerId` = payeur / facturé | Badge « Facturé à Société X » sur note |
| Une seule note pour N chambres | **V1 : 1 folio / stay** + **paiements rattachés au dossier** (répartition) ; **V1.1** folio maître optionnel | Moins de refonte caisse ; reporting partenaire via agrégat |
| Caution salle | Inchangée si `MEETING` + caution | Compatible plan salle |
| Remise % catalogue fixe | Hors V1 (grille commerciale) | Terrain = montant saisi à la main |

### Règles métier V1 (non négociables)

1. **Partenaire nommé** — toute réservation partenaire part d’une fiche `HotelPartner` active (création inline autorisée).
2. **Adresse obligatoire** — rue / quartier + ville (au minimum) sur la fiche avant de confirmer un dossier ou un crédit `AT_CHECKOUT`.
3. **Pièce d’identité occupant** — type + numéro + **image** (scan JPEG/PNG/WebP ou photo prise sur place) sur **chaque séjour** ; obligatoire à la réservation, **même** si un partenaire est facturé. Fiche partenaire : adresse société seulement (pas de pièce).
4. **Au moins 1 espace** — dossier = ≥ 1 stay (`ROOM` et/ou `MEETING`).
5. **Prix négocié explicite** — si écart catalogue → `rateNote` requis (même règle que plan négociable).
6. **Timing de paiement choisi** à la création du dossier :
   - `PREPAID` : acompte ou total **avant** (ou à) check-in ; check-in bloqué si `paid < seuil` (défaut : tout dû hébergement, conso hors scope).
   - `AT_CHECKOUT` : check-in autorisé sans paiement ; solde à encaisser / banque à la clôture (file caisse) — **uniquement si adresse société + pièce occupant du séjour présentes**.
7. **Méthodes** — `CASH` ou `BANK` au minimum pour ce flux (autres méthodes caisse OK si déjà ouvertes).
8. **Banque** — paiement `BANK` : montant + **référence** (n° virement / bordereau) + note ; n’augmente **pas** le float cash session (mouvement hors caisse physique).
9. **Check-out** — chaque stay se clôture ; le dossier passe `CLOSED` quand tous les stays sont terminés / annulés **et** solde dossier ≈ 0 (ou écriture de solde ouverte documentée — V1.1).
10. **Désactivation** — partenaire `INACTIVE` : plus de nouveaux dossiers ; historique + image pièce **conservés** (pas de purge auto).

---

## 3. Terminologie UI

| Terme | Sens |
|-------|------|
| **Client partenaire** | Société / org. avec fiche CRM hôtel |
| **Dossier partenaire** | `PartnerBooking` : 1 réservation multi-espaces liée à un partenaire |
| **Occupant** | Personne dans la chambre / salle (`guestName`) |
| **Adresse client** | Adresse de l’occupant sur le séjour (obligatoire) · adresse société sur la fiche partenaire |
| **Pièce d’identité** | CNI / passeport / permis / autre de **l’occupant** — type, n°, image scan ou photo (tout séjour) |
| **Scan / photo pièce** | Fichier image de la pièce (upload ou capture caméra) |
| **Tarif catalogue** | `priceNight` type d’espace (référence) |
| **Tarif négocié** | Montant appliqué saisi à la main |
| **Paiement anticipé** | Avant / à l’arrivée (`PREPAID`) |
| **Paiement fin de séjour** | Solde au départ (`AT_CHECKOUT`) |
| **Paiement banque** | Virement / dépôt banque (`BANK`) — hors float cash |
| **Solde partenaire** | Σ dus − Σ payés sur dossiers ouverts |
| **Facturé à** | Raison sociale sur note / reçu |

**Libellés proposés :**

```text
[ Clients partenaires ]     [ Nouveau dossier partenaire ]
Société · Contact · Tél · Adresse société
[ Ajouter chambre ] [ Ajouter salle ] → occupant + identité (pièce) · tarif négocié / motif
Paiement : ○ Avant séjour  ○ À la fin
Méthode : Cash | Banque (réf. …)
```

Note / reçu :

```text
Facturé à : ACME SARL
Occupant : Jean Dupont · Ch. 12
Tarif négocié 45 $ / nuit (catalogue 60 $) · −25 %
```

---

## 4. État actuel (constat code)

Déjà en place :

- `HotelStay` avec `guestName` / phone / email **libres** (pas de lien CRM)
- Tarification négociable : `billingMode`, `catalogUnitPrice`, `unitPriceApplied`, `flatAmount`, `rateNote`
- 1 stay = 1 `HotelRoom` (chambre **ou** salle) + 1 `Folio`
- Caisse : session, paiements folio, file check-out, cash / mobile / carte
- Salles : paiement location + caution conso (plan dédié)
- `BranchExpense` avec kind `DEPOT_BANQUE` (sortie caisse → banque) — **autre** sujet que « client paie par virement »

Manques :

- Pas de fiche **partenaire / société** côté hôtel
- Pas de collecte structurée **adresse + pièce d’identité** (scan / photo) **sur chaque séjour** (occupant)
- Pas d’upload / capture d’image pièce lié à une fiche client
- Pas de **regroupement multi-chambres / multi-salles** sous un même dossier
- Pas de `PaymentMethod.BANK` côté encaissement client
- Pas de mode **crédit / paiement fin de séjour** formalisé (hors acomptes partiels ad hoc)
- Pas de vue **créances partenaires** / solde ouvert
- Création séjour = 1 espace à la fois dans le wizard actuel

---

## 5. Décisions d’architecture (recommandées)

### 5.1 Entité `HotelPartner` (CRM branche)

Scope : **`branchId`** (pas org entière en V1 — une société peut avoir des accords différents par hôtel).

Champs clés : raison sociale, contact principal, téléphone, email, **adresse** (obligatoire), NIF / RCCM optionnel, notes, statut `ACTIVE` / `INACTIVE`, option **tarif indicatif** (`defaultNightlyRate` / `%` hint UI — **non** auto-appliqué sans validation staff).

**Adresse société (fiche partenaire) — pas de pièce d’identité sur la société :**

| Champ | Obligatoire V1 | Notes |
|-------|----------------|-------|
| `address` (ligne) | oui | Rue / avenue / quartier |
| `city` | oui | Ville |
| `taxId` | non | NIF / RCCM |

**Identité occupant (chaque `HotelStay`, y compris partenaire) :**

| Champ | Obligatoire V1 | Notes |
|-------|----------------|-------|
| `guestAddress` / `guestCity` | oui | Adresse de la personne dans la chambre / salle |
| `idDocumentType` | oui | `CNI` \| `PASSPORT` \| `PERMIS` \| `AUTRE` |
| `idDocumentNumber` | oui | N° pièce de l’occupant |
| `idDocumentImageUrl` | oui | Scan ou photo (URL / chemin) |
| `idDocumentCapturedAt` | auto | Date d’upload / capture |

Upload : input fichier **ou** capture caméra (mobile / webcam). Formats V1 : JPEG, PNG, WebP (PDF multi-pages en V1.1). Taille max ~5 Mo. Remplacer = nouvel upload (ancienne URL orpheline nettoyable plus tard).

Accès : aperçu sur fiche (staff authentifié uniquement) — pas d’URL publique indexable.

### 5.2 Dossier `PartnerBooking` + N stays

```text
HotelPartner 1──* PartnerBooking 1──* HotelStay (via partnerBookingId)
                              └────* Payment (paiements dossier, optionnel)
```

- Chaque stay garde son **folio** (nuitées / forfait / F&B / caution salle).
- Le dossier porte : `payTiming`, dates globales indicatives, `label`, statut, totaux dénormalisés optionnels.
- `HotelStay.partnerId` (dénormalisé) + `partnerBookingId` pour filtres rapides.

**Pourquoi pas 1 seul folio maître en V1 :** la caisse, la note chambre, le Sur note F&B et la caution salle sont déjà branchés sur `stay.folio`. Un folio maître imposerait une refonte large. L’agrégat dossier + répartition des paiements suffit.

### 5.3 Répartition des paiements multi-espaces

Quand le partenaire paie **un montant global** (ex. 500 $ pour 3 chambres) :

1. Enregistrer le `Payment` avec `partnerBookingId` (+ éventuellement sans `folioId` **ou** avec répartition).
2. **Reco V1 :** ventiler automatiquement au prorata des **soldes hébergement ouverts** des folios du dossier (arrondi sur le dernier) ; chaque folio reçoit sa part.
3. Alternative UI : ventilation manuelle ligne par ligne (Phase E).

Acomptes et soldes partiels restent possibles.

### 5.4 Timing `PREPAID` vs `AT_CHECKOUT`

| Timing | Check-in | Check-out |
|--------|----------|-----------|
| `PREPAID` | Exiger paiement ≥ dû hébergement (param) **ou** acompte min configurable (défaut 100 % hébergement) | Conso / extras restants en caisse comme aujourd’hui |
| `AT_CHECKOUT` | Autorisé sans paiement | File caisse / encaissement cash ou banque du solde dossier + folios |

**Exception salles walk-in** (sans partenaire) : conserver la règle « paiement location obligatoire » du plan salle.  
**Avec partenaire + `AT_CHECKOUT` :** la garde location peut être assouplie **uniquement** si `partnerBookingId` présent, timing = fin de séjour, **et** adresse société + **pièce occupant du séjour** complètes (documenter dans `createStayAction`).

### 5.5 `PaymentMethod.BANK`

- Ajouter à l’enum Prisma.
- UI caisse / wizard : champ **Référence banque** (`Payment.note` ou `bankReference` dédié).
- Reporting : séparer CA cash session vs encaissements banque (ne pas gonfler le fond de caisse).
- Session caisse : paiement `BANK` **autorisé** sans toucher `closingCash` attendu (comme hors-cash) — aligner helpers caisse.

### 5.6 Pièce d’identité occupant — stockage

- **Reco V1 :** upload vers stockage privé branche + chemin / URL en DB (`HotelStay.idDocumentImageUrl`).
- Servir l’image via route authentifiée (éviter dossier `public/` indexable).
- Helper dédié : `lib/hotel/guest-id-document.ts`.
- Métadonnées optionnelles : `mimeType`, `sizeBytes`.
- Pas d’OCR / lecture auto du n° en V1 (saisie manuelle du numéro).

### 5.7 Permissions

- Créer / éditer partenaire (adresse société) : réception + manager.
- Saisir / voir / télécharger image pièce **occupant** : mêmes rôles (pas d’exposition anonyme).
- Valider tarif fortement réduit (ex. > 30 %) : option Phase F (`canNegotiateStayRate`).
- Enregistrer paiement banque : caissier / manager.

---

## 6. Modèle de données (proposition)

### 6.1 Enums

```text
enum HotelPartnerStatus {
  ACTIVE
  INACTIVE
}

enum IdDocumentType {
  CNI
  PASSPORT
  PERMIS
  AUTRE
}

enum PartnerBookingStatus {
  DRAFT
  CONFIRMED
  IN_HOUSE      // au moins 1 stay CHECKED_IN
  CHECKING_OUT  // soldes en cours
  CLOSED
  CANCELLED
}

enum PartnerPayTiming {
  PREPAID
  AT_CHECKOUT
}

enum PaymentMethod {
  CASH
  MOBILE_MONEY
  CARTE
  BANK          // nouveau
}
```

### 6.2 Models

```text
model HotelPartner {
  id              String
  branchId        String
  name            String              // raison sociale
  contactName     String?
  phone           String?
  email           String?
  /// Adresse société (obligatoire V1)
  address         String
  city            String
  taxId           String?             // NIF / RCCM
  notes           String?
  status          HotelPartnerStatus  @default(ACTIVE)
  /// Hint UI uniquement (préremplissage)
  defaultUnitPriceHint Float?
  defaultDiscountPctHint Float?
  createdAt / updatedAt
  bookings        PartnerBooking[]
  stays           HotelStay[]
}

model PartnerBooking {
  id              String
  branchId        String
  partnerId       String
  code            String              // ex. PRT-00042 unique / branche
  label           String?             // "Séminaire Q3", "Mission Kin"
  payTiming       PartnerPayTiming
  status          PartnerBookingStatus @default(CONFIRMED)
  notes           String?
  createdByUserId String
  createdAt / updatedAt
  partner         HotelPartner
  stays           HotelStay[]
  payments        Payment[]           // optionnel : paiements dossier
}
```

### 6.3 Extensions existantes

```text
HotelStay
  + partnerId         String?
  + partnerBookingId  String?
  + guestAddress / guestCity          // occupant — tout séjour
  + idDocumentType / Number / ImageUrl / CapturedAt  // pièce occupant — tout séjour

Payment
  + partnerBookingId  String?
  + bankReference     String?   // si method = BANK
```

Indexes : `[branchId, status]` partenaires ; `[partnerId]` ; `[partnerBookingId]` stays / payments.

---

## 7. UX — parcours

### 7.1 Carte Dashboard HOTEL

Nouvelle carte **Clients partenaires** →  
`/admin/organizations/[orgId]/branches/[branchId]/hotel/partenaires`

Sous-routes : liste · fiche · nouveau dossier.

### 7.2 CRUD partenaires

- Liste searchable (nom, tél, contact).
- Fiche : infos + **adresse société** + **dossiers** + **solde ouvert** + historique séjours.
- Formulaire création / édition :
  1. Société + contact + tél / email ;
  2. **Adresse** (ligne + ville) — obligatoire.
- Création rapide depuis le wizard séjour (« + Nouveau partenaire ») avec les mêmes champs société.
- **Identité occupant** : toujours dans le wizard séjour (adresse + type / n° / scan-photo), même si un partenaire est sélectionné.

### 7.3 Wizard « Nouveau dossier partenaire »

1. Choisir / créer **partenaire** (bloquer si adresse société manquante — compléter inline).
2. Libellé dossier + **timing paiement** (Avant / À la fin).
3. **Ajouter espaces** (répétable) :
   - type chambre ou salle, dates, occupant ;
   - **identité occupant** (adresse + pièce) obligatoire par stay ;
   - tarif catalogue affiché → **tarif négocié** manuel + motif ;
   - mode nuitée / forfait si applicable.
4. Récap total dossier.
5. Si `PREPAID` → étape **Encaisser** (cash / banque, total ou acompte) + ventilation.
6. Confirmation → stays `RESERVED` ou `CHECKED_IN` selon action.

### 7.4 Pendant le séjour

- Badge partenaire sur planning / liste séjours.
- Note : « Facturé à {société} » + occupant.
- Ajout d’un espace au dossier ouvert (même partenaire / dates proches).
- Paiement partiel dossier depuis fiche ou caisse.

### 7.5 Clôture

- Check-out stay par stay (flux actuel) ; si `AT_CHECKOUT` et solde > 0 → file caisse (cash ou banque).
- Quand tous les stays du dossier sont `CHECKED_OUT` / `CANCELLED` et solde dossier ≈ 0 → `PartnerBooking.CLOSED`.
- Impression **facture globale dossier** (agrégat P.U. / qté / montants / totaux + identité société + signature gérant/manager) — détail & phases dans [`plan-reservation-groupee-sejours.md`](./plan-reservation-groupee-sejours.md) §5.5 / **G8** (même document pour groupe particulier).

---

## 8. Phases d’exécution

### Phase A — Fondations données & CRM (+ identité)

| # | Tâche | Critère done |
|---|--------|--------------|
| A1 | `HotelPartner` + enums + migration | Schéma OK |
| A2 | Champs **adresse société** (`address`, `city`) | Persistés |
| A3 | CRUD server actions + page liste / fiche partenaires | Créer / éditer / désactiver |
| A4 | Garde : fiche incomplète (sans adresse) → pas de crédit / dossier | Erreur claire |
| A5 | Carte Dashboard « Clients partenaires » | Visible branche `hasStays` |
| A6 | Recherche nom / tél / contact | Filtre liste |
| A7 | **Identité occupant** sur `HotelStay` (adresse + pièce scan/photo) — **tout séjour** | Obligatoire à la réservation |

**Critère phase A :** on crée une société avec adresse (sans pièce) ; un séjour walk-in exige pièce occupant.

---

### Phase B — Lien séjour + prix négocié partenaire

| # | Tâche | Critère done |
|---|--------|--------------|
| B1 | `partnerId` / `partnerBookingId` sur `HotelStay` | Migration |
| B2 | `PartnerBooking` + code `PRT-xxxxx` | Création dossier 1 stay |
| B3 | Wizard / dialog : choisir partenaire **et** saisir identité occupant | Stay lié + pièce occupant |
| B4 | Préremplir tarif hint partenaire ; forcer motif si négocié | Aligné plan prix négociable |
| B5 | Afficher « Facturé à » sur note / PDF | Visible |

**Critère phase B :** 1 chambre ou 1 salle réservée pour une société, occupant identifié (pièce), tarif saisi à la main.

---

### Phase C — Multi-espaces + timing paiement

| # | Tâche | Critère done |
|---|--------|--------------|
| C1 | Wizard dossier : ajouter N chambres / salles | N stays / 1 booking |
| C2 | `PartnerPayTiming` PREPAID / AT_CHECKOUT | Persisté |
| C3 | Garde check-in `PREPAID` (acompte / total) | Blocage si non payé |
| C4 | `AT_CHECKOUT` : check-in sans paiement ; assouplir garde salle **si** partenaire + pièce occupant OK | Documenté + test |
| C5 | Statuts dossier (`IN_HOUSE`, etc.) dérivés des stays | Cohérents |

**Critère phase C :** société réserve 3 chambres + 1 salle, paie à la fin, check-in OK.

---

### Phase D — Encaissement cash / banque & clôture

| # | Tâche | Critère done |
|---|--------|--------------|
| D1 | `PaymentMethod.BANK` + `bankReference` | Enum + UI |
| D2 | Paiement dossier + **ventilation** auto sur folios | Soldes corrects |
| D3 | Caisse : encaisser solde partenaire (cash / banque) sans gonfler float si BANK | Helpers caisse |
| D4 | Check-out + clôture dossier quand soldes OK | Status `CLOSED` |
| D5 | Facture / récap agrégé dossier (aperçu + print) — **voir G8** [`plan-reservation-groupee-sejours.md`](./plan-reservation-groupee-sejours.md) : P.U./qté/totaux, identité société, signature gérant/manager, remise société | Document émis |

**Critère phase D :** payer 1 200 $ par virement réparti sur 3 notes ; float cash inchangé ; dossier clos.

---

### Phase E — Caisse, créances & polish UX

| # | Tâche | Critère done |
|---|--------|--------------|
| E1 | Vue **Créances partenaires** (dossiers ouverts + solde) | Liste actionnable |
| E2 | Ventilation manuelle des paiements (override prorata) | UI |
| E3 | Filtres planning / séjours « Partenaires seulement » | Filtre |
| E4 | Ajout d’espace à un dossier déjà ouvert | Stay rattaché |
| E5 | Notifications : solde partenaire en file check-out | In-app |

**Critère phase E :** réception suit les impayés société au quotidien.

---

### Phase F — Gouvernance & reporting (plus tard)

- Plafond % remise + permission manager
- Grille tarifaire partenaire par type de chambre (catalogue négocié persistant)
- Export Excel créances / CA partenaires
- Multi-branches (partenaire org-level)
- Folio maître unique (refonte) si le prorata devient insuffisant
- Relances / échéances de paiement (net 7 / 15 / 30)
- OCR / PDF multi-pages pour la pièce occupant

---

## 9. Ordre d’implémentation suggéré

1. **Phase A** — CRM `HotelPartner` (adresse société) + **identité occupant sur tout séjour** + carte dashboard.  
2. **Phase B** — Lien 1 stay + affichage facturé à + tarif négocié.  
3. **Phase C** — Multi-espaces + PREPAID / AT_CHECKOUT.  
4. **Phase D** — `BANK` + ventilation + facture dossier.  
5. **Phase E** — Créances + polish.  
6. **Phase F** — Gouvernance / grilles.

---

## 10. Impacts techniques (fichiers clés)

| Zone | Changement |
|------|------------|
| `prisma/schema.prisma` | `HotelPartner` (adresse société), `PartnerBooking`, enums, `PaymentMethod.BANK`, FK stays / payments, **pièce occupant sur `HotelStay`** |
| `lib/hotel/partners.ts` (nouveau) | CRUD, solde, codes PRT, validation adresse société |
| `lib/hotel/guest-id-document.ts` | Upload scan/photo pièce **occupant**, validation |
| `lib/hotel/partner-booking.ts` (nouveau) | Création multi-stays, timing, ventilation paiements |
| `lib/hotel/actions.ts` | `createStayAction` : partner + **identité occupant obligatoire** + assouplissement salle si crédit |
| `lib/cash/*` | Paiements BANK hors float ; file check-out partenaire |
| `…/hotel/partenaires/*` | Pages liste / fiche (adresse société) / wizard dossier |
| `sejours-client.tsx` | Sélecteur partenaire, badges, **bloc identité occupant toujours visible** |
| Note / PDF | Bloc « Facturé à » (pas l’image pièce sur le reçu) |
| Dashboard hub | Nouvelle carte |

---

## 11. Hors scope (volontaire V1)

- Compte login self-service pour la société (portail B2B).
- Facturation électronique légale / e-invoicing fiscal.
- Contrats cadres multi-années avec indexation auto.
- Partage automatique du partenaire entre toutes les branches de l’org.
- Fusion avec `Client` agence voyage.
- Remises F&B automatiques partenaires (conso = prix carte sauf saisie manuelle).
- OCR automatique de la pièce / extraction du n° depuis l’image.
- Stockage cloud externe (S3) — V1 chemin local / disque app suffit.
- PDF multi-pages pour la pièce — V1 images JPEG/PNG/WebP.

---

## 12. Risques & points d’attention

| Risque | Mitigation |
|--------|------------|
| Confusion paiement banque client vs `DEPOT_BANQUE` (sortie caisse) | Libellés distincts ; `PaymentMethod.BANK` ≠ `BranchExpense` |
| Float caisse faussé par virements | Exclure `BANK` du cash compté |
| Multi-folios : paiement mal ventilé | Prorata + reste sur dernier folio ; logs |
| Salle sans paiement (règle plan salle) vs crédit partenaire | Garde conditionnelle `partnerBookingId` + `AT_CHECKOUT` + pièce occupant complète |
| Occupant affiché comme payeur | Toujours afficher « Facturé à » + occupant séparés |
| Dossier jamais clos | Job / action manuelle « Clôturer » si stays done + solde 0 |
| Doublons sociétés | Recherche avant create + merge manuel Phase F |
| Image pièce exposée publiquement | Serving authentifié ; pas de dossier public listable |
| Fichier trop lourd / format invalide | Validation MIME + max 5 Mo côté serveur |
| Données sensibles (CNI) | Accès staff only ; conservation avec la fiche ; pas sur reçus PDF |

---

## 13. Questions à trancher avant / pendant le code

1. **Acompte PREPAID** : 100 % hébergement obligatoire, ou % mini configurable (ex. 50 %) ? *(Reco V1 : 100 % hébergement ; conso à part.)*  
2. Ventilation auto **prorata soldes** vs **ordre de création des stays** ? *(Reco : prorata soldes ouverts.)*  
3. Paiement `BANK` : session caisse **obligatoire** ou enregistrement manager hors session ? *(Reco : session ouverte pour traçabilité caissier, sans impacter float.)*  
4. Devise de négociation : toujours USD note (comme aujourd’hui) ? *(Reco : oui.)*  
5. Un partenaire peut-il avoir des tarifs différents chambre vs salle par défaut ? *(Reco V1 : un seul hint ; négociation manuelle par stay.)*  
6. Pièce d’identité **occupant** : obligatoire à **chaque** réservation séjour (walk-in et partenaire). Fiche société : adresse seulement.  
7. Accepter le **PDF** scan multi-pages en V1, ou images seules (JPEG/PNG/WebP) ? *(Reco V1 : images ; PDF en V1.1.)*

---

## 14. Critères d’acceptation globaux (demo)

1. Créer la société **ACME SARL** avec **adresse** — pas de pièce sur la fiche société.  
2. Réserver un séjour facturé à ACME : **identité occupant** (adresse + type, n°, photo ou scan) obligatoire — refus si image manquante.  
3. Dossier : 2 chambres + 1 salle, **une pièce par occupant**, tarifs négociés saisis à la main + motifs.  
4. Timing **À la fin** → check-in des 3 espaces **sans** paiement (pièces occupants + adresse société).  
5. Pendant séjour : 1 commande Sur note sur une chambre → solde folio à jour.  
6. Au départ : encaisser le total dossier en **Banque** (réf. virement) → folios soldés, float cash **inchangé**, dossier `CLOSED`.  
7. Autre dossier **Avant séjour** : refus de check-in tant que l’hébergement n’est pas payé (cash OK).  
8. Note PDF : « Facturé à ACME SARL » + nom de l’occupant (**sans** image CNI sur le reçu).

---

## 15. Synthèse

Livrer d’abord la **base CRM partenaires** (adresse société) et l’**identité occupant sur tout séjour** (adresse + pièce scannée/photographiée), puis le **dossier multi-espaces** branché sur le tarif négocié déjà existant, puis le **crédit fin de séjour** et l’encaissement **banque** avec ventilation — sans casser folios / caisse / caution salle actuels.
