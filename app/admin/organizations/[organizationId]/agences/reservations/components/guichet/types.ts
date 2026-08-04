import type { SearchDepartResult } from "@/lib/search-departs/types";

export type TrajetOption = {
  id: string;
  villeDepart: string;
  villeArrivee: string;
  prixBase: number;
  prixParKilo: number;
  kilosGratuits: number;
  departs: Array<{
    id: string;
    dateDepart: string;
    heureDepart: string;
    statut: string;
    capacitePlaces: number;
    placesRestantes: number;
  }>;
};

export type ClientHit = {
  id: string;
  nom: string;
  prenom: string;
  postnom: string;
  telephone: string;
  email: string;
};

export type PassagerForm = {
  nom: string;
  prenom: string;
  sexe: "M" | "F";
  categorie: "ADULTE" | "ENFANT" | "BEBE";
  dateNaissance: string;
};

export type NewClientForm = {
  nom: string;
  prenom: string;
  postnom: string;
  telephone: string;
  email: string;
  societe: string;
  adresse: string;
};

export type ModePaiement = "CASH" | "MOBILE" | "CARD";

export type GuichetStepId =
  | "recherche"
  | "client"
  | "passagers"
  | "colis"
  | "paiement";

export const GUICHET_STEPS: ReadonlyArray<{ id: GuichetStepId; label: string }> =
  [
    { id: "recherche", label: "Recherche" },
    { id: "client", label: "Client" },
    { id: "passagers", label: "Passagers" },
    { id: "colis", label: "Colis" },
    { id: "paiement", label: "Paiement" },
  ];

export type GuichetFormProps = {
  organizationId: string;
  /** Mode vente express : départs du jour + espèces. */
  express?: boolean;
};

export type SelectedDepart = SearchDepartResult;
