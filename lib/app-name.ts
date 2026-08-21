/** Nom produit lu depuis `.env` (`APP_NAME`). */
export function appName(): string {
  return process.env.APP_NAME?.trim() || "Coccinelle";
}
