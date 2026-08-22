/**
 * Branche usine — famille commerce.
 * Les filières (eau, vins, autres) se gèrent au catalogue, pas à la création.
 * @see context/plan-usine-production-commerce.md
 */

export type FactoryFlags = {
  hasEau: boolean;
  hasVin: boolean;
};

/** Une usine accepte tous les types de produits (eau, vins, et autres). */
export const ALL_FACTORY_FLAGS: FactoryFlags = { hasEau: true, hasVin: true };

export function isUsine(type: string | null | undefined): boolean {
  return (type ?? "").toUpperCase() === "USINE";
}

export function deriveFactoryFlags(_flags?: FactoryFlags): FactoryFlags {
  return ALL_FACTORY_FLAGS;
}
