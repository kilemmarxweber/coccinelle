function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatWhen(value: string | Date) {
  const d = value instanceof Date ? value : new Date(value);
  return d.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export type ServiceStockDocLine = {
  name: string;
  sourceZone: string;
  qtyAttributed: number;
  qtyOpeningCounted?: number | null;
  qtySold?: number;
  qtyClosingCounted?: number | null;
  qtyReturnedToDepot?: number;
  qtyLoss?: number;
  unitPriceUsd: number;
};

export function buildServiceStockOpeningHtml(input: {
  branchName: string;
  number: string;
  vendorDisplayName: string;
  managerName: string;
  openedAt: string | Date;
  lines: ServiceStockDocLine[];
  updatedNote?: string | null;
}) {
  const rows = input.lines
    .map(
      (l) => `<tr>
      <td style="padding:8px;border-bottom:1px solid #ddd">${escapeHtml(l.name)}</td>
      <td style="padding:8px;border-bottom:1px solid #ddd">${escapeHtml(l.sourceZone)}</td>
      <td style="padding:8px;border-bottom:1px solid #ddd;text-align:right">${l.qtyAttributed}</td>
      <td style="padding:8px;border-bottom:1px solid #ddd;text-align:right">${l.qtyOpeningCounted ?? "—"}</td>
    </tr>`,
    )
    .join("");

  return `<!doctype html><html><head><meta charset="utf-8"/><title>${escapeHtml(input.number)} — Ouverture</title>
  <style>
    @page{margin:16mm} body{font-family:Georgia,serif;padding:28px;color:#111;margin:0;line-height:1.45}
    h1{margin:0 0 6px;font-size:20px} .muted{color:#555;font-size:13px}
    table{width:100%;border-collapse:collapse;margin-top:16px}
    th{text-align:left;padding:8px;border-bottom:2px solid #111;font-size:12px}
    .sigs{display:grid;grid-template-columns:1fr 1fr;gap:28px;margin-top:48px}
    .sig{border-top:1px solid #333;padding-top:8px;min-height:72px;font-size:13px}
  </style></head><body>
  <h1>État des lieux — prise de service</h1>
  <p class="muted">${escapeHtml(input.branchName)} · ${escapeHtml(input.number)}</p>
  <p class="muted">Ouverture : ${formatWhen(input.openedAt)}</p>
  <p><strong>Entrant :</strong> ${escapeHtml(input.vendorDisplayName)}</p>
  <p><strong>Manager :</strong> ${escapeHtml(input.managerName)}</p>
  ${input.updatedNote ? `<p class="muted">${escapeHtml(input.updatedNote)}</p>` : ""}
  <table>
    <thead><tr>
      <th>Produit</th><th>Zone</th>
      <th style="text-align:right">Qté attribuée</th>
      <th style="text-align:right">Qté confirmée</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <p style="margin-top:20px;font-size:13px">Je soussigné(e) <strong>${escapeHtml(input.vendorDisplayName)}</strong>, reconnais avoir pris en charge le stock ci-dessus pour le service.</p>
  <div class="sigs">
    <div class="sig"><b>Entrant</b><span>Nom &amp; signature</span></div>
    <div class="sig"><b>Manager</b><span>Nom &amp; signature</span></div>
  </div>
  </body></html>`;
}

export function buildServiceStockClosingHtml(input: {
  branchName: string;
  number: string;
  vendorDisplayName: string;
  managerName: string;
  openedAt: string | Date;
  closedAt: string | Date;
  lines: ServiceStockDocLine[];
  formatMoney: (n: number) => string;
}) {
  const salesRows = input.lines
    .filter((l) => (l.qtySold ?? 0) > 0)
    .map((l) => {
      const sold = l.qtySold ?? 0;
      const total = sold * l.unitPriceUsd;
      return `<tr>
        <td style="padding:8px;border-bottom:1px solid #ddd">${escapeHtml(l.name)}</td>
        <td style="padding:8px;border-bottom:1px solid #ddd;text-align:right">${input.formatMoney(l.unitPriceUsd)}</td>
        <td style="padding:8px;border-bottom:1px solid #ddd;text-align:right">${sold}</td>
        <td style="padding:8px;border-bottom:1px solid #ddd;text-align:right">${input.formatMoney(total)}</td>
      </tr>`;
    })
    .join("");

  const ca = input.lines.reduce(
    (s, l) => s + (l.qtySold ?? 0) * l.unitPriceUsd,
    0,
  );

  const stockRows = input.lines
    .map((l) => {
      const theo =
        l.qtyAttributed - (l.qtySold ?? 0) - (l.qtyLoss ?? 0);
      const counted = l.qtyClosingCounted ?? 0;
      const ecart = counted - theo;
      return `<tr>
        <td style="padding:8px;border-bottom:1px solid #ddd">${escapeHtml(l.name)}</td>
        <td style="padding:8px;border-bottom:1px solid #ddd;text-align:right">${l.qtyAttributed}</td>
        <td style="padding:8px;border-bottom:1px solid #ddd;text-align:right">${l.qtySold ?? 0}</td>
        <td style="padding:8px;border-bottom:1px solid #ddd;text-align:right">${counted}</td>
        <td style="padding:8px;border-bottom:1px solid #ddd;text-align:right">${l.qtyReturnedToDepot ?? 0}</td>
        <td style="padding:8px;border-bottom:1px solid #ddd;text-align:right">${l.qtyLoss ?? 0}</td>
        <td style="padding:8px;border-bottom:1px solid #ddd;text-align:right">${ecart}</td>
      </tr>`;
    })
    .join("");

  return `<!doctype html><html><head><meta charset="utf-8"/><title>${escapeHtml(input.number)} — Fermeture</title>
  <style>
    @page{margin:16mm} body{font-family:Georgia,serif;padding:28px;color:#111;margin:0;line-height:1.45}
    h1{margin:0 0 6px;font-size:20px} h2{margin:24px 0 8px;font-size:16px}
    .muted{color:#555;font-size:13px} table{width:100%;border-collapse:collapse;margin-top:12px}
    th{text-align:left;padding:8px;border-bottom:2px solid #111;font-size:12px}
    .sigs{display:grid;grid-template-columns:1fr 1fr;gap:28px;margin-top:48px}
    .sig{border-top:1px solid #333;padding-top:8px;min-height:72px;font-size:13px}
    .total{font-size:18px;font-weight:700;margin-top:12px}
  </style></head><body>
  <h1>Rapport de clôture — fin de service</h1>
  <p class="muted">${escapeHtml(input.branchName)} · ${escapeHtml(input.number)}</p>
  <p class="muted">Ouverture ${formatWhen(input.openedAt)} · Fermeture ${formatWhen(input.closedAt)}</p>
  <p><strong>Entrant :</strong> ${escapeHtml(input.vendorDisplayName)}</p>
  <p><strong>Manager clôture :</strong> ${escapeHtml(input.managerName)}</p>
  <p class="total">Montant vendu : ${input.formatMoney(ca)}</p>
  <h2>Détail des ventes</h2>
  <table>
    <thead><tr>
      <th>Produit</th><th style="text-align:right">P.U.</th>
      <th style="text-align:right">Qté</th><th style="text-align:right">Total</th>
    </tr></thead>
    <tbody>${salesRows || `<tr><td colspan="4" style="padding:8px" class="muted">Aucune vente</td></tr>`}</tbody>
  </table>
  <h2>État du stock attribué</h2>
  <table>
    <thead><tr>
      <th>Produit</th>
      <th style="text-align:right">Attribué</th>
      <th style="text-align:right">Vendu</th>
      <th style="text-align:right">Restant compté</th>
      <th style="text-align:right">Retour dépôt</th>
      <th style="text-align:right">Pertes</th>
      <th style="text-align:right">Écart</th>
    </tr></thead>
    <tbody>${stockRows}</tbody>
  </table>
  <p style="margin-top:16px;font-size:13px" class="muted">Document de responsabilité — à conserver après signature.</p>
  <div class="sigs">
    <div class="sig"><b>Entrant</b><span>${escapeHtml(input.vendorDisplayName)} — signature</span></div>
    <div class="sig"><b>Manager</b><span>${escapeHtml(input.managerName)} — signature</span></div>
  </div>
  </body></html>`;
}
