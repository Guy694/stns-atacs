import QRCode from "qrcode";

import { getAssetById } from "@/lib/assets";

type AssetQrRouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, { params }: AssetQrRouteContext) {
  const { id } = await params;
  const assetId = Number(id);

  if (!Number.isInteger(assetId) || assetId <= 0) {
    return new Response("Invalid asset id", { status: 400 });
  }

  const asset = await getAssetById(assetId);
  if (!asset) {
    return new Response("Asset not found", { status: 404 });
  }

  const scanUrl = new URL(`/scan/assets/${asset.id}`, request.url).toString();
  const svg = await QRCode.toString(scanUrl, {
    type: "svg",
    width: 144,
    margin: 1,
    color: {
      dark: "#14532d",
      light: "#ffffff",
    },
  });

  return new Response(svg, {
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      "cache-control": "private, max-age=300",
    },
  });
}
