/** Rapport journalier / shift caissier — HTML imprimable. */

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

export function isNonSalesPaymentNote(note: string | null | undefined) {
  const n = (note ?? "").toLowerCase();
  return (
    n.includes("caution consommation") || n.startsWith("remboursement caution")
  );
}

export type CashierReportPayment = {
  id: string;
  receiptNumber: string;
  method: string;
  amountCdf: number;
  amountForeign: number | null;
  paidAt: string | Date;
  note: string | null;
  folioLabel: string | null;
  roomNumber: string | null;
  guestName: string | null;
  orderLabel: string | null;
  orderItems: { name: string; quantity: number; amount: number }[];
};

export type CashierReportLine = {
  name: string;
  quantity: number;
  amountUsd: number;
};

export type CashierShiftReport = {
  branchName: string;
  cashierName: string;
  openedAt: string | Date;
  closedAt: string | Date;
  openingFloat: number;
  payments: CashierReportPayment[];
  rooms: { guestName: string; roomNumber: string; receipts: string; amountUsd: number }[];
  fnbTickets: { label: string; items: string; amountUsd: number }[];
  products: CashierReportLine[];
  leftoverNotes: { label: string; balanceUsd: number }[];
  leftoverFnb: { label: string; amountUsd: number }[];
  formatMoney: (n: number) => string;
};

function paymentUsd(
  p: Pick<CashierReportPayment, "amountCdf" | "amountForeign">,
  cdfPerUsd: number | null,
) {
  if (p.amountForeign != null && p.amountForeign !== 0) return p.amountForeign;
  if (cdfPerUsd && cdfPerUsd > 0) return p.amountCdf / cdfPerUsd;
  return p.amountCdf;
}

export function buildCashierShiftReportHtml(
  input: CashierShiftReport & { cdfPerUsd?: number | null },
) {
  const sales = input.payments.filter((p) => !isNonSalesPaymentNote(p.note));
  const other = input.payments.filter((p) => isNonSalesPaymentNote(p.note));
  const caUsd = sales.reduce(
    (s, p) => s + paymentUsd(p, input.cdfPerUsd ?? null),
    0,
  );
  const byMethod = new Map<string, number>();
  for (const p of sales) {
    const m = p.method || "CASH";
    byMethod.set(m, (byMethod.get(m) ?? 0) + paymentUsd(p, input.cdfPerUsd ?? null));
  }
  const methodRows = [...byMethod.entries()]
    .map(
      ([method, amount]) =>
        `<tr><td style="padding:8px;border-bottom:1px solid #ddd">${escapeHtml(method)}</td><td style="padding:8px;border-bottom:1px solid #ddd;text-align:right">${escapeHtml(input.formatMoney(amount))}</td></tr>`,
    )
    .join("");

  const paymentRows = input.payments
    .map((p) => {
      const who =
        p.guestName && p.roomNumber
          ? `${p.guestName} · ch. ${p.roomNumber}`
          : p.folioLabel || p.orderLabel || p.note || "—";
      return `<tr>
        <td style="padding:8px;border-bottom:1px solid #ddd">${escapeHtml(p.receiptNumber)}</td>
        <td style="padding:8px;border-bottom:1px solid #ddd">${formatWhen(p.paidAt)}</td>
        <td style="padding:8px;border-bottom:1px solid #ddd">${escapeHtml(who)}</td>
        <td style="padding:8px;border-bottom:1px solid #ddd">${escapeHtml(p.method)}</td>
        <td style="padding:8px;border-bottom:1px solid #ddd;text-align:right">${escapeHtml(input.formatMoney(paymentUsd(p, input.cdfPerUsd ?? null)))}</td>
      </tr>`;
    })
    .join("");

  const roomRows = input.rooms
    .map(
      (r) =>
        `<tr><td style="padding:8px;border-bottom:1px solid #ddd">${escapeHtml(r.guestName)}</td><td style="padding:8px;border-bottom:1px solid #ddd">${escapeHtml(r.roomNumber)}</td><td style="padding:8px;border-bottom:1px solid #ddd">${escapeHtml(r.receipts)}</td><td style="padding:8px;border-bottom:1px solid #ddd;text-align:right">${escapeHtml(input.formatMoney(r.amountUsd))}</td></tr>`,
    )
    .join("");

  const fnbRows = input.fnbTickets
    .map(
      (t) =>
        `<tr><td style="padding:8px;border-bottom:1px solid #ddd">${escapeHtml(t.label)}</td><td style="padding:8px;border-bottom:1px solid #ddd">${escapeHtml(t.items)}</td><td style="padding:8px;border-bottom:1px solid #ddd;text-align:right">${escapeHtml(input.formatMoney(t.amountUsd))}</td></tr>`,
    )
    .join("");

  const productRows = input.products
    .map(
      (l) =>
        `<tr><td style="padding:8px;border-bottom:1px solid #ddd">${escapeHtml(l.name)}</td><td style="padding:8px;border-bottom:1px solid #ddd;text-align:right">${l.quantity}</td><td style="padding:8px;border-bottom:1px solid #ddd;text-align:right">${escapeHtml(input.formatMoney(l.amountUsd))}</td></tr>`,
    )
    .join("");

  const leftoverNoteRows = input.leftoverNotes
    .map(
      (n) =>
        `<tr><td style="padding:8px;border-bottom:1px solid #ddd">${escapeHtml(n.label)}</td><td style="padding:8px;border-bottom:1px solid #ddd;text-align:right">${escapeHtml(input.formatMoney(n.balanceUsd))}</td></tr>`,
    )
    .join("");

  const leftoverFnbRows = input.leftoverFnb
    .map(
      (n) =>
        `<tr><td style="padding:8px;border-bottom:1px solid #ddd">${escapeHtml(n.label)}</td><td style="padding:8px;border-bottom:1px solid #ddd;text-align:right">${escapeHtml(input.formatMoney(n.amountUsd))}</td></tr>`,
    )
    .join("");

  const otherNote =
    other.length > 0
      ? `<p class="muted">${other.length} mouvement(s) caution / hors CA ventes (inclus dans le détail des paiements).</p>`
      : "";

  return `<!doctype html><html><head><meta charset="utf-8"/><title>Rapport caisse — ${escapeHtml(input.cashierName)}</title>
  <style>
    @page{margin:16mm} body{font-family:Georgia,serif;padding:28px;color:#111;margin:0;line-height:1.45}
    h1{margin:0 0 6px;font-size:20px} h2{margin:24px 0 8px;font-size:16px}
    .muted{color:#555;font-size:13px} table{width:100%;border-collapse:collapse;margin-top:12px}
    th{text-align:left;padding:8px;border-bottom:2px solid #111;font-size:12px}
    .grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-top:14px}
    .box{border:1px solid #222;padding:12px 14px}
    .k{font-size:12px;color:#555;text-transform:uppercase;letter-spacing:.03em}
    .v{font-size:18px;font-weight:700;margin-top:4px}
    .sign{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:36px}
    .line{border-top:1px solid #111;margin-top:48px;padding-top:6px;font-size:13px}
  </style></head><body>
  <h1>${escapeHtml(input.branchName)} — Rapport journalier caisse</h1>
  <p class="muted">Caissier : <strong>${escapeHtml(input.cashierName)}</strong><br/>
  Ouverture ${formatWhen(input.openedAt)} · Clôture ${formatWhen(input.closedAt)}<br/>
  Fond d’ouverture : ${escapeHtml(input.formatMoney(input.openingFloat))}</p>
  <div class="grid">
    <div class="box"><div class="k">CA de la session</div><div class="v">${escapeHtml(input.formatMoney(caUsd))}</div></div>
    <div class="box"><div class="k">Notes chambre</div><div class="v">${input.rooms.length}</div></div>
    <div class="box"><div class="k">Tickets F&amp;B</div><div class="v">${input.fnbTickets.length}</div></div>
  </div>
  ${otherNote}
  <h2>Par moyen de paiement</h2>
  <table><thead><tr><th>Moyen</th><th style="text-align:right">Montant</th></tr></thead><tbody>
  ${methodRows || `<tr><td colspan="2" style="padding:8px">Aucun encaissement ventes</td></tr>`}
  </tbody></table>
  <h2>Paiements (tous mouvements de cette session)</h2>
  <table><thead><tr><th>Reçu</th><th>Heure</th><th>Libellé</th><th>Moyen</th><th style="text-align:right">Montant</th></tr></thead><tbody>
  ${paymentRows || `<tr><td colspan="5" style="padding:8px">Aucun paiement</td></tr>`}
  </tbody></table>
  <h2>Chambres / notes encaissées</h2>
  <table><thead><tr><th>Client</th><th>Chambre</th><th>Reçus</th><th style="text-align:right">Montant</th></tr></thead><tbody>
  ${roomRows || `<tr><td colspan="4" style="padding:8px">Aucune note chambre</td></tr>`}
  </tbody></table>
  <h2>Restauration F&amp;B encaissée</h2>
  <table><thead><tr><th>Ticket</th><th>Articles</th><th style="text-align:right">Montant</th></tr></thead><tbody>
  ${fnbRows || `<tr><td colspan="3" style="padding:8px">Aucun ticket F&amp;B</td></tr>`}
  </tbody></table>
  <h2>Détail articles vendus</h2>
  <table><thead><tr><th>Article</th><th style="text-align:right">Qté</th><th style="text-align:right">Montant</th></tr></thead><tbody>
  ${productRows || `<tr><td colspan="3" style="padding:8px">Aucun article</td></tr>`}
  </tbody></table>
  ${
    leftoverNoteRows || leftoverFnbRows
      ? `<h2>Non encaissé à la clôture (votre session)</h2>
  ${
    leftoverNoteRows
      ? `<h3 style="font-size:14px;margin:12px 0 0">Notes chambre</h3><table><thead><tr><th>Note</th><th style="text-align:right">Solde</th></tr></thead><tbody>${leftoverNoteRows}</tbody></table>`
      : ""
  }
  ${
    leftoverFnbRows
      ? `<h3 style="font-size:14px;margin:12px 0 0">F&amp;B prêts</h3><table><thead><tr><th>Ticket</th><th style="text-align:right">Montant</th></tr></thead><tbody>${leftoverFnbRows}</tbody></table>`
      : ""
  }`
      : ""
  }
  <div class="sign">
    <div class="line">Signature caissier<br/>${escapeHtml(input.cashierName)}</div>
    <div class="line">Visa gérant / manager</div>
  </div>
  </body></html>`;
}
