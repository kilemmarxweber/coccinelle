# Unit 11: Shell Admin hôtel (sidebar + header)

**File:** `units-11-hotel-admin-shell.md` · **Track:** Admin  
**Focus:** hôtel uniquement — ne pas toucher `GerantSidebar` / shell agence.

## Goal

L’Admin hôtel se comporte comme une **application** : sidebar persistante + header complet sur toutes les routes `…/branches/[branchId]/hotel/*`, avec navigation filtrée par permissions Better Auth.

## Design

- Layout dédié : `app/admin/organizations/[organizationId]/branches/[branchId]/hotel/layout.tsx`.
- Pattern proche du shell gérant agence (`SidebarProvider` + inset + header) mais composants **hôtel** séparés (`HotelAdminSidebar`, etc.).
- Header : trigger sidebar, nom branche, type HOTEL, theme, lien retour branches, sign-out.
- Nav filtrée : Accueil hôtel, Chambres, Séjours, Restauration, Caisse (selon `hotel_room` / `hotel_stay` / `hotel_fnb`).
- Réceptionniste / caissier / serveur / gérant / owner voient des entrées différentes (pas le même shell vide).

## Implementation

- `components/hotel/hotel-admin-sidebar.tsx` (+ helpers nav permission si besoin).
- Réutiliser items de `lib/branch/branch-menus.ts` / resolve permissions ; éviter duplication de chemins (`hotelRoutes`).
- Pages chambres / séjours / restauration : retirer headers redondants seulement s’ils doublonnent le shell.
- Gate caisse si URL directe : permission `hotel_stay` adaptée (units-09).

## Dependencies

- units-09 (rôles / matrices).
- Routes hotel Admin units-01/02/04/06 déjà livrées.

## Verify when done

- [ ] Toute page sous `…/hotel/*` Admin a sidebar + header
- [ ] Serveur ne voit pas Chambres/Séjours si sans permission
- [ ] Réceptionniste / caissier / gérant voient les entrées attendues
- [ ] Pas de dépendance à `GerantSidebar` agence
- [ ] typecheck passe ; voyage Admin intact
