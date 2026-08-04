import QRCode from "qrcode";
import { boardingQrPayload } from "./boarding-token";

export type PassengerQr = {
  /** Contenu encodé dans le QR (token signé). */
  payload: string;
  /** Image PNG en data URL pour affichage / impression. */
  dataUrl: string;
};

/** Génère le QR scannable d’un passager (serveur uniquement). */
export async function generatePassengerQr(
  codeUnique: string,
): Promise<PassengerQr> {
  const payload = boardingQrPayload(codeUnique);
  const dataUrl = await QRCode.toDataURL(payload, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 160,
    color: { dark: "#111111", light: "#ffffff" },
  });
  return { payload, dataUrl };
}
