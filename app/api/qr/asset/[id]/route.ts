import { createAssetQrSvg } from "@/lib/asset-qr";
import { getCurrentUser } from "@/lib/auth";
import { getAssetById } from "@/lib/assets";
import { canAccessAssetFacility } from "@/lib/permissions";

type AssetQrRouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, { params }: AssetQrRouteContext) {
  const { id } = await params;
  const assetId = Number(id);

  if (!Number.isInteger(assetId) || assetId <= 0) {
    return new Response("Invalid asset id", { status: 400 });
  }

  // The sticker shows the owning facility, so it follows the same access rule as the asset page.
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const asset = await getAssetById(assetId);
  if (!asset) {
    return new Response("Asset not found", { status: 404 });
  }
  if (!canAccessAssetFacility(user, asset.facilityId)) return new Response("Forbidden", { status: 403 });

  const svg = await createAssetQrSvg(asset, request.url);

  return new Response(svg, {
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      "cache-control": "private, max-age=300",
    },
  });
}
