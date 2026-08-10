# Plan — Paiement séjour : Comptant vs Note de chambre

| | |
|---|---|
| **Status** | `done` |
| **Périmètre** | Branche hôtellerie avec `hasStays` (séjours / chambres) |
| **Contexte** | Client en chambre : payer maintenant **ou** reporter sur la facture globale de séjour |
| **Lié** | [`plan-hotel-caisse-sejours-restauration.md`](./plan-hotel-caisse-sejours-restauration.md), B09 Payment, B10 Hôtel, B13 modules |

---

## 1. Besoin métier (reformulé)

Un client **en séjour** (chambre occupée) consomme (F&B / extras). Deux façons de régler :

1. **Comptant** — il paie tout de suite (cash / mobile / carte) à la caisse.
2. **Note de chambre** — la consommation est **imputée au folio du séjour** ; le client règle le **solde global** au check-out (nuitées + consommations + extras).

La **facture globale de séjour** (folio) doit lister clairement :
- nuitées
- **consommations** (F&B / produits)
- autres lignes (taxes, retard checkout…)
- paiements déjà reçus (acomptes / règlements partiels)
- **solde restant**

---

## 2. Terminologie recommandée

| Terme UI | Sens | À éviter |
|----------|------|----------|
| **Note de chambre** | Folio séjour = facture globale du client en chambre | « Folio » seul (trop technique pour le staff) |
| **Comptant** | Paiement immédiat de la commande / ticket | « Cash only » (exclut mobile/carte) |
| **Sur note** / **Reporter sur la note** | Imputer la commande au séjour sans encaisser tout de suite | « Crédit » / « Dette » |
| **Facture séjour** | Document / vue de la note (nuits + conso + solde) | « Facture globale » trop vague |
| **Consommations** | Lignes F&B / produits sur la note | « Commandes orphelines » |
| **Acompte / règlement partiel** | Paiement sur la note avant check-out | — |
| **Solde à encaisser** | Reste dû au check-out | — |

**Libellé bouton restauration / caisse (commande liée à un séjour) :**

```text
[ Comptant ]     [ Sur note de chambre ]
```

**Statut commande après report :**

- Pas `PAYEE` tout de suite
- Statut proposé : rester `LIVREE` (ou `EN_CAISSE` si pas encore livrée) + flag / mode `NOTE_CHAMBRE`
- La ligne apparaît sur la note ; le paiement réel = paiement **folio** (maintenant partiel ou au check-out)

---

## 3. État actuel (constat code)

Déjà en place :
- `HotelStay` + `Folio` (1:1) créé au check-in
- `FolioLineKind` : `NIGHT` | `FNB` | `PRODUCT` | `TAX` | `OTHER`
- Check-out bloqué si solde folio > 0 → redirige caisse
- Caisse : onglet **Folios** (encaisser solde) + file **F&B** (payer commande)
- `HotelOrder.stayId` / `folioId` existent dans le schéma

Manques :
- Restauration : champ « Table / Client » libre — **pas de sélection séjour / chambre**
- Envoi commande : **ne poste pas** les lignes sur le folio
- Pas de choix **Comptant vs Sur note**
- Vue **facture séjour** (liste conso + nuits) peu exposée hors lignes brutes caisse
- Paiement commande `orderId` ≠ imputation folio (deux silos)

---

## 4. Règles métier (conditions)

### 4.1 Qui peut être « Sur note » ?

- Uniquement si un **séjour CHECKED_IN** est sélectionné (chambre occupée).
- Folio du séjour **ouvert** (`closed = false`).
- Branche avec `hasStays`.

Sinon : uniquement **Comptant** (comportement salle / vente rapide actuel).

### 4.2 Comptant (commande)

1. Flux actuel : cuisine → prêt → caisse → paiement `orderId` → livré.
2. Option : paiement immédiat à la prise de commande (hors cuisine) inchangé.
3. **Ne pas** dupliquer les montants sur le folio (sauf si on veut une ligne « déjà réglé » pour historique — **non recommandé** en V1).

### 4.3 Sur note de chambre

1. Serveur sélectionne **chambre / séjour** (guestName · ch. XX).
2. Choisit **Sur note de chambre**.
3. Commande créée avec `stayId` + `folioId`.
4. À la **livraison** (ou dès envoi si pas de cuisine) : créer des `FolioLine` `kind = FNB` (une ligne par article ou une ligne agrégée + détail optionnel).
5. Commande passe `LIVREE` **sans** `Payment` immédiat ; hors file « à encaisser F&B ».
6. Montants visibles sur **Note de chambre** + solde folio.
7. Client peut :
   - payer un **acompte** sur la note (caisse → Folios → règlement partiel)
   - ou tout régler au **check-out**

### 4.4 Check-out

1. Afficher **Facture séjour** : nuits + consommations + extras − paiements = solde.
2. Si solde > 0 → obliger encaissement (comme aujourd’hui) puis clôturer folio.
3. Si solde ≤ 0 → check-out OK, fermer folio.

### 4.5 Annulations / retours

- Annuler une commande **Sur note** non livrée : pas de ligne folio.
- Annuler après imputation : ligne folio négative / reverse `FNB` (V1.1) ou interdiction si folio a déjà un paiement lié (V1 : soft-block).

---

## 5. Modèle de données (évolution)

### Option recommandée (peu invasive)

Sur `HotelOrder` :

```prisma
/// COMPTANT | NOTE_CHAMBRE
settlementMode  String  @default("COMPTANT")
/// true quand les lignes ont été postées sur le folio
postedToFolioAt DateTime?
```

- Réutiliser `folioId` + `stayId`
- `FolioLine.kind = FNB` pour consommations
- Pas de nouveau `BranchType`

### Option alternative (plus riche, plus tard)

Enum Prisma `OrderSettlementMode { COMPTANT NOTE_CHAMBRE }` + table `FolioLine` liée à `orderItemId` pour traçabilité fine.

**V1 :** string + `postedToFolioAt` suffit.

---

## 6. UX à livrer

### Restauration
- Sélecteur **Séjour en cours** (liste CHECKED_IN) OU saisie table libre.
- Si séjour choisi → boutons **Comptant** | **Sur note de chambre**.
- Badge sur ticket suivi : `Sur note · Ch. 12`.

### Séjours
- Carte / détail séjour : bouton **Voir la note** (nuits + conso + solde).
- Au check-out : récap facture séjour avant validation.

### Caisse
- Onglet Folios renommé / sous-titré **Notes de chambre**.
- File F&B : exclure (ou filtrer) les commandes `NOTE_CHAMBRE` déjà postées.
- Paiement folio = règlement note (partiel ou total).

### Reçu / PDF note
- Sections : Nuitées | Consommations | Autres | Paiements | Solde.
- Toujours **deux devises** selon taux fixé (comme rapports).

---

## 7. Plan d’exécution

### Phase S0 — Cadrage
- [x] Termes : **Note de chambre** / **Comptant** / **Sur note** / **Consommations**
- [x] Imputation à la **livraison** (et dès création si pas de cuisine)

### Phase S1 — Données
1. [x] `settlementMode` + `postedToFolioAt` sur `HotelOrder`
2. [x] Helpers : `postOrderToFolio`, `listActiveStaysForCharge`, `getStayFolioStatement`

### Phase S2 — Restauration
1. [x] UI sélection séjour CHECKED_IN
2. [x] Choix Comptant / Sur note
3. [x] Wiring `createHotelOrderAction` + post folio à livraison / ready

### Phase S3 — Note & check-out
1. [x] Vue **Facture séjour** (séjours + caisse)
2. [x] Check-out avec récap consommations
3. [x] Libellés caisse « Notes de chambre »

### Phase S4 — Polish
1. [x] Acomptes partiels clairs
2. [x] Impression note (`/hotel/sejours/note/[stayId]`) + reçu sectionné
3. [ ] Smoke test manuel (à faire en UI)

---

## 8. Critères d’acceptation

1. Commande **Comptant** liée chambre : payée en caisse, **absente** du solde folio (ou non doublée).
2. Commande **Sur note** : apparaît en **Consommations** sur la note ; solde folio augmente ; pas dans la file F&B à encaisser.
3. Check-out avec conso non payée → solde > 0 → encaissement obligatoire.
4. Après paiement solde → check-out OK, note fermée.
5. Client salle sans séjour → uniquement Comptant.
6. Branche sans `hasStays` → inchangé (resto seul).

---

## 9. Smoke test manuel

```text
1. Check-in chambre 101
2. Restauration → séjour 101 → Sur note → plat + boisson → livrer
3. Voir note : Consommations listées, solde = total F&B (+ nuits)
4. Autre commande Comptant pour même chambre → encaisser en caisse → pas de double sur note
5. Check-out → solde dû → payer note → check-out OK
```

---

## 10. Hors scope V1

- Multi-folios par séjour
- Split bill par occupant
- Tip / service charge auto
- Note post check-out (room late charge)

---

**Prochaine action après validation :** Phase S1 (schéma + helpers) puis S2 (restauration).
