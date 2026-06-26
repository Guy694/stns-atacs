import { NextRequest, NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { getRolePermissionMatrix, PERMISSION_DEFINITIONS } from "@/lib/role-permissions";
import { readRequestIp, recordSecurityEvent } from "@/lib/security";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    await recordSecurityEvent({
      eventType: "api_unauthorized",
      ipAddress: readRequestIp(req.headers),
      path: req.nextUrl.pathname,
      detail: "พยายาม export permissions โดยไม่มี session",
    });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (user.role !== "admin") {
    await recordSecurityEvent({
      eventType: "api_forbidden",
      ipAddress: readRequestIp(req.headers),
      identity: user.fullName,
      path: req.nextUrl.pathname,
      detail: "ไม่มีสิทธิ์ export permissions",
    });
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const matrix = await getRolePermissionMatrix();

  return NextResponse.json(
    {
      exportedAt: new Date().toISOString(),
      exportedBy: user.fullName,
      definitions: PERMISSION_DEFINITIONS,
      matrix,
    },
    {
      headers: {
        "Content-Disposition": `attachment; filename=\"atacs-permissions-${new Date().toISOString().slice(0, 10)}.json\"`,
      },
    }
  );
}
