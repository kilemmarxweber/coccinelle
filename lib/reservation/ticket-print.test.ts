import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildTicketPrintDocument } from "../../components/ticket/ticket-print-document";
import type { TicketReservation } from "./ticket-data";
import { generatePassengerQr } from "./passenger-qr";

const baseTicket = (overrides: Partial<TicketReservation> = {}): TicketReservation => ({
  codeUnique: "RES-TEST-001",
  dateDepart: "2026-08-10T00:00:00.000Z",
  heureDepart: "08:00",
  prixBillet: 10000,
  prixTotal: 10000,
  organization: { name: "Mon Agence", logo: null },
  trajet: {
    villeDepart: "Kinshasa",
    villeArrivee: "Lubumbashi",
    modeTransport: "BUS",
  },
  client: { displayName: "Jean Test", telephone: "+243900000000" },
  passagers: [],
  paiement: { methode: "CASH", montant: 10000, statut: "PAYE" },
  ...overrides,
});

describe("ticket print document (U08)", () => {
  it("inclut org, codes et mention bébé sans siège", async () => {
    const adultQr = await generatePassengerQr("PASS-0-TEST-ADULT");
    const babyQr = await generatePassengerQr("PASS-1-TEST-BABY");
    const html = buildTicketPrintDocument(
      baseTicket({
        passagers: [
          {
            id: "p1",
            nom: "Test",
            prenom: "Adulte",
            categorie: "ADULTE",
            prix: 10000,
            codeUnique: "PASS-0-TEST-ADULT",
            occupePlace: true,
            qrDataUrl: adultQr.dataUrl,
            qrPayload: adultQr.payload,
          },
          {
            id: "p2",
            nom: "Test",
            prenom: "Bébé",
            categorie: "BEBE",
            prix: 0,
            codeUnique: "PASS-1-TEST-BABY",
            occupePlace: false,
            qrDataUrl: babyQr.dataUrl,
            qrPayload: babyQr.payload,
          },
        ],
      }),
    );

    assert.match(html, /Mon Agence/);
    assert.match(html, /RES-TEST-001/);
    assert.match(html, /PASS-0-TEST-ADULT/);
    assert.match(html, /PASS-1-TEST-BABY/);
    assert.match(html, /n’occupe pas de siège/);
    assert.match(html, /data:image\/png;base64,/);
    assert.match(adultQr.payload, /^CCNL1\.PASS-0-TEST-ADULT\./);
    assert.match(babyQr.payload, /^CCNL1\.PASS-1-TEST-BABY\./);
  });
});