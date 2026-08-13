/** Commandes que le serveur peut encore modifier / annuler. */

export const SERVER_EDITABLE_STATUSES = [
  "ENVOYEE",
  "EN_PREPARATION",
  "PRETE",
  "EN_CAISSE",
] as const;

export function isHotelOrderOpenForServerEdit(order: {
  status: string;
  deliveredAt?: Date | string | null;
  paidAt?: Date | string | null;
  postedToFolioAt?: Date | string | null;
}) {
  if (order.deliveredAt) return false;
  if (order.paidAt) return false;
  if (order.postedToFolioAt) return false;
  if (
    order.status === "PAYEE" ||
    order.status === "LIVREE" ||
    order.status === "ANNULEE" ||
    order.status === "BROUILLON"
  ) {
    return false;
  }
  return (SERVER_EDITABLE_STATUSES as readonly string[]).includes(order.status);
}
