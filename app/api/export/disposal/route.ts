import { NextRequest, NextResponse } from "next/server";

import { getFacilityById } from "@/lib/assets";
import { listDisposalReportRows } from "@/lib/asset-disposals";
import { fiscalYearOf } from "@/lib/asset-valuation";
import { getCurrentUser } from "@/lib/auth";
import { buildDisposalWorkbook } from "@/lib/disposal-report";
import { getFacilityScopeId } from "@/lib/facility-scope";
import { hasPermission } from "@/lib/role-permissions";
import { readRequestIp, recordSecurityEvent } from "@/lib/security";

/**
 * Disposal documents (.xlsx): ?type=pending (รายการขออนุมัติจำหน่าย) or ?type=annual&fy=2570 (รายงานการจำหน่ายประจำปี).
 * Officers get their own facility; admins may pass ?facility=ID or get every facility.
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    await recordSecurityEvent({ eventType: "api_unauthorized", ipAddress: readRequestIp(req.headers), path: req.nextUrl.pathname, detail: "พยายาม export เอกสารจำหน่ายโดยไม่มี session" });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const [canRequest, canApprove, canReport] = await Promise.all([
    hasPermission(user.role, "disposal.manage"),
    hasPermission(user.role, "disposal.approve"),
    hasPermission(user.role, "reports.view"),
  ]);
  if (!canRequest && !canApprove && !canReport) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const scopeId = getFacilityScopeId(user);
  if (scopeId === null) return NextResponse.json({ error: "No facility scope" }, { status: 403 });
  const requested = Number(req.nextUrl.searchParams.get("facility") ?? 0);
  const facilityId = scopeId ?? (Number.isSafeInteger(requested) && requested > 0 ? requested : undefined);
  const kind = req.nextUrl.searchParams.get("type") === "annual" ? "annual" : "pending";
  const fyParam = Number(req.nextUrl.searchParams.get("fy"));
  const fiscalYear = Number.isInteger(fyParam) && fyParam >= 2500 && fyParam <= 2700 ? fyParam : fiscalYearOf(new Date().toISOString().slice(0, 10));

  const { rows, schemaReady } = await listDisposalReportRows({ kind, fiscalYear, facilityIds: facilityId ? [facilityId] : undefined });
  if (!schemaReady) return NextResponse.json({ error: "ต้องรัน database/add_asset_lifecycle.sql ก่อน" }, { status: 409 });
  const facility = facilityId ? await getFacilityById(facilityId) : null;
  const { buffer } = buildDisposalWorkbook(rows, {
    kind,
    fiscalYear,
    facilityName: facility?.name ?? "ทุกหน่วยงาน",
    printedBy: user.fullName,
  });
  const thaiName = (kind === "pending" ? "รายการขออนุมัติจำหน่าย" : `รายงานการจำหน่าย-ปีงบ${fiscalYear}`) + (facility ? `-${facility.name}` : "");
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="disposal-${kind}.xlsx"; filename*=UTF-8''${encodeURIComponent(thaiName.replace(/[\\/:*?"<>|]+/g, "-").slice(0, 90))}.xlsx`,
      "Cache-Control": "private, no-store",
    },
  });
}
