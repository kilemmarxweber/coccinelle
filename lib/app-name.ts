/** Nom produit lu depuis `.env` (`APP_NAME`, exposé au navigateur via `NEXT_PUBLIC_APP_NAME`). */
export function appName(): string {
  return (
    process.env.APP_NAME?.trim() ||
    process.env.NEXT_PUBLIC_APP_NAME?.trim() ||
    "Coccinelle"
  );
}
