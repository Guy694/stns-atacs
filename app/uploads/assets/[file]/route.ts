import { readFile } from "node:fs/promises";

import type { RowDataPacket } from "mysql2/promise";

import { getCurrentUser } from "@/lib/auth";
import { selectRows } from "@/lib/mysql";
import { canAccessAssetFacility } from "@/lib/permissions";
import { assetImageCandidates, assetImageContentType, assetImageUrl, safeAssetImageName } from "@/lib/upload-storage";

type RouteContext = { params: Promise<{ file: string }> };

// Asset photos are only shown to signed-in users who may see the asset's facility.
export async function GET(_request: Request, { params }: RouteContext) {
  const { file } = await params;
  const name = safeAssetImageName(decodeURIComponent(file));
  if (!name) return new Response("Not found", { status: 404 });

  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const url = assetImageUrl(name);
  const rows = await selectRows<RowDataPacket & { facility_id: number }>(
    `SELECT s.facility_id
       FROM information_assets a
       JOIN information_asset_surveys s ON s.id = a.survey_id
      WHERE a.asset_image_1_url = ? OR a.asset_image_2_url = ?
      LIMIT 1`,
    [url, url],
  );
  // Photos not attached to any asset (replaced or deleted) are not served.
  if (!rows.length) return new Response("Not found", { status: 404 });
  if (!canAccessAssetFacility(user, rows[0].facility_id)) return new Response("Forbidden", { status: 403 });

  for (const candidate of assetImageCandidates(name)) {
    try {
      const bytes = await readFile(candidate);
      return new Response(new Uint8Array(bytes), {
        headers: {
          "content-type": assetImageContentType(name),
          "content-length": String(bytes.length),
          // Private: browsers may cache, shared proxies must not.
          "cache-control": "private, max-age=86400",
          "x-content-type-options": "nosniff",
        },
      });
    } catch {
      // try the next location
    }
  }
  return new Response("Not found", { status: 404 });
}
