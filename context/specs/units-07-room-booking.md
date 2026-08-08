# Unit 07: Réservation chambre client en ligne

**File:** `units-07-room-booking.md` · **Track:** Client  
**PWA** = *Progressive Web App* (espace client).

## Goal

Guests book a hotel room **en ligne**: availability search → draft → **auth (connexion ou création de compte)** → stub payment → confirmation → list under mes séjours (hotel). Responsive + GSAP.

## Design

- Funnel mirrors travel PWA (stepper, CDF prices early) but uses hotel stays/types, not voyage `Reservation` / trajets.
- Org slug paths e.g. `/{orgSlug}/hotel/…`.
- Availability respects rooms not occupied/blocked for selected dates (units-01 inventory + units-02 stays).
- **Compte client obligatoire pour confirmer** la réservation :
  - Recherche / brouillon peuvent rester publics.
  - Avant paiement stub + création du séjour : session Better Auth requise (sign-in ou sign-up, puis retour au funnel via `callbackUrl`).
  - Motif produit : identifier le client pour **mes séjours**, suivi multi-nuits, et rattacher le séjour au compte — **surtout** si le séjour dure **plus d’une nuit** (check-in / check-out sur plusieurs jours).
  - Règle V1 : **toute** confirmation de réservation chambre en ligne exige un compte (pas de checkout anonyme), y compris 1 nuit — les séjours multi-nuits ne doivent jamais être créés sans compte.

## Implementation

- Draft model or pattern analogous to `ReservationDraft` for hotel (peut être créé avant auth).
- Gate auth before confirm/pay (redirect `/auth/sign-in` ou sign-up avec retour au draft).
- Pay via stub → create stay BOOKED/paid per units-06 rules, **lié à l’utilisateur** connecté.
- Confirmation page with stay code ; historique « mes séjours » réservé au titulaire du compte.
- GSAP for funnel transitions.

## Dependencies

- units-01, units-02, units-06.
- Better Auth client session (patterns déjà utilisés pour room service units-05 / mes-reservations voyage).

## Verify when done

- [x] Guest completes booking for available type/dates **after** sign-in or sign-up
- [x] Unauthenticated user cannot confirm/pay ; is redirected to create/sign-in then resumes draft
- [x] Multi-night stay (≥ 2 nuits) is always tied to an authenticated client account
- [x] Overlap with existing stay reduces availability correctly
- [x] Confirmation + history visible under mes séjours for that account
- [x] Voyage PWA tickets unaffected
- [x] Usable on mobile and desktop
- [x] typecheck passes
