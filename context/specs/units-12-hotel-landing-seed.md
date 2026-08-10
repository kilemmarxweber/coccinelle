# Unit 12: Landing client hôtel + seed (images / GSAP)

**File:** `units-12-hotel-landing-seed.md` · **Track:** Client  
**GSAP** = *GreenSock Animation Platform* (animations client hôtel).

## Goal

Landing publique `/{orgSlug}/hotel` visuelle : images de chambres pour réserver, nourriture pour commander / table ; seed demo ; header public hôtel (pas branding agence) ; 2–3 motions GSAP.

## Design

- Composition (pas dashboard) : marque / nom hôtel hero, section chambres (images + prix CDF + CTA recherche), section nourriture (images + CTA commande / table).
- Header hôtel : Accueil, Mes séjours, Connexion (units-10) — **pas** Mes billets / Plane.
- GSAP : entrée / reveal / stagger ; `gsap.matchMedia` + `prefers-reduced-motion`.
- Suivre `context/ui-context.md` (pas aesthetic purple AI ; CDF ; FR).

## Implementation

### Schema

- `HotelRoomType.imageUrl String?`
- `HotelMenuItem.imageUrl String?`
- Migration Prisma.

### Seed

- `prisma/seeds/hotel.seed.ts` (idempotent) branché dans `prisma/seed.ts` :
  - branche HOTEL demo si absente
  - types + chambres + `imageUrl`
  - catégories / plats + tables resto + `imageUrl`
- URLs Unsplash stables ou assets `public/demo/hotel/`.

### UI

- Refonte `components/hotel/hotel-client-landing.tsx` + page server charge types / plats featured.
- Layout `app/(public)/[orgSlug]/hotel/layout.tsx` : header hôtel (override branding voyage parent si besoin).

## Dependencies

- units-01 / units-04 (données métier) ; units-10 (lien connexion) ; funnels 05/07/08 déjà livrés.

## Verify when done

- [x] `pnpm` seed produit une branche HOTEL avec chambres + menu + images
- [x] Landing montre chambres et nourriture (pas seulement 3 CTA texte)
- [x] CTAs mènent recherche / commande / table
- [x] Header sans Mes billets ; GSAP + reduced-motion
- [x] Usable mobile + desktop ; typecheck ; voyage PWA inchangé
