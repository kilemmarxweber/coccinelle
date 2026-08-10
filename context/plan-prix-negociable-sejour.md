# Plan — Prix chambre négociable & séjour hors nuitée

| | |
|---|---|
| **Status** | `draft` |
| **Périmètre** | Branche `hasStays` — création / prolongation / check-out séjour |
| **Contexte** | Aujourd’hui le montant nuitée = `roomType.priceNight × nuits` (catalogue fixe). Besoin : réduction négociée **et** séjour au temps (pas seulement nuitée calendaire). |
| **Lié** | [`plan-sejour-note-chambre.md`](./plan-sejour-note-chambre.md), [`plan-hotel-caisse-sejours-restauration.md`](./plan-hotel-caisse-sejours-restauration.md), `lib/hotel/stay-nights.ts`, `reconcileStayNightCharges` |

---

## 1. Besoin métier (reformulé)

Deux situations distinctes, souvent combinées :

1. **Négociation sur tarif nuitée** — le client demande une réduction (ou un forfait) ; le staff applique un **prix unitaire négocié** (ou un total) tout en gardant la trace du **tarif catalogue**.
2. **Séjour au temps (pas une nuitée)** — le client dort quelques heures / une demi-journée ; on facture un **montant forfaitaire négocié** (ou un barème « day use »), **sans** appliquer la règle nuitées × `priceNight` + checkout 10h.

Dans les deux cas :
- le **tarif catalogue** (`HotelRoomType.priceNight`) reste la référence affichée ;
- le **montant facturé** est celui négocié, figé sur le séjour / la note ;
- la **note de chambre**, la caisse et la facture générale doivent afficher clairement l’écart (catalogue vs appliqué).

---

## 2. Terminologie UI

| Terme | Sens |
|-------|------|
| **Tarif catalogue** | `priceNight` du type de chambre (référence) |
| **Tarif appliqué** | Prix réellement facturé (nuitée négociée ou forfait) |
| **Négociation** | Écart volontaire catalogue → appliqué (réduction ou autre accord) |
| **Mode nuitée** | Facturation par nuits (règle 10h inchangée) |
| **Mode forfait / au temps** | Montant unique pour une occupation bornée (heures / créneau), hors calcul nuitées |
| **Motif** | Texte court obligatoire si écart ≠ 0 (audit) |

---

## 3. Décisions d’architecture (recommandées)

### 3.1 Ne pas modifier le catalogue à chaque négociation

`HotelRoomType.priceNight` reste le **prix de référence**.  
La négociation vit sur **`HotelStay`** (et se reflète dans les lignes `FolioLine` kind `NIGHT` / nouveau kind).

### 3.2 Deux modes de facturation hébergement

Enum sur le séjour (ex. `StayBillingMode`) :

| Mode | Calcul | Quand |
|------|--------|--------|
| `NIGHTLY` (défaut) | `nights × unitPriceApplied` (+ règle 10h au check-out) | Séjour classique |
| `FLAT` | **1** ligne forfait = `flatAmount` | Day use / X heures / accord global |

Règle : en `FLAT`, **ne pas** appeler `reconcileStayNightCharges` (sinon on écrase le forfait par le catalogue × nuits).

### 3.3 Champs sur `HotelStay` (proposition)

| Champ | Type | Rôle |
|-------|------|------|
| `billingMode` | `NIGHTLY \| FLAT` | Mode de facturation |
| `catalogUnitPrice` | `Float` | Snapshot `priceNight` à la création (audit) |
| `unitPriceApplied` | `Float?` | Prix / nuit négocié (`NIGHTLY`) ; null = catalogue |
| `flatAmount` | `Float?` | Montant forfait (`FLAT`) |
| `plannedHours` | `Int?` | Durée indicative (ex. 4 h) — UI / libellé, pas moteur fiscal |
| `rateNote` | `String?` | Motif négociation / forfait |
| `negotiatedByUserId` | `String?` | Qui a validé l’écart |

Contraintes métier :
- `NIGHTLY` : `unitPriceApplied >= 0` ; si `< catalogUnitPrice` → `rateNote` requis (seuil configurable plus tard).
- `FLAT` : `flatAmount >= 0` + `rateNote` requis ; dates entrée/sortie (ou heures) toujours renseignées pour le planning chambres.

### 3.4 Lignes de note (`FolioLine`)

- **`NIGHTLY`** : conserver `kind: NIGHT` ; `unitPrice` = tarif appliqué ; `quantity` = nuits ; description mentionne « tarif négocié » si écart.
- **`FLAT`** : soit réutiliser `NIGHT` avec `quantity: 1` et description « Forfait séjour · X h », soit ajouter `FolioLineKind.STAY_FLAT` (plus clair en reporting). **Recommandation : `STAY_FLAT`**.

Les consommations F&B / Sur note restent inchangées.

### 3.5 Snapshot vs recalcul

Aujourd’hui `reconcileStayNightCharges` relit toujours `room.roomType.priceNight`.  
À changer : utiliser `stay.unitPriceApplied ?? stay.catalogUnitPrice` (jamais le catalogue « live » si le type de chambre a changé de prix après check-in).

---

## 4. Parcours UX

### 4.1 Nouvelle réservation / check-in (`sejours`)

Après choix chambre :

1. Afficher **tarif catalogue** (lecture seule).
2. Sélecteur **Mode** : « Nuitée(s) » | « Forfait / au temps ».
3. **Nuitée**  
   - Champ optionnel « Tarif / nuit appliqué » (prérempli catalogue).  
   - Si modifié → champ **Motif** + aperçu total (`nuits × tarif`).  
   - Badge « Négocié −X % » si réduction.
4. **Forfait / au temps**  
   - Champ **Montant forfait** (obligatoire).  
   - Champ optionnel **Durée** (heures) + motif.  
   - Dates : même planning chambre ; hint « hors calcul nuitée / règle 10h ».
5. Création séjour + ligne(s) note avec montants figés.

### 4.2 Pendant le séjour

- Action « Ajuster le tarif » (permission staff) : modifier `unitPriceApplied` / `flatAmount` + motif → recalcul ligne hébergement uniquement.
- Prolongation :  
  - `NIGHTLY` → nuits ajoutées × **même** `unitPriceApplied`.  
  - `FLAT` → pas d’auto-nuitées ; proposer « convertir en nuitée » ou « nouveau forfait » (choix explicite).

### 4.3 Check-out / file caisse

- Recap note : section hébergement avec catalogue, appliqué, écart, motif.
- `NIGHTLY` : reconcile avec tarif appliqué + règle 10h.
- `FLAT` : ne pas reconcilier en nuitées ; solde = forfait + conso − paiements.

### 4.4 Permissions (phase 2 si besoin)

- Négociation / forfait : rôle réception / gérant (flag `canNegotiateStayRate` ou permission existante).
- Plafond réduction % optionnel plus tard.

---

## 5. Impacts techniques (fichiers clés)

| Zone | Changement |
|------|------------|
| `prisma/schema.prisma` | Enum `StayBillingMode`, champs `HotelStay`, éventuellement `FolioLineKind.STAY_FLAT` |
| `lib/hotel/stay-nights.ts` | Inchangé pour le calendrier ; **ne pas** l’utiliser en `FLAT` |
| `lib/hotel/actions.ts` | `createStayAction`, `extendStayAction`, `reconcileStayNightCharges`, `prepareStayCheckoutBillingAction` |
| `sejours-client.tsx` | Formulaire mode + tarif / forfait + motif |
| `stay-folio-statement.tsx` + PDF note | Afficher catalogue / appliqué / motif |
| Caisse / file check-out | Aucun changement de flux ; montants déjà sur la note |
| Tests | `stay-nights` + nouveaux tests facturation `NIGHTLY` négocié / `FLAT` |

---

## 6. Phases de livraison

### Phase A — Négociation nuitée (MVP)

1. Snapshot `catalogUnitPrice` + `unitPriceApplied` + `rateNote` sur `HotelStay`.
2. Création séjour / reconcile / prolongation utilisent le tarif appliqué.
3. UI séjours : champ tarif + motif si ≠ catalogue.
4. Affichage écart sur la note / facture.

**Critère done :** un séjour à −20 % facture correctement à la note et au check-out (règle 10h OK).

### Phase B — Mode forfait / au temps

1. `billingMode` + `flatAmount` (+ `plannedHours` optionnel).
2. Bypass reconcile nuitées ; kind `STAY_FLAT`.
3. UI mode forfait à la création + garde-fous prolongation.
4. Libellés facture « Forfait séjour ».

**Critère done :** day use 4 h à montant fixe, solde caisse correct, pas de ligne « N nuit(s) × priceNight ».

### Phase C — Gouvernance (optionnel)

- Permission négociation, plafond %, journal des ajustements, rapport « remises hébergement ».

---

## 7. Hors scope (volontaire)

- Tarifs saisonniers / grilles multi-devises spécifiques séjour (le taux de change branche reste global).
- Packages « chambre + petit-déj » complexes.
- Pricing dynamique / yield.
- Facturation à la minute stricte (les heures sont indicatives ; le montant est le forfait négocié).

---

## 8. Risques & points d’attention

| Risque | Mitigation |
|--------|------------|
| Reconcile 10h écrase un forfait | Guard `if (billingMode === FLAT) return` |
| Changement de `priceNight` catalogue après check-in | Toujours snapshot à la création |
| Staff oublie le motif | `rateNote` requis si écart ou mode `FLAT` |
| Prolongation ambiguë en forfait | UI explicite, pas d’auto-nuitées |
| Double ligne NIGHT après ajustement | Même pattern delete+recreate que reconcile actuel |

---

## 9. Ordre d’implémentation suggéré

1. Schéma + migration (`StayBillingMode`, champs stay, `STAY_FLAT`).  
2. Adapter `createStayAction` + `reconcileStayNightCharges` (Phase A).  
3. UI séjours négociation.  
4. Note / facture (écart + motif).  
5. Phase B forfait + tests.  
6. Phase C permissions si demandé.

---

## 10. Questions à trancher avant code (si besoin)

1. Remise exprimée en **montant / nuit**, **%**, ou les deux ? *(Reco : montant / nuit éditable + % affiché en lecture.)*  
2. Forfait : dates calendaires obligatoires pour le planning, ou créneau horaire précis (`checkedInAt` / `expectedOutAt`) ? *(Reco : garder dates planning + `plannedHours` indicatif en MVP.)*  
3. Qui a le droit de négocier dès le MVP — tout staff séjours, ou gérant seulement ?
