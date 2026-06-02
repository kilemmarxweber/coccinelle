export type TrajetTarifs = {
  prixBase: number;
  prixParKilo: number;
  kilosGratuits: number;
};

export type PassagerPricingInput = {
  categorie: "ADULTE" | "ENFANT" | "BEBE";
};

export type ColisPricingInput = {
  type?: "ORDINAIRE" | "SPECIAL";
  poids?: number | string;
  montantFixe?: number;
};

/** Tarif billet selon la catégorie passager. */
export function prixPassager(
  tarifs: TrajetTarifs,
  categorie: PassagerPricingInput["categorie"],
): number {
  switch (categorie) {
    case "ADULTE":
      return tarifs.prixBase;
    case "ENFANT":
      return Math.round(tarifs.prixBase * 0.5);
    case "BEBE":
      return 0;
    default:
      return tarifs.prixBase;
  }
}

/** Surplus colis (ordinaire) ou montant fixe (spécial). */
export function prixColis(
  tarifs: TrajetTarifs,
  colis: ColisPricingInput,
): {
  kilosSupplement: number;
  kilosGratuits: number;
  prix: number;
} {
  if (!colis.type) {
    return { kilosSupplement: 0, kilosGratuits: tarifs.kilosGratuits, prix: 0 };
  }

  if (colis.type === "SPECIAL") {
    const montant = colis.montantFixe ?? 0;
    return {
      kilosSupplement: 0,
      kilosGratuits: tarifs.kilosGratuits,
      prix: Math.max(0, montant),
    };
  }

  const poids =
    colis.poids === undefined || colis.poids === ""
      ? 0
      : Number(colis.poids);
  const poidsNum = Number.isFinite(poids) ? Math.max(0, poids) : 0;
  const surplus = Math.max(0, poidsNum - tarifs.kilosGratuits);

  return {
    kilosSupplement: surplus,
    kilosGratuits: tarifs.kilosGratuits,
    prix: Math.round(surplus * tarifs.prixParKilo),
  };
}

export function computeReservationPricing(
  tarifs: TrajetTarifs,
  passagers: PassagerPricingInput[],
  colis?: ColisPricingInput,
) {
  const passagerLines = passagers.map((p) => ({
    categorie: p.categorie,
    prix: prixPassager(tarifs, p.categorie),
  }));
  const totalPassagers = passagerLines.reduce((s, l) => s + l.prix, 0);
  const colisCalc = prixColis(tarifs, colis ?? {});
  const total = totalPassagers + colisCalc.prix;

  return {
    passagerLines,
    colis: colisCalc,
    totalPassagers,
    totalColis: colisCalc.prix,
    total,
  };
}
