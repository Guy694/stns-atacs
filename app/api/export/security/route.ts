import { NextRequest, NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { toCsv } from "@/lib/csv";
import { todayBangkok } from "@/lib/local-date";
import { readRequestIp, recordSecurityEvent } from "@/lib/security";
import { describeSecurityEvent } from "@/lib/security-dashboard";
import { exportSecurityEvents } from "@/lib/security-dashboard-data";
import { readSecurityFilter } from "@/lib/security-filter";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    await recordSecurityEvent({
      eventType: user ? "api_forbidden" : "api_unauthorized",
      ipAddress: readRequestIp(req.headers),
      identity: user?.fullName,
      path: req.nextUrl.pathname,
      detail: "พยายาม export บันทึกความปลอดภัย",
    });
    return NextResponse.json({ error: user ? "Forbidden" : "Unauthorized" }, { status: user ? 403 : 401 });
  }

  const filter = readSecurityFilter(Object.fromEntries(req.nextUrl.searchParams));
  const rows = await exportSecurityEvents(filter);
  // toCsv prefixes values Excel would treat as formulas (SEC-12)
  const csv = toCsv(
    [
      ["id", "created_at", "event_type", "event_label", "ip_address", "identity", "path", "detail"],
      ...rows.map((row) => [row.id, row.createdAt, row.eventType, describeSecurityEvent(row.eventType).label, row.ip, row.identity ?? "", row.path ?? "", row.detail ?? ""]),
    ],
    { bom: false }
  );
  return new NextResponse("\ufeff" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="atacs-security-${todayBangkok()}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
