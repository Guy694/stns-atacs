import { NextRequest, NextResponse } from "next/server";

import { assetClassLabel } from "@/lib/asset-classes";
import { fiscalYearOf, summarizeValuation, VALUATION_STATUS_LABELS } from "@/lib/asset-valuation";
import { getCurrentUser } from "@/lib/auth";
import { listAssets } from "@/lib/assets";
import { resolveFacilityFilter } from "@/lib/facility-scope";
import { hasPermission } from "@/lib/role-permissions";
import { readRequestIp, recordSecurityEvent } from "@/lib/security";

function escapeCsv(value: unknown) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Depreciation register (ทะเบียนค่าเสื่อมราคา) for one fiscal year, scoped like the reports page. */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    await recordSecurityEvent({ eventType: "api_unauthorized", ipAddress: readRequestIp(req.headers), path: req.nextUrl.pathname, detail: "พยายาม export ค่าเสื่อมราคาโดยไม่มี session" });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(await hasPermission(user.role, "reports.view"))) {
    await recordSecurityEvent({ eventType: "api_forbidden", ipAddress: readRequestIp(req.headers), identity: user.fullName, path: req.nextUrl.pathname, detail: "ไม่มีสิทธิ์ export ค่าเสื่อมราคา" });
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const params = req.nextUrl.searchParams;
  const requestedFacilityId = params.get("facilityId") ? Number(params.get("facilityId")) : undefined;
  const facilityId = resolveFacilityFilter(user, requestedFacilityId);
  if (facilityId === null) return NextResponse.json({ error: "No facility scope" }, { status: 403 });
  const today = new Date().toISOString().slice(0, 10);
  const fiscalYear = Number(params.get("fy")) || fiscalYearOf(today);
  if (!Number.isInteger(fiscalYear) || fiscalYear < 2500 || fiscalYear > 2700) return NextResponse.json({ error: "ปีงบประมาณไม่ถูกต้อง" }, { status: 400 });

  const assets = await listAssets({ facilityId });
  const report = summarizeValuation(assets.map(asset => ({ ...asset, subtypeName: asset.extensions[asset.assetClass]?.subtypeName })), fiscalYear, today);
  const header = [
    "id", "asset_registration_no", "asset_name", "facility", "asset_class", "schedule_category", "current_status",
    "purchase_date", "purchase_price", "useful_life_years", "life_source", "annual_depreciation",
    `depreciation_fy${fiscalYear}`, "accumulated_depreciation", "book_value", "fully_depreciated_on", "valuation_status", "as_of",
  ];
  const rows = report.items.map(({ asset, valuation, depreciationThisYear }) => [
    asset.id, asset.assetRegistrationNo, asset.assetName, asset.facilityName, assetClassLabel(asset.assetClass, "full"), valuation.life.categoryLabel,
    asset.currentStatus, valuation.startDate ?? "", valuation.cost ?? "", valuation.life.years ?? "", valuation.life.source,
    valuation.status === "ok" ? valuation.annualDepreciation.toFixed(2) : "", valuation.status === "ok" ? depreciationThisYear.toFixed(2) : "",
    valuation.status === "ok" ? valuation.accumulated.toFixed(2) : "", valuation.bookValue ?? "", valuation.status === "ok" ? valuation.fullyDepreciatedOn : "",
    VALUATION_STATUS_LABELS[valuation.status], report.asOf,
  ]);
  const csv = `﻿${[header, ...rows].map(row => row.map(escapeCsv).join(",")).join("\r\n")}`;
  return new NextResponse(csv, {
    status: 200,
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="atacs-depreciation-fy${fiscalYear}.csv"` },
  });
}
