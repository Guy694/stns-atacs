/**
 * Reads the asset id from a scanned QR payload. Asset QR codes encode the asset page URL
 * (…/assets/123, …/scan/assets/123 or the short sticker form …/q/123); anything else returns null.
 */
export function assetIdFromScan(text: string) {
  const match = /\/(?:(?:scan\/)?assets|q)\/(\d+)(?:[/?#]|$)/i.exec(text.trim());
  return match ? Number(match[1]) : null;
}
