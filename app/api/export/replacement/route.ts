import { NextRequest, NextResponse } from "next/server";

import { fiscalYearOf } from "@/lib/asset-valuation";
import { getCurrentUser } from "@/lib/auth";
import { getFacilityById, listAssets } from "@/lib/assets";
import { resolveFacilityFilter } from "@/lib/facility-scope";
import { buildReplacementPlan, DEFAULT_REPLACEMENT_RULES, repairWindowStart } from "@/lib/replacement-plan";
import { getPendingDisposalAssetIds, getRepairStats } from "@/lib/replacement-plan-db";
import { buildReplacementWorkbook } from "@/lib/replacement-report";
import { hasPermission } from "@/lib/role-permissions";
import { readRequestIp, recordSecurityEvent } from "@/lib/security";

/** แผนการจัดหาครุภัณฑ์ทดแทน (Excel), scoped like the reports page. */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    await recordSecurityEvent({ eventType: "api_unauthorized", ipAddress: readRequestIp(req.headers), path: req.nextUrl.pathname, detail: "พยายาม export แผนทดแทนโดยไม่มี session" });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(await hasPermission(user.role, "reports.view"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const requested = req.nextUrl.searchParams.get("facilityId");
  const facilityId = resolveFacilityFilter(user, requested ? Number(requested) : undefined);
  if (facilityId === null) return NextResponse.json({ error: "No facility scope" }, { status: 403 });

  const today = new Date().toISOString().slice(0, 10);
  const since = repairWindowStart(today, DEFAULT_REPLACEMENT_RULES.repairWindowYears);
  const scope = facilityId ? [facilityId] : undefined;
  const [assets, repairStats, pending, facility] = await Promise.all([
    listAssets({ facilityId }),
    getRepairStats(since, scope),
    getPendingDisposalAssetIds(scope),
    facilityId ? getFacilityById(facilityId) : Promise.resolve(null),
  ]);
  const plan = buildReplacementPlan(assets.map((asset) => ({ ...asset, subtypeName: asset.extensions[asset.assetClass]?.subtypeName })), repairStats, pending, today);
  const buffer = buildReplacementWorkbook(plan.items, {
    scopeLabel: facility?.name ?? (facilityId ? `หน่วยงาน #${facilityId}` : "ทุกหน่วยงาน"),
    fiscalYear: fiscalYearOf(today) + 1,
    printedBy: user.fullName,
    rules: DEFAULT_REPLACEMENT_RULES,
  });
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="atacs-replacement-plan-${today}.xlsx"`,
      "cache-control": "private, no-store",
    },
  });
}
