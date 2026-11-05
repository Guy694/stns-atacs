/**
 * Reads the asset id from a scanned QR payload. Asset QR codes encode the asset page URL
 * (…/assets/123, …/scan/assets/123 or the short sticker form …/q/123); anything else returns null.
 */
export function assetIdFromScan(text: string) {
  const match = /\/(?:(?:scan\/)?assets|q)\/(\d+)(?:[/?#]|$)/i.exec(text.trim());
  return match ? Number(match[1]) : null;
}

export type ScanTarget =
  | { kind: "asset"; assetId: number; href: string }
  | { kind: "search"; query: string; href: string }
  | { kind: "unknown" };

/**
 * Where the in-app scanner (/scan) goes for a scanned code. Only the asset id is taken from an asset URL,
 * so a QR never navigates to another site; short plain text (a registration number) becomes a search.
 * The asset page shows the "พบ" check-in panel itself when a round is open for that asset.
 */
export function scanTarget(text: string, searchPath = "/assets/"): ScanTarget {
  const value = text.trim();
  if (!value || value.length > 200) return { kind: "unknown" };
  const assetId = assetIdFromScan(value);
  if (assetId) return { kind: "asset", assetId, href: `/assets/${assetId}/#check-in-heading` };
  if (/^[a-z][a-z0-9+.-]*:/i.test(value) || value.length > 120) return { kind: "unknown" };
  return { kind: "search", query: value, href: `${searchPath}?search=${encodeURIComponent(value)}` };
}
