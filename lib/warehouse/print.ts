function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export type WarehouseSlipDocKind = "envoi" | "reception";

export function buildWarehouseSlipHtml(input: {
  branchName: string;
  number: string;
  kindLabel: string;
  destinationLabel: string;
  supplierName?: string | null;
  note?: string | null;
  validatedAt: string | Date;
  statusLabel?: string;
  managerName: string;
  recipientName: string;
  recipientSignature?: string | null;
  receivedAt?: string | Date | null;
  receiveNote?: string | null;
  /** Document d’envoi (stock → POS) ou document de réception signé. */
  docKind?: WarehouseSlipDocKind;
  slipKind?: "COMMANDE" | "SORTIE";
  lines: {
    name: string;
    productType: string;
    quantity: number;
    unitCostUsd: number;
    pickFrom?: string;
    putTo?: string;
  }[];
}) {
  const when = new Date(input.validatedAt).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const receivedWhen = input.receivedAt
    ? new Date(input.receivedAt).toLocaleString("fr-FR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;
  const rows = input.lines
    .map(
      (l) => `<tr>
      <td style="padding:8px;border-bottom:1px solid #d8dee6">${escapeHtml(l.name)}</td>
      <td style="padding:8px;border-bottom:1px solid #d8dee6">${escapeHtml(l.productType)}</td>
      <td style="padding:8px;border-bottom:1px solid #d8dee6;font-size:12px">${escapeHtml(l.pickFrom ?? "—")}</td>
      <td style="padding:8px;border-bottom:1px solid #d8dee6;font-size:12px">${escapeHtml(l.putTo ?? "—")}</td>
      <td style="padding:8px;border-bottom:1px solid #d8dee6;text-align:right">${l.quantity}</td>
      <td style="padding:8px;border-bottom:1px solid #d8dee6;text-align:right">${l.unitCostUsd.toFixed(2)}</td>
      <td style="padding:8px;border-bottom:1px solid #d8dee6;text-align:right">${(l.quantity * l.unitCostUsd).toFixed(2)}</td>
    </tr>`,
    )
    .join("");
  const total = input.lines.reduce(
    (s, l) => s + l.quantity * l.unitCostUsd,
    0,
  );
  const statusBadge = input.statusLabel
    ? `<span style="margin-left:8px;padding:3px 8px;border-radius:999px;background:#ecfdf5;color:#14532d;font-size:11px;font-weight:700">${escapeHtml(input.statusLabel)}</span>`
    : "";
  const isReception = input.docKind === "reception";
  const isCommande = input.slipKind === "COMMANDE";
  const docTitle = isReception
    ? "Document de réception"
    : isCommande
      ? "Bon de commande"
      : "Document d’envoi";
  const docBadge = isReception
    ? "Réception POS"
    : isCommande
      ? "Entrée fournisseur"
      : "Envoi stock principal → POS";

  return `<!doctype html><html><head><meta charset="utf-8"/><title>${escapeHtml(docTitle)} ${escapeHtml(input.number)}</title>
  <style>
    @page{margin:12mm}
    body{font-family:Georgia,"Times New Roman",serif;color:#0f172a;margin:0;padding:24px;line-height:1.45;background:#fff}
    h1{margin:0 0 4px;font-size:22px;letter-spacing:-0.02em}
    .muted{color:#64748b;font-size:13px}
    .badge{display:inline-block;padding:4px 10px;border-radius:999px;background:#14532d;color:#fff;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase}
    table{width:100%;border-collapse:collapse;margin-top:18px;font-size:12px}
    th{text-align:left;padding:8px;border-bottom:2px solid #14532d;font-size:10px;letter-spacing:0.06em;text-transform:uppercase;color:#14532d}
    .sig{display:grid;grid-template-columns:1fr 1fr;gap:28px;margin-top:48px}
    .sigbox{border-top:1px solid #94a3b8;padding-top:10px;min-height:90px}
    .sigline{margin-top:48px;border-bottom:1px solid #cbd5e1;height:1px}
  </style></head><body>
  <div class="badge">${escapeHtml(docBadge)}</div>${statusBadge}
  <h1>${escapeHtml(docTitle)} · ${escapeHtml(input.number)}</h1>
  <p class="muted">${escapeHtml(input.kindLabel)} · ${escapeHtml(input.branchName)} · ${escapeHtml(when)}</p>
  <p style="margin-top:12px"><strong>Destination :</strong> ${escapeHtml(input.destinationLabel)}
  ${input.supplierName ? ` · <strong>Fournisseur :</strong> ${escapeHtml(input.supplierName)}` : ""}</p>
  ${input.note ? `<p class="muted">${escapeHtml(input.note)}</p>` : ""}
  <table>
    <thead><tr>
      <th>Produit</th><th>Type</th><th>Picking</th><th>Dépôt</th><th style="text-align:right">Qté</th><th style="text-align:right">P.U. USD</th><th style="text-align:right">Total</th>
    </tr></thead>
    <tbody>${rows}</tbody>
    <tfoot><tr>
      <td colspan="6" style="padding:10px 8px;text-align:right;font-weight:700">Total USD</td>
      <td style="padding:10px 8px;text-align:right;font-weight:700">${total.toFixed(2)}</td>
    </tr></tfoot>
  </table>
  ${
    receivedWhen
      ? `<p style="margin-top:16px;font-size:13px"><strong>Réception :</strong> ${escapeHtml(receivedWhen)}
        ${input.recipientSignature ? ` · Signé : <em>${escapeHtml(input.recipientSignature)}</em>` : ""}
        ${input.receiveNote ? `<br/><span class="muted">${escapeHtml(input.receiveNote)}</span>` : ""}
      </p>`
      : ""
  }
  <div class="sig">
    <div class="sigbox"><strong>Gestionnaire stock</strong><div class="sigline"></div><p class="muted">${escapeHtml(input.managerName)}</p></div>
    <div class="sigbox"><strong>Réceptionnaire</strong><div class="sigline"></div><p class="muted">${escapeHtml(input.recipientName)}</p></div>
  </div>
  </body></html>`;
}
