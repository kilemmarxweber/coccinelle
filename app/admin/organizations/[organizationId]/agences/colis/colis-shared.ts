export const COLIS_STATUTS = ["EN_ATTENTE", "EXPEDIE", "LIVRE"] as const;
export type ColisStatut = (typeof COLIS_STATUTS)[number];

export type ColisListItem = {
  id: string;
  codeUnique: string;
  statut: ColisStatut;
  poids: number;
  montantAPayer: number;
  destinataireNom: string | null;
  destinataireTel: string | null;
  destinataireId: string | null;
  type: string;
  createdAt: string;
  trajet: { villeDepart: string; villeArrivee: string };
  trajetDepartId: string | null;
  reservationId: string | null;
  reservationCode: string | null;
};
