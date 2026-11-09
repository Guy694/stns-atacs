import { NextRequest, NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { listAssets } from "@/lib/assets";
import { parseAssetListQuery } from "@/lib/asset-list-query";
import { assetTypeLabel } from "@/lib/asset-policy";
import { resolveRequestedAssetFacility } from "@/lib/facility-scope";
import { readRequestIp, recordSecurityEvent } from "@/lib/security";
import { hasPermission } from "@/lib/role-permissions";
import { userFacingError } from "@/lib/schema-errors";

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

  if (!(await hasPermission(user.role, "assets.view"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const requestedFacilityId = req.nextUrl.searchParams.get("facilityId")
    ? Number(req.nextUrl.searchParams.get("facilityId"))
    : undefined;
  // A facility outside the user's scope is refused rather than silently replaced by their own.
  const scope = resolveRequestedAssetFacility(user, requestedFacilityId);
  if (!scope.ok) {
    return NextResponse.json({ error: scope.error }, { status: scope.status });
  }
  const facilityId = scope.facilityId;

  let filter;
  try {
    filter = parseAssetListQuery(req.nextUrl.searchParams);
  } catch (error) {
    return NextResponse.json({ error: userFacingError(error, "ตัวกรองไม่ถูกต้อง") }, { status: 400 });
  }
  const assets = await listAssets({ ...filter, facilityId });

  return NextResponse.json(
    assets.map((a) => ({
      id: a.id,
      assetName: a.assetName,
      assetRegistrationNo: a.assetRegistrationNo,
      deviceType: a.deviceType,
      assetClass: a.assetClass,
      subtype: a.extensions[a.assetClass] ?? null,
      assetGroup: a.assetGroup,
      displayType: assetTypeLabel(a),
      currentStatus: a.currentStatus,
      workGroupId: a.workGroupId,
      assetNumber: a.assetNumber,
    }))
  );
}
