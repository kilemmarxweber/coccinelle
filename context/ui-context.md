# UI Context — Coccinelle (focus Hôtel)

## Brand and theme

- Product name in UI: **Coccinelle** / hotel surfaces under branch name.
- Theme: light-first Coccinelle tokens in `app/globals.css`.
- Primary: orange (`--primary` oklch ~47.6 hue). Foreground dark warm charcoal.
- Fonts: Geist Sans / Geist Mono via Next font variables (`--font-sans`, `--font-mono`).
- Component library: shadcn/ui (Base UI), Lucide icons, Sonner toasts, Vaul drawers where already used.

## Layout conventions

### Staff (admin branch)

- Hotel lives under `/admin/organizations/[organizationId]/branches/[branchId]/hotel/…`.
- Hub dashboard uses cards from `lib/branch/branch-menus.ts` — keep hotel cards linking to real screens as units ship.
- Pages use existing admin spacing patterns: page title, short description, primary actions top-right.
- Prefer full-width operational boards for reception (room board), not dense card grids of metrics in the first viewport of the board itself.
- KPI strip above the board: compact counts (libres prêtes, occupées, sales, HS, % occupation) — one job: situational awareness.

### Client (PWA)

- Reuse `components/pwa/` shell patterns (org brand header, funnel stepper) for hotel booking and self-order.
- Mobile-first; CDF prices visible early.
- Self-order: large tap targets, clear cart, confirm order — guest stands in front of staff.

## Room board (UH01+)

- **Grid of rooms** grouped by floor or type.
- Each cell/card shows: room number, type name, **text status label**, optional guest name if occupied (after stays).
- Status must not rely on color alone.

### Status presentation (V1)

| Code / meaning | Label FR | Visual cue |
|----------------|----------|------------|
| Free + ready | Libre · Prête | success / green tone |
| Free + dirty | Libre · Sale | warning / amber |
| Occupied | Occupée | primary or neutral strong |
| Out of order | Hors service | muted / destructive muted |

Exact enum mapping is defined in the UH01 spec (may extend `HotelRoomStatus`).

- Filters: étage, type, statut.
- Empty state: explain bootstrap / create first room types.
- Planning (room × dates): introduce when stays exist (UH02+); UH01 may ship day board only if spec says so.

## F&B UI

- Menu: list by category, price CDF.
- Staff queue: chronological cards with status actions (one primary action per state).
- Guest order: menu → cart → submit; show order status after submit.

## Do / don’t

- Do use existing Button, Badge, Card, Table, Select from `components/ui`.
- Do keep French labels consistent with voyage admin (tutoiement métier already in app: “Chambres”, “Séjours”, etc.).
- Don’t introduce purple gradient AI-landing aesthetics.
- Don’t overlay floating promo badges on operational boards.
- Don’t replace placeholders with another placeholder — ship real content for the unit’s screen.
