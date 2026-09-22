import "server-only";

import QRCode from "qrcode";

import type { AssetWithFacility } from "@/lib/assets";
import { facilityLabelLines, wrapLabel } from "@/lib/qr-label";

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function truncateLabel(value: string, maxLength: number) {
  const chars = Array.from(value.trim());
  if (chars.length <= maxLength) return value.trim();
  return `${chars.slice(0, Math.max(0, maxLength - 3)).join("")}...`;
}

export async function createAssetQrSvg(asset: AssetWithFacility, requestUrl: string) {
  const scanUrl = new URL(`/scan/assets/${asset.id}`, requestUrl).toString();
  const font = "Arial, 'Noto Sans Thai', 'Leelawadee UI', Tahoma, sans-serif";
  const canvasWidth = 240;
  const qrSize = 160;
  const qrSvg = await QRCode.toString(scanUrl, {
    type: "svg",
    width: qrSize,
    margin: 1,
    color: {
      dark: "#14532d",
      light: "#ffffff",
    },
  });

  // Header band: the owning facility, so a sticker found anywhere shows whose asset it is.
  const facilityLines = facilityLabelLines(asset.facilityName || "", 24, 2);
  const headerLineHeight = 16;
  const headerHeight = facilityLines.length ? 18 + facilityLines.length * headerLineHeight : 0;
  const qrY = 10 + headerHeight + 6;
  const numberY = qrY + qrSize + 20;
  const assetNumber = asset.assetNumber || asset.assetRegistrationNo || `#${asset.id}`;
  const nameLines = wrapLabel(asset.assetName, 28, 2);
  const nameLineHeight = 15;
  // Room below the last line for Thai below-base vowels and the border.
  const canvasHeight = numberY + 8 + nameLines.length * nameLineHeight + 22;
  const qrX = (canvasWidth - qrSize) / 2;
  const center = canvasWidth / 2;

  const header = facilityLines.length
    ? `<path d="M10 20 a10 10 0 0 1 10 -10 h${canvasWidth - 40} a10 10 0 0 1 10 10 v${headerHeight - 10} h-${canvasWidth - 20} z" fill="#14532d"/>
  ${facilityLines.map((line, index) => `<text x="${center}" y="${10 + 8 + (index + 1) * headerLineHeight - 2}" text-anchor="middle" font-family="${font}" font-size="12.5" font-weight="700" fill="#ffffff">${escapeXml(line)}</text>`).join("\n  ")}`
    : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${canvasWidth}" height="${canvasHeight}" viewBox="0 0 ${canvasWidth} ${canvasHeight}" role="img" aria-label="${escapeXml(`QR Code ${asset.facilityName ? `${asset.facilityName} ` : ""}${assetNumber} ${asset.assetName}`)}">
  <rect width="${canvasWidth}" height="${canvasHeight}" rx="12" fill="#ffffff"/>
  <rect x="10" y="10" width="${canvasWidth - 20}" height="${canvasHeight - 20}" rx="10" fill="#ffffff" stroke="#d7e0db"/>
  ${header}
  ${qrSvg.replace("<svg ", `<svg x="${qrX}" y="${qrY}" `)}
  <text x="${center}" y="${numberY}" text-anchor="middle" font-family="${font}" font-size="14" font-weight="700" fill="#113127">${escapeXml(truncateLabel(assetNumber, 30))}</text>
  ${nameLines.map((line, index) => `<text x="${center}" y="${numberY + 8 + (index + 1) * nameLineHeight - 2}" text-anchor="middle" font-family="${font}" font-size="12" font-weight="500" fill="#344a40">${escapeXml(line)}</text>`).join("\n  ")}
</svg>`;
}
