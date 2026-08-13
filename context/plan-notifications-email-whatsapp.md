# Plan — Notifications Email + WhatsApp (Zindua)

| | |
|---|---|
| **Status** | `in_progress` — P0–P7 implémentés (code) · configurer `.env` SMTP/Zindua + cron |
| **Périmètre** | Org / branche Coccinelle : création **membre**, **séjours hôtel**, **check-out**, rappel **20 min avant 10 h**, **promotions** chambres / produits |
| **Référence technique** | Projet **Eteyelo** (`lib/email/*`, `lib/zindua.ts`, `@zindua/sdk`, SMTP Hostinger + `ZINDUA_*`) |
| **État Coccinelle aujourd’hui** | SMTP Gmail-style (`EMAIL_USER` / `EMAIL_PASS`) · email credentials membre **sans** WhatsApp · **pas** de `@zindua/sdk` · `HotelStay.guestPhone` / `guestEmail` déjà présents · `HOTEL_CHECKOUT_HOUR = 10` · `Branch.timezone` défaut `Africa/Kinshasa` · promo produits boutique déjà en schéma |
| **Skills / rules** | `.cursor/skills/notifications-email-whatsapp/SKILL.md` · `.cursor/rules/notifications-branch-branding.mdc` |

---

## 1. Besoin métier (reformulé)

| Déclencheur | Canaux | Contenu attendu |
|-------------|--------|-----------------|
| **Création membre** (équipe org / branche) | Email + WhatsApp | Mot de passe temporaire + lien connexion · **nom de la branche primaire** (celle où le member est réellement rattaché) |
| **Réservation séjour** (`RESERVED` / création stay ou dossier groupe) | Email (si `guestEmail`) + WhatsApp (si `guestPhone`) | Confirmation : dates, chambre/salle, branche, consigne check-in |
| **Check-out effectué** | WhatsApp (+ email si dispo) | Remerciement « merci pour votre passage » · nom branche · invitation à revenir |
| **~20 min avant l’heure de sortie prévue** | WhatsApp | Rappel : départ prévu à **10 h** (`HOTEL_CHECKOUT_HOUR`) · séjour encore `CHECKED_IN` · message 09:40 heure locale branche |
| **Promotion** chambre / produit | WhatsApp (opt-in) | Diffusion aux numéros déjà détenus par le projet (clients, occupants récents, partenaires) · branding branche |

**Personnalisation obligatoire** : chaque message affiche le **nom de la branche active** concernée (pas seulement « Coccinelle ») — membre → branche primaire / première `BranchMember` ; client séjour → `stay.branch` ; promo → branche qui publie.

---

## 2. Modèle Eteyelo à reproduire (sans secrets)

### Variables d’environnement (noms uniquement)

Aligner Coccinelle sur le même contrat qu’Eteyelo (Hostinger SMTP + Zindua) :

```env
APP_NAME=Coccinelle

# SMTP (Hostinger ou autre) — préférer ces noms pour alignement Eteyelo
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=
SMTP_PASS=
MAIL_FROM="Coccinelle <noreply@votredomaine.com>"

# Compat : garder EMAIL_* en alias de lecture (migration douce)
# EMAIL_USER / EMAIL_PASS / EMAIL_HOST / EMAIL_PORT / EMAIL_SECURE / EMAIL_FROM

# Zindua WhatsApp
ZINDUA_API_KEY=
ZINDUA_WHATSAPP_MAIL_TEMPLATE=notification
ZINDUA_SITE_URL=https://votredomaine.com

# Optionnel Meta Cloud API (Eteyelo a aussi WHATSAPP_* — V1 Coccinelle = Zindua seulement)
# WHATSAPP_TOKEN=
# WHATSAPP_PHONE_ID=
```

**Ne jamais committer** les clés / mots de passe. Mettre à jour `.env` local + `.env.exemple` (placeholders).

### Patterns code Eteyelo

| Module | Rôle |
|--------|------|
| `lib/email/mailer.ts` | `sendMail` · SMTP · option `whatsappTo` / miroir |
| `lib/zindua.ts` | `@zindua/sdk` · `toE164Phone` · `sendWhatsApp` · `sendNewUserCredentialsWhatsApp` · template `notification` var `{{code}}` |
| `lib/email/send-new-user-credentials.ts` | Email HTML + WhatsApp dédié · **branchName** dans le corps |
| File Redis / BullMQ | Eteyelo file les emails — **V1 Coccinelle** : envoi fire-and-forget (comme aujourd’hui) ; file optionnelle phase ultérieure |

---

## 3. Décisions d’architecture Coccinelle

| Sujet | Décision V1 |
|-------|-------------|
| Canal WhatsApp | **Zindua** (`@zindua/sdk`) uniquement |
| Template | Un template dashboard `notification` · corps entier dans `{{code}}` (sanitizer sans `\n`) |
| Branding | `Branch.name` (+ `Branch.phone` / adresse si utiles) en tête / signature |
| Membre sans téléphone | Email seul ; WhatsApp skip soft (log warn) |
| Client sans email | WhatsApp seul si téléphone valide |
| Échec canal | Ne bloque pas la création stay / membre · log + toast optionnel « email envoyé / WA non envoyé » |
| Heure rappel | `checkOutDate` (date) + `HOTEL_CHECKOUT_HOUR` (10) en **timezone branche** · fenêtre **09:40–09:45** (cron 5 min) · flag anti-doublon |
| Audience promo | Opt-in explicite plus tard ; V1 = numéros `HotelStay.guestPhone` (séjours branche, N derniers mois) + `BranchPartner.phone` + `Client.telephone` liés à la branche si applicable · **pas** SMS spam aux membres staff |
| Téléphone membre | Ajouter `User.phone` (nullable) **ou** champ saisi à la création + stash temporaire comme le MDP — recommandé : **`User.phone`** |

---

## 4. Phases d’exécution

### Phase 0 — Fondations env & deps

**Objectif** : même contrat SMTP + Zindua qu’Eteyelo.

- [x] Ajouter `@zindua/sdk` dans `package.json`
- [x] Étendre `lib/email/mailer.ts` : lire `SMTP_*` avec fallback `EMAIL_*` · `MAIL_FROM` / `EMAIL_FROM` · `isSmtpConfigured` / `isZinduaConfigured`
- [x] Créer `lib/zindua.ts` (port adapté Coccinelle : `APP_NAME=Coccinelle`, E.164 RDC)
- [x] Mettre à jour `.env.exemple` (placeholders)
- [x] Smoke test : `lib/notifications/smoke-test.ts` (`sendNotificationSmokeTestAction`)

**Critère done** : envoi test email + WhatsApp (numéro de test) depuis une action serveur dédiée `sendNotificationSmokeTestAction` (dev only).

---

### Phase 1 — Branding branche (skill / rule)

**Objectif** : tout message porte le **nom de la branche réelle**.

Helper unique :

```ts
// lib/notifications/branch-context.ts
resolveNotificationBranch({ branchId }) → { name, phone, address, city, timezone, email }
resolveMemberPrimaryBranch({ memberId }) → même shape (isPrimary puis première ACTIVE)
```

- [x] `lib/notifications/branch-context.ts`
- [x] Utilisé par credentials, séjours, promo, rappels

**Critère done** : helper utilisé par tous les senders des phases suivantes.

---

### Phase 2 — Création membre : email + WhatsApp MDP

- [x] `phone` sur schéma création membre + formulaire
- [x] `User.phone` Prisma
- [x] Stash MDP + phone + branchId + org
- [x] `send-new-user-credentials` dual canal + branding
- [x] Reset MDP dual canal

**Critère done** : création membre avec téléphone → email reçu + WA reçu, texte contient le **nom de la branche**.

---

### Phase 3 — Réservation séjour : confirmation

- [x] Hook `createStayAction` + `createStayGroupAction`
- [x] `lib/notifications/send-stay-reservation.ts`

**Critère done** : création stay avec phone/email → double notif ; sans contact → no-op silencieux.

---

### Phase 4 — Check-out : message de remerciement

- [x] Hook `checkOutStayAction`
- [x] `checkoutThanksSentAt` + `send-stay-checkout-thanks.ts`

**Critère done** : check-out → message envoyé 1 fois (idempotence soft via log ou `checkoutNotifiedAt` optionnel).

---

### Phase 5 — Rappel 20 min avant 10 h

- [x] `checkoutReminderSentAt` sur `HotelStay`
- [x] `app/api/cron/checkout-reminders/route.ts` (Bearer `CRON_SECRET`)

**Critère done** : stay du jour encore en maison à 09:40 → 1 WA ; re-run cron → 0 second envoi.

---

### Phase 6 — Promotions automatiques

- [x] `collect-branch-phones.ts` + `send-promo-broadcast.ts`
- [x] Bouton « Notifier WhatsApp » sur produits promo (`notifyShopProductPromoWhatsAppAction`)

**Critère done** : bouton « Notifier WhatsApp » sur promo → messages branding branche ; journal des envois.

---

### Phase 7 — Observabilité & garde-fous

- [x] Logs structurés `lib/notifications/log.ts` (toHash, pas de MDP)
- [ ] Opt-out ultérieur (`whatsappOptOut`) — reporté
- [x] Masquer MDP dans logs prod
- [ ] Tests unitaires dédiés — reporté (tsc OK)

---

## 5. Ordre de livraison recommandé

```
P0 env/Zindua → P1 branding → P2 membre → P3 réservation → P4 checkout thanks → P5 cron rappel → P6 promos → P7 logs
```

Chaque phase = PR isolée, testable sans la suivante.

---

## 6. Fichiers cibles (carte)

| Zone | Fichiers |
|------|----------|
| Env | `.env.exemple`, `.env` (local) |
| Core | `lib/email/mailer.ts`, `lib/zindua.ts`, `lib/notifications/*` |
| Membre | `members/schema.ts`, `actions.ts`, `create-member-form.tsx`, `lib/auth.ts`, `send-new-user-credentials.ts` |
| Séjours | `lib/hotel/actions.ts`, `lib/hotel/stay-group.ts` |
| Cron | `app/api/cron/checkout-reminders/route.ts` + champ Prisma |
| Promo | `lib/boutique/actions.ts` + UI produits / chambres |
| Agent | `.cursor/skills/notifications-email-whatsapp/SKILL.md`, `.cursor/rules/notifications-branch-branding.mdc` |

---

## 7. Hors scope V1

- File Redis/BullMQ (reprendre plus tard si volume)
- Meta Cloud API directe (`WHATSAPP_TOKEN`) en parallèle de Zindua
- SMS / push PWA
- Templates Zindua multiples (un seul `notification`)
- Marketing cross-org (uniquement numéros de **la** branche)

---

## 8. Checklist démarrage immédiat

1. Copier les **noms** de variables Eteyelo dans `.env` Coccinelle (valeurs du compte Coccinelle / Hostinger / Zindua).
2. `pnpm add @zindua/sdk`
3. Exécuter **Phase 0 + 1**, puis **Phase 2** (membre) en premier livrable visible.
4. Suivre la skill projet à chaque PR de notif.

---

## 9. Références code Eteyelo (chemins)

- `Eteyelo/lib/zindua.ts`
- `Eteyelo/lib/email/mailer.ts`
- `Eteyelo/lib/email/send-new-user-credentials.ts`
- Template Zindua dashboard : slug `notification` · variables `appName`, `name`, `code` (Coccinelle peut n’utiliser que `code` comme Eteyelo credentials WA)
