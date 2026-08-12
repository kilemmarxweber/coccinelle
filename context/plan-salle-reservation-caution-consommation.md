# Plan — Réservation salle (réunion / fête) : paiement + caution consommation

| | |
|---|---|
| **Status** | `in_progress` (Phases A–D livrées · E partielle hors scope immédiat) |
| **Périmètre** | Espaces `HotelSpaceKind.MEETING` (salles de réunion / fête) + note séjour / folio + caisse |
| **Contexte** | À la réservation d’une salle, le client paie la location (totalité ou partie) **et** peut laisser une **caution** manuelle pour ses consommations. Les articles commandés sont décomptés sur cette caution ; s’il consomme moins, on **rembourse** le reliquat. |
| **Lié** | [`plan-prix-negociable-sejour.md`](./plan-prix-negociable-sejour.md) (mode `FLAT` / passage), [`plan-sejour-note-chambre.md`](./plan-sejour-note-chambre.md), [`plan-hotel-caisse-sejours-restauration.md`](./plan-hotel-caisse-sejours-restauration.md), remboursement départ anticipé (séjours) |

---

## 1. Besoin métier (reformulé)

Cas typique **salle de réunion ou de fête** :

1. Le client **réserve** une salle (créneau / passage `FLAT`).
2. La réservation **oblige un encaissement** de la location : **totalité** ou **partie** (acompte) — pas de réservation « gratuite » sans paiement enregistré.
3. En plus, le staff saisit **manuellement** un montant de **caution consommation** (pas de barème fixe obligatoire en V1).
4. Pendant l’événement, le client (ou le staff) **commande** boissons / plats / produits : ces lignes sont **liées à la note de la salle** et **décomptées sur la caution**.
5. En fin d’événement (check-out / clôture) :
   - si **consommation ≤ caution** → **rembourser** `caution − conso` (et régler tout solde location restant) ;
   - si **consommation > caution** → encaisser le **dépassement** (+ solde location éventuel).

La caution n’est **pas** un chiffre d’affaires de vente : c’est une **garantie** déposée, puis consommée / restituée.

---

## 2. Terminologie UI

| Terme | Sens |
|-------|------|
| **Location salle** | Montant `STAY_FLAT` (passage / créneau) — dû pour la réservation |
| **Acompte location** | Paiement partiel sur la location |
| **Solde location** | Reste dû sur la location après acomptes |
| **Caution consommation** | Dépôt saisi manuellement, destiné à couvrir F&B / produits |
| **Consommation** | Lignes `FNB` / `PRODUCT` (et assimilés) imputées à la note de la salle |
| **Reliquat caution** | `caution − conso` si > 0 → **à rembourser** |
| **Dépassement caution** | `conso − caution` si > 0 → **à encaisser** |
| **Note salle** | Folio du séjour `MEETING` (location + conso + paiements + caution) |

**Libellés proposés :**

```text
[ Location ]     [ Caution consommation ]
[ Encaisser acompte / total ]     [ Saisir caution ]
```

Clôture :

```text
Consommé 120 $ · Caution 200 $ → À rembourser 80 $
```

ou

```text
Consommé 250 $ · Caution 200 $ → À encaisser 50 $
```

---

## 3. État actuel (constat code)

Déjà en place :

- Espaces `MEETING` + tarification `FLAT` (passage), check-in direct possible
- Folio séjour + lignes `STAY_FLAT` / `STAY_OVERTIME` / `FNB` / `PRODUCT`
- Commandes **Sur note** imputées au folio (`plan-sejour-note-chambre`)
- Caisse : encaissement folio, **remboursement** si solde négatif (départ anticipé chambres)
- Paiements folio = montants positifs (règlement) ou négatifs (remboursement)

Manques pour ce cas :

- Pas de distinction **paiement location** vs **caution**
- Pas de champ / ligne dédiée **caution** (montant manuel)
- Réservation salle possible sans forcer un paiement immédiat
- Pas de boucle métier « conso vs caution → rembourser / encaisser le delta »
- UI réservation salle : pas de panier conso + caution au même moment

---

## 4. Décisions d’architecture (recommandées)

### 4.1 Une note (folio) par réservation salle

Conserver **1 folio / 1 stay** `MEETING`.  
Tout (location, caution, conso, acomptes, remboursements) vit sur ce folio — reporting unifié.

### 4.2 Séparer **location** et **caution** (comptablement)

| Nature | Représentation proposée | Effet sur solde « à encaisser » |
|--------|-------------------------|--------------------------------|
| Location due | Ligne `STAY_FLAT` (déjà) | Charge (+) |
| Paiement location | `Payment` `note: "Acompte/Règlement location salle"` | Paid (+) |
| Caution déposée | **Ligne dédiée** `FolioLineKind.DEPOSIT` (montant **négatif** = crédit client) **ou** paiement typé `DEPOSIT` | Crédit client |
| Consommations | Lignes `FNB` / `PRODUCT` | Charge (+) |
| Remboursement reliquat | `Payment` négatif `isRefund` + note `"Remboursement caution"` | Ajuste paid |

**Recommandation V1 (simple, alignée caisse actuelle) :**

1. **`FolioLineKind.DEPOSIT`** — ligne de crédit (amount **négatif**, ex. `−200`) description `Caution consommation · saisie manuelle`.
2. Les **conso** restent des charges positives.
3. Solde folio = `charges(location+conso+…) + dépôt(négatif) − paiements_nets`.
4. À la clôture, le moteur calcule explicitement :
   - `cautionAmount` = `|Σ DEPOSIT|`
   - `consumptionAmount` = `Σ FNB + PRODUCT` (+ éventuellement autres kinds « conso »)
   - `depositBalance = cautionAmount − consumptionAmount`
5. Si `depositBalance > 0` → file **remboursement caution**.  
   Si `depositBalance < 0` → file **encaisser dépassement**.  
   Puis traiter le **solde location** restant comme aujourd’hui.

**Alternative** (si on refuse les lignes négatives) : table `StayDeposit` + paiements `kind` — plus propre mais plus de schéma. **V1 = `DEPOSIT` sur folio.**

### 4.3 Réservation salle = paiement obligatoire (location)

Règle métier (garde serveur + UI) :

- Création / confirmation réservation `MEETING` **bloquée** tant qu’aucun paiement location **> 0** n’est enregistré **dans la même transaction métier** (wizard réservation → encaisser).
- Montant location : **totalité** (`flatAmount`) **ou partie** (acompte `0 < payé ≤ dû`), saisi / validé en caisse ou dans le flux réservation.
- Option config branche plus tard : `% minimum d’acompte` (ex. 50 %) — **hors V1** sauf demande.

La **caution** est **indépendante** :

- Montant **saisi manuellement** (USD ou CDF selon taux branche).
- **Recommandée** si le client prévoit de consommer, **pas forcément obligatoire** en V1 (flag UI « Avec caution »).  
  Si besoin métier « caution toujours obligatoire pour salles » → toggle branche `meetingDepositRequired` (Phase D).

### 4.4 Commandes liées à la caution

- Mode **Sur note** (déjà) pour toute conso pendant la réservation.
- Afficher en permanence : `Caution · Consommé · Reliquat`.
- Alerte soft si `consommé > caution` (dépassement) — ne bloque pas la commande en V1 ; le solde sera encaissé à la clôture.
- Option V1.1 : bloquer commande si dépassement sans validation manager.

### 4.5 Clôture / check-out salle

Ordre :

1. Recalcul overtime passage si applicable (`STAY_OVERTIME`).
2. Snapshot caution vs conso.
3. Si reliquat caution → **rembourser** (caisse, même flux `isRefund` que trop-perçu chambres).
4. Si dépassement + solde location → **encaisser**.
5. Clôturer folio + libérer salle (`AVAILABLE`).

Ne pas mélanger « remboursement nuitées anticipées chambre » et « remboursement caution salle » dans les libellés (notes de paiement distinctes).

---

## 5. Modèle de données (proposition)

### 5.1 Prisma

```text
enum FolioLineKind {
  ...
  DEPOSIT   // Caution / dépôt (amount négatif = crédit)
}

// Optionnel sur HotelStay (audit / UI rapide)
depositAmountExpected   Float?   // montant caution saisi à la réservation
depositCollectedAt      DateTime?
```

Ou sans champs stay : tout dérivé des lignes `DEPOSIT` + paiements (moins de sync).

**Reco V1 :** `FolioLineKind.DEPOSIT` + éventuellement `HotelStay.depositAmountExpected` pour le wizard.

### 5.2 Paiements

Réutiliser `Payment` :

| Cas | `amountForeign` / `amountCdf` | `note` | `isRefund` |
|-----|-------------------------------|--------|------------|
| Acompte / solde location | > 0 | `Acompte location salle` / `Règlement location salle` | non |
| Encaissement dépassement | > 0 | `Dépassement caution` | non |
| Restitution caution | < 0 | `Remboursement caution consommation` | oui |

Pas d’enum PaymentKind obligatoire en V1 si les `note` sont normalisées + helper `isDepositRefund(note)`.

### 5.3 Helpers (`lib/hotel/meeting-deposit.ts`)

```text
sumDeposit(folio) → caution
sumConsumption(folio) → FNB+PRODUCT(+…)
depositRemainder(folio) → caution − conso
locationDue / locationPaid / locationBalance
meetingCheckoutSettlement(folio) → { refundDeposit, collectOverrun, collectLocation }
```

---

## 6. UX — flux réservation

### 6.1 Wizard « Nouvelle réservation salle »

1. Espace + client + période / durée (`FLAT`).
2. **Montant location** (catalogue / négocié) — déjà.
3. **Paiement location** (obligatoire) : total ou acompte + méthode.
4. Toggle **Caution consommation** :
   - montant **manuel** ;
   - encaissement caution (même ticket ou reçu séparé — reco : **même session caisse**, 2 lignes paiement ou 1 paiement location + 1 ligne `DEPOSIT` financée par un paiement « Caution »).
5. (Option) **Pré-commande** articles (panier) → lignes `FNB`/`PRODUCT` sur note + stock selon règles resto.

### 6.2 Pendant l’événement

- Écran séjour / restauration : badge `Caution 200 · Conso 80 · Reliquat 120`.
- Commandes Sur note uniquement pour ce stay.

### 6.3 Clôture

- Dialog check-out salle avec détail location / caution / conso / à rembourser ou à encaisser.
- Boutons caisse alignés sur le flux remboursement déjà livré.

---

## 7. Phases d’exécution

### Phase A — Fondations données & solde

| # | Tâche | Critère done |
|---|--------|--------------|
| A1 | Ajouter `FolioLineKind.DEPOSIT` (+ migration) | ✅ |
| A2 | Helpers `meeting-deposit.ts` (caution, conso, reliquat, solde location) | ✅ tests |
| A3 | Afficher section **Caution** sur note / facture séjour | ✅ |
| A4 | Ne pas compter `DEPOSIT` comme « vente » dans CA jour | ✅ |

**Critère phase A :** ✅

---

### Phase B — Paiement obligatoire à la réservation (location)

| # | Tâche | Critère done |
|---|--------|--------------|
| B1 | Wizard / dialog réservation `MEETING` : étape **Encaisser location** | ✅ |
| B2 | `createStayAction` : stay + folio + `STAY_FLAT` + `Payment` | ✅ |
| B3 | Garde serveur : stay `MEETING` sans paiement location → erreur | ✅ |
| B4 | Reçu / libellé « Acompte location salle » vs « Règlement location salle » | ✅ |

**Critère phase B :** ✅

---

### Phase C — Caution manuelle + décompte conso

| # | Tâche | Critère done |
|---|--------|--------------|
| C1 | UI saisie **montant caution** (manuel) à la réservation | ✅ |
| C2 | Créer ligne `DEPOSIT` + paiement associé | ✅ |
| C3 | Badge Caution / Conso / Reliquat (liste + note) | ✅ |
| C4 | Soft-warning si conso > caution | ✅ badge rose dépassement |

**Critère phase C :** ✅

---

### Phase D — Clôture : remboursement ou dépassement

| # | Tâche | Critère done |
|---|--------|--------------|
| D1 | Settlement caution au check-out / note | ✅ |
| D2 | Reliquat > 0 → file caisse **Rembourser caution** | ✅ |
| D3 | Dépassement > 0 → encaisser | ✅ solde folio |
| D4 | Après settlement → check-out + salle libre | ✅ (flux caisse existant) |
| D5 | Libellés distincts remboursement caution | ✅ |

**Critère phase D :** ✅

---

### Phase E — Pré-commande à la réservation (optionnel mais demandé)

| # | Tâche | Critère done |
|---|--------|--------------|
| E1–E4 | Panier articles wizard | ⏳ à faire (commandes Sur note resto pendant l’événement déjà OK) |

---

### Phase F — Gouvernance & polish (plus tard)

- Flag branche `meetingDepositRequired`
- % acompte location minimum
- Permission « forcer dépassement caution »
- Rapport « cautions ouvertes / restituées / consommées »
- Multi-cautions (réassort caution en cours d’événement)

---

## 8. Ordre d’implémentation suggéré

1. **Phase A** — `DEPOSIT` + helpers + affichage note.  
2. **Phase B** — paiement location obligatoire (cœur réservation salle).  
3. **Phase C** — caution manuelle + badge conso.  
4. **Phase D** — clôture remboursement / dépassement.  
5. **Phase E** — panier pré-commande à la réservation.  
6. **Phase F** — règles branche / rapports.

---

## 9. Hors scope (volontaire V1)

- Caution pour **chambres** classiques (nuitées) — autre produit.
- Caution **matériel / casse** séparée de la caution conso (peut réutiliser `DEPOSIT` plus tard avec sous-type).
- Facturation minute-à-minute hors `FLAT` + overtime déjà prévu.
- Caution bloquée sur compte bancaire (escrow) — ici caisse cash/mobile/carte uniquement.

---

## 10. Risques & points d’attention

| Risque | Mitigation |
|--------|------------|
| Caution comptée dans le CA | Exclure `DEPOSIT` et remboursements caution des totaux « ventes » |
| Confusion acompte location / caution | Libellés + sections note séparées |
| Solde négatif mal interprété (comme trop-perçu chambre) | Settlement explicite `depositRemainder` avant check-out |
| Ligne `DEPOSIT` positive par erreur | Valider `amount < 0` à la création |
| Commande Comptant pendant événement | Autoriser mais **hors** caution (ne décrémente pas le reliquat) — documenter |
| Double remboursement | Clôturer folio + `checkoutQueuedAt` comme flux actuel |

---

## 11. Questions à trancher avant / pendant le code

1. **Caution obligatoire** pour toute salle, ou optionnelle avec toggle ? *(Reco V1 : optionnelle + Phase F pour l’obliger.)*  
2. Pré-commande (Phase E) : lignes folio directes ou vraie `HotelOrder` cuisine ? *(Reco : `HotelOrder` Sur note si items cuisine ; sinon folio direct pour produits simples.)*  
3. Un seul reçu (location + caution) ou deux reçus ? *(Reco : deux mouvements / deux notes sur paiements, un parcours wizard.)*  
4. Devise de saisie caution : toujours USD note, ou CDF saisi puis converti ? *(Reco : aligné caisse actuelle — montant USD note + CDF via taux.)*

---

## 12. Critères d’acceptation globaux (demo)

1. Réserver salle **sans** paiement location → **refusé**.  
2. Acompte 50 % location + caution 200 saisie manuellement → note OK.  
3. Commander 80 de conso Sur note → reliquat caution 120.  
4. Clôture → file **rembourser 120** ; après remboursement → salle libre, folio fermé.  
5. Variante conso 250 / caution 200 → encaisser 50 (+ solde location si besoin) puis clôture.  
6. CA jour : location et conso dans les ventes ; **pas** la caution ni son remboursement comme CA.
