/** Types d’opérations fonds (dépenses / banques / propriétaire). */
export const EXPENSE_KINDS = [
  "DEPENSE",
  "DEPOT_BANQUE",
  "REMISE_PROPRIETAIRE",
  "PRET_PROPRIETAIRE",
  "SALAIRE",
  "AVANCE_SALAIRE",
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

/** Entrée de fonds (prêt propriétaire → alimente la caisse). */
export function isOwnerAdvanceKind(kind: ExpenseKind) {
  return kind === "PRET_PROPRIETAIRE";
}

/** Sortie de caisse (dépense / banque / remise). */
export function isCashOutflowKind(kind: ExpenseKind) {
  return !isOwnerAdvanceKind(kind);
}

/** Titre du document comptable (impression / signature). */
export function expenseDocumentTitle(kind: ExpenseKind): string {
  if (kind === "DEPOT_BANQUE") {
    return "Bon de sortie de caisse — Dépôt bancaire";
  }
  if (kind === "REMISE_PROPRIETAIRE") {
    return "Bon de sortie de caisse — Remise au propriétaire";
  }
  if (kind === "PRET_PROPRIETAIRE") {
    return "Bon d’entrée de caisse — Prêt / avance propriétaire";
  }
  if (kind === "SALAIRE") {
    return "Bon de sortie de caisse — Salaire";
  }
  if (kind === "AVANCE_SALAIRE") {
    return "Bon de sortie de caisse — Avance sur salaire";
  }
  return "Bon de sortie de caisse — Dépense";
}

export function expenseKindLabel(kind: ExpenseKind): string {
  if (kind === "DEPOT_BANQUE") return "Dépôt à la banque";
  if (kind === "REMISE_PROPRIETAIRE") return "Remise au propriétaire";
  if (kind === "PRET_PROPRIETAIRE") return "Prêt propriétaire";
  if (kind === "SALAIRE") return "Salaire";
  if (kind === "AVANCE_SALAIRE") return "Avance sur salaire";
  return "Dépense";
}

export function expenseNumberPrefix(kind: ExpenseKind): string {
  if (kind === "DEPOT_BANQUE") return "DBQ";
  if (kind === "REMISE_PROPRIETAIRE") return "RPR";
  if (kind === "PRET_PROPRIETAIRE") return "PRT";
  if (kind === "SALAIRE") return "SAL";
  if (kind === "AVANCE_SALAIRE") return "AVS";
  return "DEP";
}

export function defaultExpenseCategory(kind: ExpenseKind): string {
  if (kind === "DEPOT_BANQUE") return "Banque";
  if (kind === "REMISE_PROPRIETAIRE" || kind === "PRET_PROPRIETAIRE") {
    return "Propriétaire";
  }
  if (kind === "SALAIRE" || kind === "AVANCE_SALAIRE") return "Personnel";
  return "Divers";
}

export function defaultExpenseLabel(kind: ExpenseKind): string {
  if (kind === "DEPOT_BANQUE") return "Dépôt bancaire";
  if (kind === "REMISE_PROPRIETAIRE") return "Remise au propriétaire";
  if (kind === "PRET_PROPRIETAIRE") return "Prêt / avance propriétaire";
  if (kind === "SALAIRE") return "Salaire";
  if (kind === "AVANCE_SALAIRE") return "Avance sur salaire";
  return "";
}

/** Note caisse / paiement. */
export function expenseCashNote(kind: ExpenseKind, label: string): string {
  const short = expenseKindLabel(kind);
  return `${short} · ${label}`;
}

export function expenseBeneficiaryRole(kind: ExpenseKind): string {
  if (kind === "DEPOT_BANQUE") return "Banque / caissier banque";
  if (kind === "REMISE_PROPRIETAIRE") return "Propriétaire (bénéficiaire)";
  if (kind === "PRET_PROPRIETAIRE") return "Propriétaire (prêteur)";
  return "Bénéficiaire";
}

/** Signe du mouvement caisse : prêt = entrée (+), sinon sortie (−). */
export function expenseCashSign(kind: ExpenseKind): 1 | -1 {
  return isOwnerAdvanceKind(kind) ? 1 : -1;
}
