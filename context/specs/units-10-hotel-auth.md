# Unit 10: Auth hôtel séparée (connexion / inscription)

**File:** `units-10-hotel-auth.md` · **Track:** Client + Admin entry  
**Focus:** hôtel uniquement — laisser `/auth/sign-in` Voyage intact.

## Goal

Surfaces de connexion et d’inscription **dédiées à l’hôtel**, séparées du login agence/voyage (Plane / « Coccinelle Voyage »). Même session Better Auth ; UI, URLs et redirects hôtel-only.

## Design

- Routes : `/{orgSlug}/hotel/connexion` et `/{orgSlug}/hotel/inscription` sous `app/(public)/[orgSlug]/hotel/…`.
- Shell auth hôtel (copy FR hôtel, pas icône Plane, pas wording Voyage) — composant distinct de `AuthShell`.
- Gates funnels hôtel (checkout chambre, mes séjours, etc.) → `…/hotel/connexion?callbackUrl=…` **jamais** `/auth/sign-in`.
- Post-login hôtel (`resolveHotelPostLoginPath` ou équivalent) :
  - `callbackUrl` safe sous `/{orgSlug}/hotel/…` prioritaire
  - staff avec droits `hotel_*` → hub Admin branche HOTEL
  - `client` → `/{orgSlug}/hotel/mes-sejours` (pas mes-reservations billets)

## Implementation

- Pages + formulaires hôtel réutilisant schema Zod / `authClient` existants.
- Helper redirect hôtel ; ne pas casser `resolvePostLoginPath` voyage sauf minimal si partagé.
- Câbler toutes les redirects auth dans `app/(public)/[orgSlug]/hotel/**` et funnels associés.
- Header public hôtel (si pas encore units-12) : lien Connexion vers route hôtel.

## Dependencies

- units-09 (slug `client`, rôles staff hôtel).
- units-07 / units-05 patterns auth gate.

## Verify when done

- [ ] Connexion / inscription hôtel accessibles sous `/{orgSlug}/hotel/…`
- [ ] Aucune gate hôtel ne renvoie vers `/auth/sign-in` Voyage
- [ ] Client land sur mes séjours ; staff sur Admin hôtel (sans callback)
- [ ] Callback checkout chambre reprend le funnel après login
- [ ] `/auth/sign-in` Voyage inchangé fonctionnellement
- [ ] typecheck passe
