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

export type GuichetFormProps = {
  organizationId: string;
  trajets: TrajetOption[];
};
