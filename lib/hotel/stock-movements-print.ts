function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export type StockMovePrintRow = {
  kind: string;
  quantity: number;
  stockBefore?: number | null;
  stockAfter?: number | null;
  note: string | null;
  createdAt: string | Date;
  menuItem: {
    name: string;
    stockQty?: number | null;
    supplierName?: string | null;
    provenance?: string | null;
  };
};

export type BranchPrintInfo = {
  name: string;
  imageUrl?: string | null;
  address?: string | null;
  city?: string | null;
  phone?: string | null;
  email?: string | null;
};

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

function formatDay(isoDate: string) {
  const [y, m, d] = isoDate.slice(0, 10).split("-").map(Number);
  const date = new Date(Date.UTC(y!, (m ?? 1) - 1, d ?? 1));
  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function resolveStocks(r: StockMovePrintRow) {
  const qty = r.quantity;
  const entree = r.kind === "ENTREE";
  // 0/0 avec qté > 0 = anciennes lignes non renseignées (défaut Prisma)
  const rawBefore = typeof r.stockBefore === "number" ? r.stockBefore : null;
  const rawAfter = typeof r.stockAfter === "number" ? r.stockAfter : null;
  const missingBothZero =
    rawBefore === 0 && rawAfter === 0 && qty > 0;

  let before = missingBothZero ? null : rawBefore;
  let after = missingBothZero ? null : rawAfter;

  if (before == null && after != null) {
    before = entree ? after - qty : after + qty;
  }
  if (after == null && before != null) {
    after = entree ? before + qty : before - qty;
  }
  if (
    (before == null || after == null) &&
    typeof r.menuItem.stockQty === "number"
  ) {
    after = r.menuItem.stockQty;
    before = entree ? after - qty : after + qty;
  }
  return {
    before: before != null ? Math.max(0, before) : null,
    after: after != null ? Math.max(0, after) : null,
  };
}

function formatAddress(branch: BranchPrintInfo) {
  return [branch.address, branch.city].filter(Boolean).join(", ");
}

/** HTML imprimable / enregistrable en PDF (entrées & sorties consommables). */
export function buildStockMovementsPrintDocument(input: {
  branch: BranchPrintInfo;
  from: string;
  to: string;
  kindLabel: string;
  rows: StockMovePrintRow[];
}): string {
  const entrees = input.rows.filter((r) => r.kind === "ENTREE");
  const sorties = input.rows.filter((r) => r.kind === "SORTIE");
  const sumIn = entrees.reduce((s, r) => s + r.quantity, 0);
  const sumOut = sorties.reduce((s, r) => s + r.quantity, 0);
  const addressLine = formatAddress(input.branch);

  const logo = input.branch.imageUrl
    ? `<img class="logo" src="${escapeHtml(input.branch.imageUrl)}" alt="" />`
    : `<div class="logo-fallback">${escapeHtml(input.branch.name.slice(0, 1).toUpperCase())}</div>`;

  const bodyRows = input.rows
    .map((r) => {
      const entree = r.kind === "ENTREE";
      const { before, after } = resolveStocks(r);
      const supplier = [r.menuItem.supplierName, r.menuItem.provenance]
        .filter(Boolean)
        .join(" · ");
      return `<tr>
  <td>${escapeHtml(formatWhen(r.createdAt))}</td>
  <td>${escapeHtml(entree ? "Entrée" : "Sortie")}</td>
  <td>${escapeHtml(r.menuItem.name)}${supplier ? `<div class="muted">${escapeHtml(supplier)}</div>` : ""}</td>
  <td class="num">${before != null ? before : "—"}</td>
  <td class="num">${entree ? "+" : "−"}${r.quantity}</td>
  <td class="num">${after != null ? after : "—"}</td>
  <td>${escapeHtml(r.note ?? "—")}</td>
</tr>`;
    })
    .join("\n");

  const footerBits = [
    addressLine,
    input.branch.phone ? `Tél. ${input.branch.phone}` : null,
    input.branch.email,
  ].filter(Boolean);

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<title>Mouvements stock — ${escapeHtml(input.branch.name)}</title>
<style>
  @page { margin: 12mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: ui-sans-serif, system-ui, sans-serif;
    color: #111;
    background: #fff;
    font-size: 13px;
    line-height: 1.4;
  }
  .sheet { max-width: 960px; margin: 0 auto; padding: 20px; }
  .header {
    display: flex;
    gap: 16px;
    align-items: center;
    border-bottom: 1px solid #e5e5e5;
    padding-bottom: 14px;
    margin-bottom: 14px;
  }
  .logo {
    height: 56px;
    width: auto;
    max-width: 140px;
    object-fit: contain;
  }
  .logo-fallback {
    height: 56px;
    width: 56px;
    border-radius: 12px;
    background: #0f172a;
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 22px;
    font-weight: 700;
  }
  h1 { font-size: 18px; margin: 0 0 4px; }
  .muted { color: #525252; font-size: 12px; }
  .meta { margin: 0 0 16px; display: grid; gap: 4px; }
  .stats { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 16px; }
  .stat {
    border: 1px solid #e5e5e5;
    border-radius: 10px;
    padding: 10px 14px;
    min-width: 110px;
  }
  .stat strong { display: block; font-size: 18px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border-bottom: 1px solid #e5e5e5; padding: 8px 6px; text-align: left; vertical-align: top; }
  th { font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em; color: #737373; }
  .num { text-align: right; font-variant-numeric: tabular-nums; font-weight: 600; white-space: nowrap; }
  footer {
    margin-top: 22px;
    padding-top: 12px;
    border-top: 1px solid #e5e5e5;
    color: #525252;
    font-size: 11px;
    text-align: center;
    line-height: 1.5;
  }
</style>
</head>
<body>
  <div class="sheet">
    <div class="header">
      ${logo}
      <div>
        <h1>${escapeHtml(input.branch.name)}</h1>
        <div class="muted">Mouvements de stock — consommables</div>
        ${addressLine ? `<div class="muted">${escapeHtml(addressLine)}</div>` : ""}
      </div>
    </div>
    <div class="meta">
      <div><strong>Période :</strong> ${escapeHtml(formatDay(input.from))} → ${escapeHtml(formatDay(input.to))}</div>
      <div><strong>Filtre :</strong> ${escapeHtml(input.kindLabel)}</div>
      <div><strong>Généré le :</strong> ${escapeHtml(new Date().toLocaleString("fr-FR"))}</div>
    </div>
    <div class="stats">
      <div class="stat"><span class="muted">Entrées</span><strong>+${sumIn}</strong><span class="muted">${entrees.length} ligne(s)</span></div>
      <div class="stat"><span class="muted">Sorties</span><strong>−${sumOut}</strong><span class="muted">${sorties.length} ligne(s)</span></div>
      <div class="stat"><span class="muted">Lignes</span><strong>${input.rows.length}</strong></div>
    </div>
    ${
      input.rows.length === 0
        ? `<p class="muted">Aucun mouvement sur cette période.</p>`
        : `<table>
  <thead>
    <tr>
      <th>Date</th>
      <th>Type</th>
      <th>Produit</th>
      <th class="num">Stock</th>
      <th class="num">Qté</th>
      <th class="num">Reste</th>
      <th>Note</th>
    </tr>
  </thead>
  <tbody>
${bodyRows}
  </tbody>
</table>`
    }
    <footer>
      <div><strong>${escapeHtml(input.branch.name)}</strong></div>
      ${footerBits.length ? `<div>${escapeHtml(footerBits.join(" · "))}</div>` : `<div class="muted">Coordonnées non renseignées</div>`}
      <div style="margin-top:6px">Document Livraison — Imprimer / Enregistrer en PDF</div>
    </footer>
  </div>
</body>
</html>`;
}

export type StockMovementsPrintInput = {
  branch: BranchPrintInfo;
  from: string;
  to: string;
  kindLabel: string;
  rows: StockMovePrintRow[];
};

/** Ouvre l’aperçu d’impression (fenêtre déjà créée, ou nouvelle). */
export function writeStockMovementsPrintDocument(
  win: Window,
  input: StockMovementsPrintInput,
) {
  const html = buildStockMovementsPrintDocument(input);
  win.document.open();
  win.document.write(html);
  win.document.close();
  const trigger = () => {
    try {
      win.focus();
      win.print();
    } catch {
      /* ignore */
    }
  };
  setTimeout(trigger, 250);
}

/**
 * Ouvre une fenêtre synchrone (à appeler dans le clic utilisateur),
 * puis y injecte le document après chargement des données.
 */
export function openBlankPrintWindow(): Window | null {
  const win = window.open("about:blank", "_blank", "width=920,height=960");
  if (!win) return null;
  try {
    win.document.open();
    win.document.write(
      `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Préparation PDF…</title></head><body style="font-family:sans-serif;padding:24px;color:#525252">Préparation du document PDF…</body></html>`,
    );
    win.document.close();
  } catch {
    /* ignore */
  }
  return win;
}

export function openStockMovementsPrintPreview(
  input: StockMovementsPrintInput,
): boolean {
  const win = openBlankPrintWindow();
  if (!win) return false;
  writeStockMovementsPrintDocument(win, input);
  return true;
}

/** Télécharge un HTML imprimable si les pop-ups sont bloquées. */
export function downloadStockMovementsHtml(
  input: StockMovementsPrintInput,
  filename = "mouvements-stock.html",
) {
  const html = buildStockMovementsPrintDocument(input);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
