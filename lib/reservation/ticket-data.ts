export type TicketPassenger = {
  id: string;
  nom: string;
  prenom: string;
  categorie: string;
  prix: number;
  codeUnique: string;
  occupePlace: boolean;
  qrDataUrl: string;
  qrPayload: string;
};

export type TicketReservation = {
  codeUnique: string;
  dateDepart: string | Date;
  heureDepart: string;
  prixBillet: number;
  prixTotal: number;
  organization: {
    name: string;
    logo: string | null;
  };
  trajet: {
    villeDepart: string;
    villeArrivee: string;
    modeTransport: string;
  };
  client: {
    displayName: string;
    telephone: string;
  };
  passagers: TicketPassenger[];
  paiement: {
    methode: string;
    montant: number;
    statut: string;
  } | null;
};
