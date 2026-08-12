/** Types de sortie de caisse (dépenses). */
export const EXPENSE_KINDS = [
  "DEPENSE",
  "DEPOT_BANQUE",
  "REMISE_PROPRIETAIRE",
] as const;

export type ExpenseKind = (typeof EXPENSE_KINDS)[number];

export function isExpenseKind(value: string): value is ExpenseKind {
  return (EXPENSE_KINDS as readonly string[]).includes(value);
}

export function normalizeExpenseKind(
  value: string | null | undefined,
): ExpenseKind {
  const v = (value ?? "").trim().toUpperCase();
  if (isExpenseKind(v)) return v;
  return "DEPENSE";
}

/** Titre du document comptable (impression / signature). */
export function expenseDocumentTitle(kind: ExpenseKind): string {
  if (kind === "DEPOT_BANQUE") {
    return "Bon de sortie de caisse — Dépôt bancaire";
  }
  if (kind === "REMISE_PROPRIETAIRE") {
    return "Bon de sortie de caisse — Remise au propriétaire";
  }
  return "Bon de sortie de caisse — Dépense";
}

export function expenseKindLabel(kind: ExpenseKind): string {
  if (kind === "DEPOT_BANQUE") return "Dépôt à la banque";
  if (kind === "REMISE_PROPRIETAIRE") return "Remise au propriétaire";
  return "Dépense";
}

export function expenseNumberPrefix(kind: ExpenseKind): string {
  if (kind === "DEPOT_BANQUE") return "DBQ";
  if (kind === "REMISE_PROPRIETAIRE") return "RPR";
  return "DEP";
}

export function defaultExpenseCategory(kind: ExpenseKind): string {
  if (kind === "DEPOT_BANQUE") return "Banque";
  if (kind === "REMISE_PROPRIETAIRE") return "Propriétaire";
  return "Divers";
}

export function defaultExpenseLabel(kind: ExpenseKind): string {
  if (kind === "DEPOT_BANQUE") return "Dépôt bancaire";
  if (kind === "REMISE_PROPRIETAIRE") return "Remise au propriétaire";
  return "";
}

/** Note caisse / paiement (rapport financier via expenseId). */
export function expenseCashNote(kind: ExpenseKind, label: string): string {
  const short = expenseKindLabel(kind);
  return `${short} · ${label}`;
}

export function expenseBeneficiaryRole(kind: ExpenseKind): string {
  if (kind === "DEPOT_BANQUE") return "Banque / caissier banque";
  if (kind === "REMISE_PROPRIETAIRE") return "Propriétaire";
  return "Bénéficiaire";
}
