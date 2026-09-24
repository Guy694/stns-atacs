import { NextRequest, NextResponse } from "next/server";

import { listAssets } from "@/lib/assets";
import { fiscalYearOf } from "@/lib/asset-valuation";
import { getCurrentUser } from "@/lib/auth";
import { toCsv } from "@/lib/csv";
import { buildDepreciationRollup } from "@/lib/depreciation-rollup";
import { resolveFacilityFilter } from "@/lib/facility-scope";
import { hasPermission } from "@/lib/role-permissions";
import { readRequestIp, recordSecurityEvent } from "@/lib/security";

/** งบแสดงการเปลี่ยนแปลงค่าเสื่อมราคาต่อปีงบประมาณ แยกตามหน่วยงาน (สำหรับส่งงานการเงิน) */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    await recordSecurityEvent({
      eventType: "api_unauthorized",
      ipAddress: readRequestIp(req.headers),
      path: req.nextUrl.pathname,
      detail: "พยายาม export สรุปค่าเสื่อมราคาโดยไม่มี session",
    });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(await hasPermission(user.role, "reports.view"))) {
    await recordSecurityEvent({
      eventType: "api_forbidden",
      ipAddress: readRequestIp(req.headers),
      identity: user.fullName,
      path: req.nextUrl.pathname,
      detail: "ไม่มีสิทธิ์ export สรุปค่าเสื่อมราคา",
    });
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const params = req.nextUrl.searchParams;
  const requestedFacilityId = params.get("facilityId") ? Number(params.get("facilityId")) : undefined;
  const facilityId = resolveFacilityFilter(user, requestedFacilityId);
  if (facilityId === null) return NextResponse.json({ error: "No facility scope" }, { status: 403 });

  const fiscalYear = Number(params.get("fy")) || fiscalYearOf(new Date().toISOString().slice(0, 10));
  if (!Number.isInteger(fiscalYear) || fiscalYear < 2500 || fiscalYear > 2700) {
    return NextResponse.json({ error: "ปีงบประมาณไม่ถูกต้อง" }, { status: 400 });
  }

  const assets = await listAssets({ facilityId });
  const rollup = buildDepreciationRollup(
    assets.map((asset) => ({ ...asset, subtypeName: asset.extensions[asset.assetClass]?.subtypeName })),
    fiscalYear
  );

  const money = (value: number) => value.toFixed(2);
  const rows: unknown[][] = [
    [`งบแสดงการเปลี่ยนแปลงค่าเสื่อมราคา ปีงบประมาณ ${fiscalYear}`],
    [`รอบบัญชี ${rollup.periodStart} ถึง ${rollup.periodEnd}`],
    [],
    ["หน่วยงาน", "จำนวน (รายการ)", "ข้อมูลไม่ครบ (รายการ)", "ราคาทุน", "ค่าเสื่อมสะสมยกมา", "ค่าเสื่อมราคาปีนี้", "ค่าเสื่อมสะสมยกไป", "มูลค่าสุทธิยกไป", "ครบอายุแล้ว (รายการ)"],
    ...rollup.rows.map((row) => [
      row.facilityName, row.count, row.incomplete, money(row.cost), money(row.openingAccumulated),
      money(row.depreciationThisYear), money(row.closingAccumulated), money(row.closingBookValue), row.fullyDepreciated,
    ]),
    [
      "รวมทั้งสิ้น", rollup.totals.count, rollup.totals.incomplete, money(rollup.totals.cost), money(rollup.totals.openingAccumulated),
      money(rollup.totals.depreciationThisYear), money(rollup.totals.closingAccumulated), money(rollup.totals.closingBookValue),
      rollup.totals.fullyDepreciated,
    ],
    [],
    [`ไม่นับครุภัณฑ์ที่จำหน่าย/สูญหายแล้ว ${rollup.excludedTerminal} รายการ`],
    [rollup.balanced ? "ตรวจสอบแล้ว: ยอดยกมา + ค่าเสื่อมปีนี้ = ยอดยกไป" : "คำเตือน: ยอดยกมา + ค่าเสื่อมปีนี้ ไม่เท่ากับยอดยกไป กรุณาตรวจสอบข้อมูล"],
  ];

  return new NextResponse(toCsv(rows), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="atacs-depreciation-rollup-fy${fiscalYear}.csv"`,
    },
  });
}
