import { NextRequest, NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { listAssets } from "@/lib/assets";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const facilityId = req.nextUrl.searchParams.get("facilityId");

  const assets = await listAssets({ facilityId: facilityId ? Number(facilityId) : undefined });

  return NextResponse.json(
    assets.map((a) => ({
      id: a.id,
      assetName: a.assetName,
      assetRegistrationNo: a.assetRegistrationNo,
      deviceType: a.deviceType,
      assetGroup: a.assetGroup,
      currentStatus: a.currentStatus,
    }))
  );
}
