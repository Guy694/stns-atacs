import "server-only";

import QRCode from "qrcode";

import type { AssetWithFacility } from "@/lib/assets";

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
  const qrSize = 160;
  const canvasWidth = 220;
  const canvasHeight = 244;
  const qrSvg = await QRCode.toString(scanUrl, {
    type: "svg",
    width: qrSize,
    margin: 1,
    color: {
      dark: "#14532d",
      light: "#ffffff",
    },
  });
  const qrX = (canvasWidth - qrSize) / 2;
  const registrationNo = asset.assetRegistrationNo || `#${asset.id}`;
  const assetName = truncateLabel(asset.assetName, 34);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${canvasWidth}" height="${canvasHeight}" viewBox="0 0 ${canvasWidth} ${canvasHeight}" role="img" aria-label="${escapeXml(`QR Code ${registrationNo} ${asset.assetName}`)}">
  <rect width="${canvasWidth}" height="${canvasHeight}" rx="12" fill="#ffffff"/>
  <rect x="10" y="10" width="${canvasWidth - 20}" height="${canvasHeight - 20}" rx="10" fill="#ffffff" stroke="#d7e0db"/>
  ${qrSvg.replace("<svg ", `<svg x="${qrX}" y="18" `)}
  <text x="${canvasWidth / 2}" y="195" text-anchor="middle" font-family="Arial, 'Noto Sans Thai', sans-serif" font-size="14" font-weight="700" fill="#113127">${escapeXml(registrationNo)}</text>
  <text x="${canvasWidth / 2}" y="216" text-anchor="middle" font-family="Arial, 'Noto Sans Thai', sans-serif" font-size="12" font-weight="500" fill="#344a40">${escapeXml(assetName)}</text>
</svg>`;
}
