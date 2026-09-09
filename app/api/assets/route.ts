import { NextRequest, NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { listAssets } from "@/lib/assets";
import { resolveFacilityFilter } from "@/lib/facility-scope";
import { readRequestIp, recordSecurityEvent } from "@/lib/security";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    await recordSecurityEvent({
      eventType: "api_unauthorized",
      ipAddress: readRequestIp(req.headers),
      path: req.nextUrl.pathname,
      detail: "พยายามอ่านข้อมูลทรัพย์สินโดยไม่มี session",
    });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const requestedFacilityId = req.nextUrl.searchParams.get("facilityId")
    ? Number(req.nextUrl.searchParams.get("facilityId"))
    : undefined;
  const facilityId = resolveFacilityFilter(user, requestedFacilityId);
  if (facilityId === null) {
    return NextResponse.json({ error: "No facility scope" }, { status: 403 });
  }

  const assets = await listAssets({ facilityId });

  return NextResponse.json(
    assets.map((a) => ({
      id: a.id,
      assetName: a.assetName,
      assetRegistrationNo: a.assetRegistrationNo,
      deviceType: a.deviceType,
      assetClass: a.assetClass,
      assetGroup: a.assetGroup,
      currentStatus: a.currentStatus,
    }))
  );
}
