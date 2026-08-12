import { openBlankPrintWindow } from "@/lib/hotel/stock-movements-print";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export type OrgExportMeta = {
  orgName: string;
  reportTitle: string;
  from: string;
  to: string;
  branchNames: string[];
  rateBanner?: string | null;
  kpis?: { label: string; value: string }[];
};

export type OrgExportTable = {
  headers: string[];
  rows: (string | number)[][];
};

function headerBlock(meta: OrgExportMeta) {
  const branches =
    meta.branchNames.length > 0 ? meta.branchNames.join(", ") : "—";
  const kpis =
    meta.kpis && meta.kpis.length > 0
      ? `<p>${meta.kpis.map((k) => `<strong>${escapeHtml(k.label)}</strong> : ${escapeHtml(k.value)}`).join(" · ")}</p>`
      : "";
  return `
    <header style="margin-bottom:20px;border-bottom:2px solid #111;padding-bottom:12px">
      <div style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#737373">Organisation</div>
      <h1 style="margin:4px 0 0;font-size:22px">${escapeHtml(meta.orgName)}</h1>
      <h2 style="margin:8px 0 0;font-size:16px;font-weight:600">${escapeHtml(meta.reportTitle)}</h2>
      <p style="margin:8px 0 0;color:#525252">Période : ${escapeHtml(meta.from)} → ${escapeHtml(meta.to)}</p>
      <p style="margin:4px 0 0;color:#525252">Branches : ${escapeHtml(branches)}</p>
      ${meta.rateBanner ? `<p style="margin:4px 0 0;color:#0369a1">${escapeHtml(meta.rateBanner)}</p>` : ""}
      ${kpis}
    </header>
  `;
}

function tableHtml(table: OrgExportTable) {
  return `
    <table>
      <thead>
        <tr>${table.headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr>
      </thead>
      <tbody>
        ${
          table.rows.length === 0
            ? `<tr><td colspan="${table.headers.length}" style="text-align:center;color:#737373;padding:16px">Aucune ligne</td></tr>`
            : table.rows
                .map(
                  (row) =>
                    `<tr>${row
                      .map((cell, i) => {
                        const align =
                          typeof cell === "number" ||
                          (typeof cell === "string" &&
                            /^-?[\d\s.,]+[%$]?$/.test(cell.trim()))
                            ? ' class="num"'
                            : "";
                        const isLast = i === row.length - 1 && typeof cell === "number";
                        return `<td${align || (isLast ? ' class="num"' : "")}>${escapeHtml(String(cell))}</td>`;
                      })
                      .join("")}</tr>`,
                )
                .join("")
        }
      </tbody>
    </table>
  `;
}

/** Export PDF via impression navigateur — en-tête avec nom d’organisation. */
export function exportOrgReportPdf(
  meta: OrgExportMeta,
  table: OrgExportTable,
) {
  const win = openBlankPrintWindow();
  if (!win) return false;
  const title = `${meta.orgName} — ${meta.reportTitle}`;
  win.document.open();
  win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${escapeHtml(title)}</title>
  <style>
    body{font-family:system-ui,sans-serif;padding:28px;color:#111;font-size:13px}
    h1,h2{font-family:inherit}
    table{width:100%;border-collapse:collapse;margin-top:8px}
    th,td{border-bottom:1px solid #e5e5e5;padding:8px 6px;text-align:left;vertical-align:top}
    th{font-size:10px;text-transform:uppercase;color:#737373;letter-spacing:.04em}
    .num{text-align:right;font-variant-numeric:tabular-nums}
    @media print{body{padding:12px}}
  </style>
  </head><body>
  ${headerBlock(meta)}
  ${tableHtml(table)}
  <p style="margin-top:24px;font-size:11px;color:#a3a3a3">Document généré le ${escapeHtml(new Date().toLocaleString("fr-FR"))}</p>
  </body></html>`);
  win.document.close();
  setTimeout(() => {
    try {
      win.focus();
      win.print();
    } catch {
      /* ignore */
    }
  }, 250);
  return true;
}

function fileSlug(value: string, max = 40) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, max);
}

/** Export Excel (.xls HTML) — en-tête avec nom d’organisation. */
export function exportOrgReportExcel(
  meta: OrgExportMeta,
  table: OrgExportTable,
) {
  const kpiRows =
    meta.kpis
      ?.map(
        (k) =>
          `<tr><td><b>${escapeHtml(k.label)}</b></td><td>${escapeHtml(k.value)}</td></tr>`,
      )
      .join("") ?? "";

  const bodyRows =
    table.rows.length === 0
      ? `<tr><td colspan="${table.headers.length}">Aucune ligne</td></tr>`
      : table.rows
          .map(
            (row) =>
              `<tr>${row
                .map((cell) => `<td>${escapeHtml(String(cell))}</td>`)
                .join("")}</tr>`,
          )
          .join("");

  const html = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"/></head>
<body>
<table>
  <tr><td colspan="${Math.max(table.headers.length, 2)}"><b>Organisation</b></td></tr>
  <tr><td colspan="${Math.max(table.headers.length, 2)}"><b>${escapeHtml(meta.orgName)}</b></td></tr>
  <tr><td colspan="${Math.max(table.headers.length, 2)}">${escapeHtml(meta.reportTitle)}</td></tr>
  <tr><td>Période</td><td>${escapeHtml(`${meta.from} → ${meta.to}`)}</td></tr>
  <tr><td>Branches</td><td>${escapeHtml(meta.branchNames.join(", ") || "—")}</td></tr>
  ${meta.rateBanner ? `<tr><td>Taux</td><td>${escapeHtml(meta.rateBanner)}</td></tr>` : ""}
  ${kpiRows}
  <tr><td colspan="${Math.max(table.headers.length, 2)}"></td></tr>
  <tr>${table.headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr>
  ${bodyRows}
</table>
</body></html>`;

  const blob = new Blob([html], {
    type: "application/vnd.ms-excel;charset=utf-8;",
  });
  const filename = `${fileSlug(meta.orgName) || "organisation"}_${fileSlug(meta.reportTitle) || "rapport"}_${meta.from}_${meta.to}.xls`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return true;
}
