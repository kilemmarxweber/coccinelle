import type { NewClientForm, PassagerForm } from "./types";

export const emptyPassager = (): PassagerForm => ({
  nom: "",
  prenom: "",
  sexe: "M",
  categorie: "ADULTE",
  dateNaissance: "",
});

export const EMPTY_NEW_CLIENT: NewClientForm = {
  nom: "",
  prenom: "",
  postnom: "",
  telephone: "",
  email: "",
  societe: "",
  adresse: "",
};
