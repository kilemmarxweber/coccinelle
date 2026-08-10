# UI Context — Coccinelle (focus Hôtel)

## Brand and theme

- Product name in UI: **Coccinelle** / hotel surfaces under branch name.
- Theme: light-first Coccinelle tokens in `app/globals.css`.
- **Default theme is light** (`app/layout.tsx` — Admin and app shell). Users may still toggle dark via the theme control if present; do not ship Admin defaulting to dark.
- Primary: orange (`--primary` oklch ~47.6 hue). Foreground dark warm charcoal.
- Fonts: Geist Sans / Geist Mono via Next font variables (`--font-sans`, `--font-mono`).
- Component library: shadcn/ui (Base UI), Lucide icons, Sonner toasts, Vaul drawers where already used.

## Layout conventions

### Admin (personnel)

- Lives under `/admin/…` with auth in `app/admin/layout.tsx`.
- Hotel lives under `/admin/organizations/[organizationId]/branches/[branchId]/hotel/…`.
- **units-11:** hotel module uses app shell (sidebar + header) on all `…/hotel/*` Admin routes — not blank cards-only pages.
- Hub dashboard uses cards from `lib/branch/branch-menus.ts` — keep hotel cards linking to real screens as units ship.
- Pages use existing admin spacing: page title, short description, primary actions top-right.
- Prefer full-width operational boards for reception (room board).
- KPI strip above the board: libres prêtes, occupées, sales, HS, % occupation.
- Restauration sur place: staff order entry + kitchen queue (serveur → enregistrement → chef). No GSAP requirement on Admin.

### Public (espace client)

- Code under route group `app/(public)/` — **not** the static folder `public/` at repo root.
- Landing produit Coccinelle at `/` (`app/(public)/page.tsx`).
- Org Client routes under `/{orgSlug}/…` and hotel under `/{orgSlug}/hotel/…` (same URLs; files in `app/(public)/[orgSlug]/`).
- Separate layout from Admin: no staff sidebar; auth where the page needs it (billets voyage, room service, **confirmation réservation chambre**).
- **units-10:** hôtel auth = `/{orgSlug}/hotel/connexion|inscription` (pas `/auth/sign-in` Voyage). Header public hôtel distinct (pas Mes billets).
- Room booking funnel: search/draft may be public; **sign-in or sign-up required before confirm/pay** (multi-night stays always tied to an account).
- **units-12:** landing `/{orgSlug}/hotel` with room + food imagery (seeded), GSAP, CTAs to funnels.
- **Responsive**: desk + tablet + mobile.
- **GSAP** for intentional motion on hotel Client surfaces (funnel transitions, entrées, micro-interactions) — 2–3 purposeful motions per major surface, not noise.
- CDF prices visible early; French copy.
- Surfaces: book room; book table (alone or with food at a set time); room-service food if the guest has a stay.
- Do **not** design a “order yourself at the table instead of the serveur” flow for sur-place dining.

## Room board (units-01+)

- Grid of rooms grouped by floor or type.
- Each cell: room number, type name, **text status label**, optional guest name if occupied (after stays).
- Status must not rely on color alone.

### Status presentation (V1)

| Code / meaning | Label FR | Visual cue |
|----------------|----------|------------|
| Free + ready | Libre · Prête | success / green tone |
| Free + dirty | Libre · Sale | warning / amber |
| Occupied | Occupée | primary or neutral strong |
| Out of order | Hors service | muted / destructive muted |

Exact enum mapping: see `context/specs/units-01-room-board.md`.

- Filters: étage, type, statut.
- Empty state: bootstrap / create first room types.
- Planning (room × dates): when stays exist (units-02+).

## Restauration (F&B) UI

- **Admin:** menu by category (CDF); staff create/register orders; chronological kitchen queue with one primary action per state.
- **Client en ligne:** table reservation funnel (± food); room-service menu → cart → submit when stay exists.

## Do / don’t

- Do use existing Button, Badge, Card, Table, Select from `components/ui`.
- Do keep French labels; explain jargon in docs (glossaire).
- Don’t introduce purple gradient AI-landing aesthetics.
- Don’t overlay floating promo badges on operational boards.
- Don’t replace placeholders with another placeholder — ship real content for the unit’s screen.
- Don’t use GSAP on dense Admin ops boards by default.
