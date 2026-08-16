/**
 * Sections UI de la matrice de permissions (R03).
 * Catalogue produit uniquement — hors `team` BA.
 */

import {
  organizationProductStatements,
  type OrganizationProductResource,
} from "@/lib/permissions";

export type PermissionMatrixSectionId =
  | "organisation"
  | "agence"
  | "hotel"
  | "boutique";

export type PermissionMatrixSection = {
  id: PermissionMatrixSectionId;
  label: string;
  resources: OrganizationProductResource[];
};

const ORGANISATION: OrganizationProductResource[] = [
  "organization",
  "member",
  "invitation",
  "ac",
  "equipe",
  "branch",
];

const AGENCE: OrganizationProductResource[] = [
  "inscription",
  "trajet",
  "depart",
  "embarquement",
  "colis",
  "clients_agence",
  "rapport_agence",
];

const BOUTIQUE: OrganizationProductResource[] = [
  "boutique_pos",
  "boutique_produits",
  "boutique_stock",
];

const HOTEL: OrganizationProductResource[] = (
  Object.keys(organizationProductStatements) as OrganizationProductResource[]
).filter(
  (r) =>
    !ORGANISATION.includes(r) && !AGENCE.includes(r) && !BOUTIQUE.includes(r),
);

export const PERMISSION_MATRIX_SECTIONS: PermissionMatrixSection[] = [
  { id: "organisation", label: "Organisation", resources: ORGANISATION },
  { id: "agence", label: "Agence", resources: AGENCE },
  { id: "hotel", label: "Hôtel", resources: HOTEL },
  { id: "boutique", label: "Boutique", resources: BOUTIQUE },
];
