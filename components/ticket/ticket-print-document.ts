import {
  CATEGORIE_PASSAGER_LABELS,
  METHODE_PAIEMENT_LABELS,
  MODE_TRANSPORT_LABELS,
  formatDateTimeFr,
  formatMontantFc,
} from "@/lib/reservation/labels";
import type { TicketReservation } from "@/lib/reservation/ticket-data";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** Document HTML autonome pour impression navigateur / téléchargement. */
export function buildTicketPrintDocument(ticket: TicketReservation): string {
  const mode =
    MODE_TRANSPORT_LABELS[ticket.trajet.modeTransport] ??
    ticket.trajet.modeTransport;
  const logo = ticket.organization.logo
    ? `<img src="${escapeHtml(ticket.organization.logo)}" alt="" style="height:40px;width:auto;margin-bottom:4px;object-fit:contain" />`
    : "";

  const passagers = ticket.passagers
    .map((p) => {
      const isBebe = p.categorie === "BEBE" || !p.occupePlace;
      const cat = CATEGORIE_PASSAGER_LABELS[p.categorie] ?? p.categorie;
      return `<li class="passenger">
  <img src="${escapeHtml(p.qrDataUrl)}" alt="QR ${escapeHtml(p.codeUnique)}" width="96" height="96" />
  <div>
    <div class="name">${escapeHtml(`${p.prenom} ${p.nom}`)}</div>
    <div class="muted">${escapeHtml(cat)}${isBebe ? " · n’occupe pas de siège" : ""}</div>
    <div class="code">${escapeHtml(p.codeUnique)}</div>
    <div class="muted">${escapeHtml(formatMontantFc(p.prix))}</div>
  </div>
</li>`;
    })
    .join("\n");

  const paiementLine = ticket.paiement
    ? ` · ${escapeHtml(METHODE_PAIEMENT_LABELS[ticket.paiement.methode] ?? ticket.paiement.methode)}`
    : "";

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<title>Billet ${escapeHtml(ticket.codeUnique)}</title>
<style>
  @page { margin: 12mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: ui-sans-serif, system-ui, sans-serif;
    color: #111;
    background: #fff;
    font-size: 14px;
    line-height: 1.4;
  }
  .sheet { max-width: 720px; margin: 0 auto; padding: 24px; }
  header {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    border-bottom: 1px solid #d4d4d4;
    padding-bottom: 16px;
    margin-bottom: 20px;
  }
  h1 { font-size: 18px; margin: 0; }
  .muted { color: #525252; }
  .code { font-family: ui-monospace, monospace; font-size: 12px; margin-top: 4px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 24px; margin-bottom: 20px; }
  .label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; color: #737373; margin: 0 0 2px; }
  .value { font-size: 15px; font-weight: 600; margin: 0; }
  h2 { font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; color: #737373; margin: 0 0 10px; }
  ul { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 12px; }
  .passenger {
    display: flex;
    gap: 16px;
    align-items: center;
    border: 1px solid #e5e5e5;
    padding: 12px;
  }
  .passenger img { flex-shrink: 0; background: #fff; }
  .name { font-weight: 600; }
  footer {
    border-top: 1px solid #d4d4d4;
    margin-top: 20px;
    padding-top: 12px;
    font-size: 12px;
    color: #737373;
  }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .no-print { display: none !important; }
  }
</style>
</head>
<body>
  <div class="sheet">
    <header>
      <div>
        ${logo}
        <h1>${escapeHtml(ticket.organization.name)}</h1>
        <p class="muted">Billet de voyage · ${escapeHtml(mode)}</p>
      </div>
      <div style="text-align:right">
        <p class="label">Réservation</p>
        <p class="code" style="font-size:15px;font-weight:600">${escapeHtml(ticket.codeUnique)}</p>
      </div>
    </header>
    <div class="grid">
      <div>
        <p class="label">Trajet</p>
        <p class="value">${escapeHtml(ticket.trajet.villeDepart)} → ${escapeHtml(ticket.trajet.villeArrivee)}</p>
      </div>
      <div>
        <p class="label">Départ</p>
        <p class="value">${escapeHtml(formatDateTimeFr(ticket.dateDepart, ticket.heureDepart))}</p>
      </div>
      <div>
        <p class="label">Client</p>
        <p class="value">${escapeHtml(ticket.client.displayName)}</p>
        <p class="muted">${escapeHtml(ticket.client.telephone)}</p>
      </div>
      <div>
        <p class="label">Montant</p>
        <p class="value">${escapeHtml(formatMontantFc(ticket.prixTotal))}</p>
        <p class="muted">Billets ${escapeHtml(formatMontantFc(ticket.prixBillet))}${paiementLine}</p>
      </div>
    </div>
    ${
      ticket.passagers.length
        ? `<h2>Passagers</h2><ul>${passagers}</ul>`
        : ""
    }
    <footer>
      Présentez ce billet à l’embarquement. Chaque passager a son propre QR.
      Réimpression autorisée — ne crée pas une nouvelle réservation.
    </footer>
  </div>
</body>
</html>`;
}

/** Ouvre une fenêtre d’impression navigateur (sans chrome app). */
export function openTicketPrintPreview(ticket: TicketReservation): boolean {
  const html = buildTicketPrintDocument(ticket);
  const win = window.open("", "_blank", "noopener,noreferrer,width=820,height=960");
  if (!win) return false;
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
  if (win.document.readyState === "complete") {
    setTimeout(trigger, 150);
  } else {
    win.addEventListener("load", () => setTimeout(trigger, 150));
  }
  return true;
}

/** Télécharge le billet en HTML (imprimable / « Enregistrer en PDF »). */
export function downloadTicketHtml(ticket: TicketReservation): void {
  const html = buildTicketPrintDocument(ticket);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `billet-${ticket.codeUnique}.html`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
