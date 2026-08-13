# Plan — Réservation groupée (1 booker → N chambres / occupants sur place)

| | |
|---|---|
| **Status** | `planned` |
| **Périmètre** | Branche `HOTEL` (`hasStays`) — chambres (`ROOM`) ; salles (`MEETING`) option V1.1 dans le même dossier |
| **Contexte** | Une **personne** (particulier **ou** contact d’un **client partenaire**) réserve **plusieurs chambres** (même type ou types différents) pour un **groupe**. Les **occupants ne sont pas connus à la réservation** : ils seront **identifiés plus tard sur place**, **chambre par chambre**, au moment de leur arrivée / check-in selon la réservation du dossier. |
| **Lié** | [`plan-clients-partenaires-hotel.md`](./plan-clients-partenaires-hotel.md) (CRM société + `PartnerBooking`), [`plan-prix-negociable-sejour.md`](./plan-prix-negociable-sejour.md), [`plan-sejour-note-chambre.md`](./plan-sejour-note-chambre.md), [`plan-roles-dashboards-hospitalite.md`](./plan-roles-dashboards-hospitalite.md) |

---

## 1. Besoin métier (reformulé & amélioré)

### Principe clé — occupants « plus tard, sur place »

```text
T0  Réservation groupée
    Booker + dates + N chambres allouées
    Occupants = EN ATTENTE (pas de pièce, pas d’adresse obligatoire)

T1  Arrivée (jour J, éventuellement échelonnée)
    Pour CHAQUE chambre du dossier :
      → ouvrir la réservation / stay de cette chambre
      → saisir l’occupant réel (nom, adresse, pièce + scan)
      → puis check-in de CETTE chambre

T2  Fin de séjour
    Check-out chambre par chambre (ou lot) comme aujourd’hui
```

| Qui | Quand | Quoi |
|-----|-------|------|
| **Booker** | À la réservation | Nom + contact ; paie / engage le dossier |
| **Chambre réservée** | À la réservation | Allouée (n°, type, dates) — **sans** savoir qui dormira |
| **Occupant** | **Sur place, plus tard** | Identifié **selon sa chambre / son stay** du dossier groupe |

Ce n’est **pas** « un seul formulaire d’identité pour tout le groupe » : chaque personne est rattachée à **sa** réservation de chambre quand elle se présente.

### Cas terrain

| Scénario | Exemple |
|----------|---------|
| **Groupe particulier** | Un organisateur réserve 5 chambres ; le jour J chaque invité se présente → réception ouvre la chambre du dossier → identifie → check-in |
| **Groupe partenaire / société** | RH réserve 8 chambres ; les employés arrivent à des heures différentes → identité + pièce **par chambre** à l’arrivée |
| **Mix types** | Même dossier : 2× Standard + 1× Suite ; occupants distincts, chacun sur « sa » ligne stay |
| **Quantité demandée** | « 4 chambres Standard du 12 au 15 » → allocation des chambres libres ; occupants TBD |

### Ce que « réservation groupée » n’est pas

- Ce n’est **pas** un seul `HotelStay` avec N chambres (calendrier, statut chambre, note F&B = **1 stay = 1 espace**).
- Ce n’est **pas** N réservations indépendantes sans lien (perte de vue d’ensemble, paiement global, check-in groupe).
- Ce n’est **pas** obligatoirement un partenaire société : le **booker** peut être un particulier.

### Amélioration de compréhension (vs plans existants)

Le plan partenaires introduit déjà `PartnerBooking` 1→N stays, mais :

1. Aujourd’hui l’UI crée **1 stay = 1 nouveau dossier** (multi-chambres non branché).
2. L’identité occupant est **exigée à la création** — incompatible avec « identifier sur place ».
3. Il manque un **booker particulier** (sans fiche société) pour le même pattern multi-chambres.

**Décision produit :** la **réservation groupée** est le **cas générique**. Le dossier partenaire en est une **variante** (`partnerId` renseigné). Un seul modèle de dossier pour les deux.

---

## 2. Décisions retenues

| Idée brute | Décision | Pourquoi |
|------------|----------|----------|
| « Réserver par groupe N chambres » | **Dossier groupe** (`StayGroup` / réutiliser & généraliser `PartnerBooking`) + **N `HotelStay`** | Planning inchangé : 1 stay = 1 chambre |
| Types mixtes | Lignes d’allocation : `{ roomTypeId, quantity }` **ou** liste de `roomId` | Terrain : parfois « 3 Standard », parfois « ch. 12 + 15 + Suite 2 » |
| Occupants sur place **plus tard** | **Défaut groupe** = `guestPending = true` sur chaque stay ; identité **obligatoire au check-in de ce stay**, pas à la création du dossier | Booker ≠ occupants ; arrivées échelonnées |
| Qui s’identifie où | L’occupant est saisi **sur le stay / la chambre** de sa réservation dans le dossier (pas un pool anonyme) | Traçabilité police / note chambre |
| Booker | Champs dossier : `bookerName`, `bookerPhone`, `bookerEmail?` ; **ou** `partnerId` si société | Particulier vs partenaire sans deux flux |
| Paiement | Comme plan partenaire : timing `PREPAID` \| `AT_CHECKOUT` ; 1 folio / stay ; paiement global ventillé sur le dossier | Réutilise caisse existante |
| Disponibilité | Vérifier **N chambres libres** sur la période **avant** confirmation ; allocation atomique | Évite surbooking |
| Même dates pour toutes les chambres | **V1 : dates dossier = dates communes** à toutes les lignes | Simplifie UX ; dates décalées = V1.1 (lignes avec dates propres) |
| Annulation partielle | Annuler 1 stay du dossier sans fermer le dossier | Groupe peut perdre 1 chambre |
| Check-in | Par chambre **ou** « check-in lot » (sélection multi) | Arrivée échelonnée vs bus |

### Règles métier V1 (non négociables)

1. **Booker nommé** — toute réservation groupée a un responsable (`bookerName` + téléphone **ou** partenaire société actif).
2. **≥ 2 chambres** pour le libellé « groupe » en UI (1 chambre = flux séjour simple actuel). Techniquement le dossier peut aussi porter 1 stay (compat partenaire).
3. **1 stay = 1 chambre allouée** avant confirmation (pas de « quantité flottante » sans `roomId` en V1 — l’allocation type→chambre se fait dans le wizard).
4. **Occupants différés (défaut)** — à la création du dossier groupe, chaque stay est `guestPending = true` : **pas** de pièce / adresse obligatoire. Placeholder autorisé (`guestName` = « À identifier · ch. 102 »).
5. **Identification sur place** — avant check-in d’**une** chambre : compléter l’occupant **de ce stay** (nom réel, adresse, type + n° + scan pièce) → `guestPending = false`. Les autres chambres du groupe peuvent rester en attente.
6. **Check-in** — bloqué tant que ce stay est encore `guestPending` (identité incomplète), **sauf** override manager documenté (Phase F). Check-in lot = uniquement les lignes déjà identifiées.
6. **Disponibilité** — refus si une chambre demandée chevauche un stay actif.
7. **Propriétaire / réception** — seuls les rôles ops autorisés (réceptionniste, caissier, gérant, owner) créent / gèrent les dossiers groupe.
8. **Partenaire** — si `partnerId` : facturation société + timing crédit selon plan partenaires ; sinon booker particulier = paiement classique.
9. **Option « saisir maintenant »** — le wizard peut cocher des occupants connus à l’avance ; sinon le défaut reste **sur place plus tard**.

---

## 3. Terminologie UI

| Terme | Sens |
|-------|------|
| **Réservation groupée** | Dossier multi-chambres sous un booker |
| **Booker / Organisateur** | Personne qui réserve (particulier ou contact société) |
| **Ligne d’allocation** | Demande « 2× Standard » ou chambre précise |
| **Chambre du groupe** | Un `HotelStay` du dossier |
| **Occupant en attente** | Stay `guestPending` — identité à compléter sur place |
| **Check-in lot** | Valider plusieurs chambres du groupe d’un coup (après identité) |
| **Dossier partenaire** | Même objet avec `partnerId` renseigné |

**Libellés proposés :**

```text
[ Nouvelle réservation groupée ]
Organisateur : ________________  Tél : ________
○ Particulier   ○ Client partenaire : [ Société ▼ ]

Séjour : [12/08] → [15/08]
Chambres :
  [ + Type ] Standard × 3   → alloue 101, 102, 105
  [ + Type ] Suite × 1      → alloue 201
  [ + Chambre précise ]

Occupants : ○ À identifier sur place (défaut)
            ○ Saisir maintenant (option)

Paiement : ○ Avant séjour  ○ À la fin
[ Créer le dossier GRP-00042 ]
```

---

## 4. État actuel (constat)

| Élément | État |
|---------|------|
| `HotelStay` 1 chambre + 1 folio | ✅ |
| `BranchPartner` + `PartnerBooking` | ✅ schéma |
| Création multi-stays dans **un** dossier | ❌ UI / action (chaque create → nouveau dossier) |
| Booker particulier sans partenaire | ❌ |
| `guestPending` / identité différée | ❌ (pièce exigée à create) |
| Allocation par type × quantité | ❌ |
| Check-in lot | ❌ |
| Ventilation paiement dossier | Partiel / planifié partenaires |

---

## 5. Modèle cible

### 5.1 Généraliser le dossier (recommandation)

**Option retenue :** étendre `PartnerBooking` → concept **StayGroup** (renommage progressif ou alias) :

```text
StayGroup / PartnerBooking
  branchId
  code                    // GRP-xxxxx ou PRT-xxxxx
  partnerId?              // null = particulier
  bookerName              // obligatoire si pas de partner contact
  bookerPhone?
  bookerEmail?
  checkInDate / checkOutDate   // dates communes V1
  payTiming               // PREPAID | AT_CHECKOUT
  status                  // DRAFT | CONFIRMED | PARTIAL | CLOSED | CANCELLED
  notes?
  stays[]                 // HotelStay
  payments[]              // optionnel via partnerBookingId
```

Champs stay :

```text
HotelStay
  + guestPending Boolean @default(false)
  // si guestPending : idDocument* / adresse non requis à create
  // check-in : forcer guestPending=false + identité complète
```

### 5.2 Wizard d’allocation

```text
1. Booker + dates + partenaire?
2. Lignes : { roomTypeId, qty } et/ou { roomId }
3. Preview disponibilité → liste roomId proposés (modifiable)
4. Création atomique : dossier + N stays (RESERVED) + N folios (nuitées)
5. Occupants = pending par défaut
```

Algorithme type × qty :

1. Lister chambres du type `AVAILABLE` / non chevauchantes sur `[in, out)`.
2. Prendre les `qty` premières (ou laisser le user cocher).
3. Si stock insuffisant → erreur claire (« 2 Standard libres, 3 demandées »).

### 5.3 Cycle de vie

```text
DRAFT (option) → CONFIRMED (stays RESERVED)
  → PARTIAL (au moins 1 CHECKED_IN, d’autres RESERVED)
  → CLOSED (tous CHECKED_OUT / CANCELLED / NO_SHOW)
  → CANCELLED (annulation globale)
```

### 5.4 Paiement

Identique au plan partenaires : paiement sur dossier → ventilation prorata soldes folios. Booker particulier : `PREPAID` recommandé par défaut ; `AT_CHECKOUT` autorisé avec acompte optionnel.

### 5.5 Facture globale de fin de séjour (groupe & partenaire)

À la **clôture du dossier** (tous les stays concernés check-out / annulés, ou sur demande « Facture dossier »), le système **produit un document unique** — valable pour :

| Destinataire | Quand |
|--------------|--------|
| **Société partenaire** | `partnerId` renseigné → facture **à envoyer / remettre à la société** |
| **Booker particulier (groupe)** | Pas de partenaire → facture **au nom de l’organisateur** du groupe |

Même gabarit HTML/print (pattern iframe déjà utilisé notes / service stock) ; seuls l’en-tête « Facturé à » et les coordonnées changent.

#### Contenu obligatoire du document

```text
HÔTEL {branchName}                          Facture dossier {GRP-|PRT-xxxxx}
Date d’émission · Période séjour {in} → {out}

─── Facturé à ───
Partenaire : raison sociale, adresse, ville, tél, email, taxId (si société)
  ou
Booker : nom organisateur, tél, email (si particulier)

─── Détail ───
| # | Chambre / type | Occupant | Désignation        | P.U. | Qté | Montant |
|---|----------------|----------|--------------------|------|-----|---------|
| 1 | 101 Standard   | J. Dupont| Nuitée 12–15 août  | 45 $ |  3  | 135 $   |
| 2 | 101            |          | Mini-bar / F&B     |  …  |  …  |  …      |
| 3 | 102 Twin       | À id. / Nom | Nuitées …       |  …  |  …  |  …      |
…

Sous-total hébergement     …
Sous-total consommations   …
Acomptes / paiements déjà reçus  (−)
────────────────────────────────────
TOTAL À PAYER              …
Dont réglé                 …
Solde                      …

Méthode / timing : PREPAID | AT_CHECKOUT · Cash / Banque / …

─── Signatures ───
Gérant / Manager (hôtel)          Cachet / réception société (si partenaire)
Nom · signature · date            Accusé réception facture (option)
```

Règles détail :

1. **Lignes** = agrégat de tous les folios des stays du dossier (nuitées / forfait, F&B, extras, caution salle si applicable).
2. **P.U. / Qté / Montant** sur chaque ligne (qté = nuitées, articles, heures, etc. selon `FolioLineKind`).
3. **Totaux** : sous-totaux + total dû + déjà payé (paiements `partnerBookingId` / folios) + **solde à payer**.
4. **Identité société** (partenaire) : `name`, `address`, `city`, `phone`, `email`, `taxId` — obligatoires sur le PDF si `partnerId`.
5. **Signature gérant / manager** : zone signature + nom du staff qui émet (`closedBy` / utilisateur courant) ; rôle affiché « Gérant » ou « Manager ».
6. **Remise à la société** : actions UI  
   - **Imprimer** (papier / PDF navigateur)  
   - **Télécharger / réimprimer** depuis la fiche dossier  
   - **Envoyer** (V1 : mailto avec sujet + rappel « joindre le PDF imprimé » **ou** email HTML si SMTP déjà configuré — Phase G8b)  
7. **Pas d’image CNI** sur la facture globale (occupants : nom seulement).

#### Quand générer

| Déclencheur | Comportement |
|-------------|--------------|
| Dernier check-out du dossier + solde traité | Proposition auto « Émettre la facture dossier » |
| Bouton fiche dossier | « Facture globale » à tout moment en lecture (brouillon si stays ouverts = filigrane PROFORMA) |
| Statut `CLOSED` | Facture **définitive** ; mémoriser `invoiceIssuedAt` + `invoiceIssuedByUserId` |

#### Stockage (V1)

- Génération **à la demande** (HTML) — pas d’obligation de fichier stocké.
- Option : enregistrer `invoiceNumber` (FAC-GRP-xxxxx) + horodatage émission pour audit / réimpression identique.

---

## 6. UX (réception)

### Hub Séjours

- Bouton **Réservation groupée** à côté de Réserver (une chambre).
- Liste / filtre **Dossiers groupe** (code, booker, dates, nb chambres, statut).
- Fiche dossier : tableau des chambres + statut occupant + actions check-in / compléter identité.

### Compléter occupant (sur place — selon la réservation / chambre)

```text
Dossier GRP-00042 · Arrivée
  Ch. 101  [À identifier]  → Compléter identité → Check-in
  Ch. 102  [À identifier]  → …
  Ch. 201  [Jean Dupont ✓] → Check-in

Chambre 101 · liée à cette réservation du groupe
Nom · Adresse · Pièce (scan)
[ Enregistrer l’occupant ] → [ Check-in cette chambre ]
```

L’identité n’est **jamais** « flottante » : elle est toujours attachée au **stay / chambre** déjà réservé dans le dossier.

### Check-in lot

Sélection multi-lignes (identité OK uniquement) → check-in batch.

### Facture globale (fin de séjour)

Sur la **fiche dossier** (groupe ou partenaire) :

```text
[ Facture globale ]
  · Aperçu (P.U. · Qté · Montants · Totaux · Solde)
  · Imprimer / PDF
  · Marquer « remise à la société » (partenaire) ou « remise au booker »
  · (Option) Envoyer par email à partner.email / bookerEmail
Signature : Gérant / Manager ____________________
```

Après clôture de tous les stays : bannière « Dossier clos — émettre la facture ».

---

## 7. Phases d’exécution

| Phase | Contenu | Critère de done |
|-------|---------|-----------------|
| **G0** | Alignement schéma : `bookerName` / phone sur dossier ; `guestPending` sur stay ; code `GRP-` si sans partenaire | Migration Prisma OK |
| **G1** | Action `createStayGroupAction` : dates + lignes type/qty ou roomIds + booker (+ partner optionnel) + N stays atomiques | 3 chambres créées sous 1 code |
| **G2** | Wizard UI « Réservation groupée » (séjours) | Receptionniste crée un groupe sans pièce |
| **G3** | Fiche dossier + compléter occupant + check-in unitaire | Identité sur place puis check-in |
| **G4** | Check-in lot + annulation partielle stay | Bus / arrivée groupe |
| **G5** | Paiement dossier + ventilation (réutiliser helpers partenaires) | Acompte global visible sur folios |
| **G6** | Brancher createStay simple : option « ajouter à dossier ouvert » | Extension groupe existant |
| **G7** | Polish : badges calendrier « groupe », rapport séjours filtre dossier, permissions ops | Build + smoke |
| **G8** | **Facture globale** fin de séjour : HTML print + détail P.U./qté/montants/totaux + identité société ou booker + zone signature gérant/manager + actions Imprimer / Remise société | Document émis pour partenaire **et** groupe particulier |
| **G8b** | (Option) Envoi email facture à `partner.email` / `bookerEmail` | Mail ou mailto |

### Dépendances

- **G5** s’appuie sur phase paiement multi-folios du plan partenaires.
- **Identité différée** : assouplir `createStayAction` / validations **uniquement** si `guestPending` ou `stayGroupId` (ne pas casser walk-in 1 chambre actuel).
- Mettre à jour [`plan-clients-partenaires-hotel.md`](./plan-clients-partenaires-hotel.md) § multi-espaces : pointer vers ce plan pour le wizard groupe.

---

## 8. Fichiers cibles (indicatif)

| Fichier | Rôle |
|---------|------|
| `prisma/schema.prisma` | `guestPending`, booker fields, éventuellement rename/alias StayGroup |
| `lib/hotel/stay-group.ts` | create / allocate / attach / cancel partial |
| `lib/hotel/actions.ts` | check-in garde identité si pending |
| `…/hotel/sejours/*` | Wizard groupe + fiche dossier |
| `…/hotel/partenaires/*` | Réutiliser fiche dossier si `partnerId` |
| `lib/hotel/partner-booking.ts` | Fusionner ou déléguer vers stay-group |
| `lib/hotel/stay-group-invoice.ts` | Agrégat folios → lignes P.U./qté/montant + totaux |
| `lib/hotel/stay-group-invoice-print.ts` | HTML facture globale (partenaire / booker) + signatures |
| Fiche dossier UI | Boutons Facture / Imprimer / Remise société / Envoyer |

---

## 9. Risques & mitigations

| Risque | Mitigation |
|--------|------------|
| Surbooking à l’allocation | Transaction + re-check overlap |
| Occupant jamais saisi | Alerte dossier ; check-in bloqué ; report « pending » |
| Conflit avec règle « pièce à la réservation » (plan partenaires) | **Exception documentée** : groupes / `guestPending` → pièce au check-in ; walk-in 1 chambre inchangé |
| Deux modèles PartnerBooking vs StayGroup | **Un seul** modèle étendu ; pas de duplication |
| Facture globale sans totaux cohérents | Source unique = folios + paiements dossier ; proforma vs définitive |
| Envoi email échoue | Imprimable toujours ; email = bonus G8b |

---

## 10. Checklist d’acceptation

- [ ] Organisateur réserve 4 chambres **sans** saisir les 4 pièces / adresses
- [ ] Sur place : pour la ch. 101 du dossier, saisir l’occupant puis check-in ; ch. 102 encore « à identifier »
- [ ] Société partenaire : même flux (occupants plus tard, chambre par chambre)
- [ ] Check-in lot : seulement les chambres déjà identifiées
- [ ] Annuler 1 chambre du groupe : les autres restent
- [ ] Acompte global ventilé sur les notes
- [ ] Calendrier / liste : badge dossier `GRP-…` + indicateur « occupant en attente »
- [ ] Walk-in 1 chambre existant **non régressé** (identité toujours à la création)
- [ ] **Facture globale** partenaire : identité société + détail P.U./qté/montants + total/solde + signature gérant/manager
- [ ] **Facture globale** groupe particulier : facturé au booker, même détail
- [ ] Imprimer / réimprimer depuis fiche dossier ; option « remise à la société »

---

## 11. Journal

| Phase | Status | Notes |
|-------|--------|-------|
| G0 | `done` | booker* + guestPending + invoice* sur PartnerBooking / HotelStay · REV 28 |
| G1 | `done` | `createStayGroupAction` allocation type/qty ou roomIds |
| G2 | `done` | Wizard « Réservation groupée » (séjours) |
| G3 | `done` | Fiche dossier + compléter occupant |
| G4 | `done` | Check-in lot + annulation partielle |
| G5 | `done` | Paiement dossier ventilé prorata folios |
| G6 | `done` | `partnerBookingId` + `guestPending` sur `createStayAction` |
| G7 | `done` | Badges GRP / À identifier en liste |
| G8 | `done` | Facture globale HTML print + remise société/booker |
| G8b | `todo` | Email optionnel |
