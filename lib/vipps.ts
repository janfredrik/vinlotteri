import QRCode from "qrcode";

/** Normalise a Norwegian mobile number to 8 digits (strip spaces, +47, 0047). */
export function normalizeVippsNumber(raw: string): string {
  let d = (raw || "").replace(/\D/g, "");
  if (d.startsWith("0047")) d = d.slice(4);
  else if (d.startsWith("47") && d.length === 10) d = d.slice(2);
  return d;
}

/**
 * "Vipps meg" style deep link for a personal Vipps number. Opens the Vipps app
 * with the recipient pre-selected. Amount and message CANNOT be pre-filled for a
 * personal number - the payer types those in the app.
 * The path takes the number with country code (47XXXXXXXX), same as the QR
 * under «Min QR» in the Vipps app - without it the iOS app rejects the code.
 */
export function vippsMeLink(rawNumber: string): string | null {
  const d = normalizeVippsNumber(rawNumber);
  if (d.length !== 8) return null;
  return `https://qr.vipps.no/28/2/01/031/47${d}?v=1`;
}

/** Data URI PNG of a QR code, or null if the payload is empty. */
export async function qrDataUri(payload: string | null): Promise<string | null> {
  if (!payload) return null;
  return QRCode.toDataURL(payload, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 512,
    color: { dark: "#3a0a12", light: "#ffffff" },
  });
}
