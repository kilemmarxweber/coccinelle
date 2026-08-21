/** Ouvre le HTML d’un bon stock dans un onglet imprimable (client only). */
export function openPrintHtml(html: string) {
  const w = window.open("", "_blank");
  if (!w) {
    throw new Error("Autorisez les pop-ups pour imprimer le document.");
  }
  w.document.write(html);
  w.document.close();
  w.focus();
}
