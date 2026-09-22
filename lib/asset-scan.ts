/**
 * Reads the asset id from a scanned QR payload. Asset QR codes encode the asset page URL
 * (…/assets/123 or …/scan/assets/123); anything else returns null.
 */
export function assetIdFromScan(text: string) {
  const match = /\/(?:scan\/)?assets\/(\d+)(?:[/?#]|$)/.exec(text.trim());
  return match ? Number(match[1]) : null;
}
