import type { StayGroupInvoice } from "@/lib/hotel/stay-group-invoice";

function esc(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function money(n: number) {
  return `${n.toFixed(2)} $`;
}

function fmtDate(d: Date | null) {
  if (!d) return "—";
  return d.toISOString().slice(0, 10);
}

export function renderStayGroupInvoiceHtml(
  invoice: StayGroupInvoice,
  opts: { issuerName: string; issuerRole: string; hotelName?: string },
): string {
  const title = invoice.isProforma ? "PROFORMA — Facture dossier" : "Facture dossier";
  const billed =
    invoice.billedTo.kind === "partner"
      ? [
          esc(invoice.billedTo.name),
          [invoice.billedTo.address, invoice.billedTo.city]
            .filter((x): x is string => Boolean(x))
            .map(esc)
            .join(", "),
          invoice.billedTo.taxId
            ? `NIF / ID fiscal : ${esc(invoice.billedTo.taxId)}`
            : "",
          [invoice.billedTo.phone, invoice.billedTo.email]
            .filter((x): x is string => Boolean(x))
            .map(esc)
            .join(" · "),
        ]
          .filter(Boolean)
          .join("<br/>")
      : [
          esc(invoice.billedTo.name),
          [invoice.billedTo.phone, invoice.billedTo.email]
            .filter((x): x is string => Boolean(x))
            .map(esc)
            .join(" · "),
        ]
          .filter(Boolean)
          .join("<br/>");

  const rows = invoice.lines
    .map(
      (l, i) => `
    <tr${l.cancelled ? ' style="color:#888;text-decoration:line-through"' : ""}>
      <td>${i + 1}</td>
      <td>${esc(l.roomNumber)} ${esc(l.roomTypeName)}${l.cancelled ? " · annulée" : ""}</td>
      <td>${esc(l.guestName)}</td>
      <td>${esc(l.description)}</td>
      <td class="num">${money(l.unitPrice)}</td>
      <td class="num">${l.quantity}</td>
      <td class="num">${money(l.amount)}</td>
    </tr>`,
    )
    .join("");

  const balanceLabel =
    invoice.refundDue > 0.01
      ? "À REMBOURSER"
      : invoice.dueFromClient > 0.01
        ? "SOLDE À PAYER"
        : "Solde";
  const balanceValue =
    invoice.refundDue > 0.01
      ? money(invoice.refundDue)
      : money(Math.max(0, invoice.balance));

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8"/>
<title>${esc(title)} ${esc(invoice.code)}</title>
<style>
  body { font-family: Georgia, "Times New Roman", serif; color: #1a1a1a; margin: 24px; font-size: 13px; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .muted { color: #555; font-size: 12px; }
  .badge { display: inline-block; padding: 2px 8px; border: 1px solid #999; font-size: 11px; letter-spacing: 0.04em; }
  .warn { border-color: #b45309; color: #b45309; }
  .ok { border-color: #047857; color: #047857; }
  table { width: 100%; border-collapse: collapse; margin-top: 16px; }
  th, td { border-bottom: 1px solid #ddd; padding: 6px 4px; text-align: left; vertical-align: top; }
  th { font-size: 11px; text-transform: uppercase; letter-spacing: 0.03em; color: #444; }
  .num { text-align: right; white-space: nowrap; }
  .totals { margin-top: 16px; width: 300px; margin-left: auto; }
  .totals td { border: none; padding: 3px 0; }
  .totals .grand { font-weight: bold; font-size: 15px; border-top: 1px solid #222; padding-top: 8px; }
  .sigs { display: flex; gap: 48px; margin-top: 48px; }
  .sig { flex: 1; border-top: 1px solid #333; padding-top: 8px; min-height: 64px; }
  @media print { body { margin: 12mm; } .no-print { display: none; } }
</style>
</head>
<body>
  <button class="no-print" onclick="window.print()" style="margin-bottom:12px">Imprimer</button>
  <div class="muted">${esc(opts.hotelName ?? "Hôtel")}</div>
  <h1>${esc(title)}</h1>
  <p>
    <strong>${esc(invoice.code)}</strong>
    ${invoice.invoiceNumber ? ` · ${esc(invoice.invoiceNumber)}` : ""}
    ${invoice.isProforma ? ' · <span class="badge">PROFORMA</span>' : ""}
    ${
      invoice.refundDue > 0.01
        ? ' · <span class="badge warn">REMBOURSEMENT DÛ</span>'
        : invoice.dueFromClient > 0.01
          ? ' · <span class="badge warn">COMPLÉMENT DÛ</span>'
          : ' · <span class="badge ok">SOLDÉ</span>'
    }
  </p>
  <p class="muted">
    Séjour ${fmtDate(invoice.checkInDate)} → ${fmtDate(invoice.checkOutDate)}
    · ${invoice.stayCount} chambre(s) active(s)
    ${
      invoice.cancelledStayCount > 0
        ? ` · ${invoice.cancelledStayCount} annulée(s)`
        : ""
    }
    · ${esc(invoice.payTiming)}
  </p>
  <p><strong>Facturé à</strong><br/>${billed}</p>
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Chambre</th>
        <th>Occupant</th>
        <th>Désignation</th>
        <th class="num">P.U.</th>
        <th class="num">Qté</th>
        <th class="num">Montant</th>
      </tr>
    </thead>
    <tbody>${rows || `<tr><td colspan="7">Aucune ligne</td></tr>`}</tbody>
  </table>
  <table class="totals">
    <tr><td>Sous-total hébergement</td><td class="num">${money(invoice.subtotalStay)}</td></tr>
    <tr><td>Sous-total consommations</td><td class="num">${money(invoice.subtotalConsumption)}</td></tr>
    <tr><td>Autres</td><td class="num">${money(invoice.subtotalOther)}</td></tr>
    <tr><td>Total charges (conso réelle)</td><td class="num">${money(invoice.charges)}</td></tr>
    <tr><td>Déjà réglé (net)</td><td class="num">− ${money(invoice.paid)}</td></tr>
    <tr class="grand"><td>${balanceLabel}</td><td class="num">${balanceValue}</td></tr>
  </table>
  ${
    invoice.refundDue > 0.01
      ? `<p class="muted">Trop-perçu après annulation / conso inférieure à la réservation prépayée. Rembourser ${money(invoice.refundDue)}.</p>`
      : invoice.dueFromClient > 0.01
        ? `<p class="muted">Consommation / chambres restantes supérieure au montant déjà encaissé. Encaisser un complément de ${money(invoice.dueFromClient)}.</p>`
        : ""
  }
  <div class="sigs">
    <div class="sig">
      <div><strong>${esc(opts.issuerRole)}</strong></div>
      <div class="muted">${esc(opts.issuerName)}</div>
      <div class="muted">Signature · date</div>
    </div>
    <div class="sig">
      <div><strong>${
        invoice.billedTo.kind === "partner"
          ? "Remise société / accusé"
          : "Remise booker / accusé"
      }</strong></div>
      <div class="muted">${
        invoice.refundDue > 0.01
          ? "Accusé réception du remboursement"
          : "Cachet · signature"
      }</div>
    </div>
  </div>
</body>
</html>`;
}
