import { NextRequest, NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { canAccessFacility } from "@/lib/facility-scope";
import { getInspectionById, getInspectionCommittee, getInspectionItems } from "@/lib/inspection";
import {
  buildInspectionWorkbook,
  filterInspectionItems,
  inspectionFilterOptions,
  readInspectionItemFilters,
  NO_WORK_GROUP,
  RESULT_OPTIONS,
} from "@/lib/inspection-sheet";
import { buildInspectionReportWorkbook } from "@/lib/inspection-report";
import { hasPermission } from "@/lib/role-permissions";
import { readRequestIp, recordSecurityEvent } from "@/lib/security";

type Context = { params: Promise<{ id: string }> };

/** Paper count sheet (.xlsx) for one inspection round, using the same filters as the page. */
export async function GET(req: NextRequest, { params }: Context) {
  const user = await getCurrentUser();
  if (!user) {
    await recordSecurityEvent({ eventType: "api_unauthorized", ipAddress: readRequestIp(req.headers), path: req.nextUrl.pathname, detail: "พยายาม export ใบตรวจนับโดยไม่มี session" });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(await hasPermission(user.role, "inspection.view"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const inspectionId = Number((await params).id);
  if (!Number.isSafeInteger(inspectionId) || inspectionId <= 0) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  const inspection = await getInspectionById(inspectionId);
  if (!inspection) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canAccessFacility(user, inspection.facilityId)) {
    await recordSecurityEvent({ eventType: "api_forbidden", ipAddress: readRequestIp(req.headers), identity: user.fullName, path: req.nextUrl.pathname, detail: `export ใบตรวจนับรอบ ${inspectionId} นอกหน่วยงาน` });
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [items, committee] = await Promise.all([getInspectionItems(inspectionId), getInspectionCommittee(inspectionId)]);
  if (req.nextUrl.searchParams.get("type") === "report") {
    // The annual report always covers the whole round; list filters do not apply.
    const { buffer } = buildInspectionReportWorkbook(
      items.map((item) => ({ ...item, inspectionAssetStatus: item.assetStatus })),
      {
        roundName: inspection.roundName,
        facilityName: inspection.facilityName,
        districtName: inspection.districtName,
        workGroupName: inspection.workGroupName,
        filterLabel: "",
        committee: committee.members,
        startDate: inspection.startDate,
        endDate: inspection.endDate,
        closedAt: inspection.closedAt,
        roundStatus: inspection.roundStatus,
      }
    );
    const thaiName = `รายงานผลการตรวจสอบ-${inspection.roundName}`.replace(/[\\/:*?"<>|]+/g, "-").slice(0, 80);
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="inspection-report-${inspectionId}.xlsx"; filename*=UTF-8''${encodeURIComponent(thaiName)}.xlsx`,
        "Cache-Control": "private, no-store",
      },
    });
  }

  const filters = readInspectionItemFilters(req.nextUrl.searchParams);
  const options = inspectionFilterOptions(items);
  const locationLabel = filters.location ? options.locations.find((l) => l.value === filters.location)?.label ?? "" : "";
  const filterLabel = [
    filters.category && `ประเภท ${options.categories.find((c) => c.key === filters.category)?.label ?? filters.category}`,
    filters.result && `ผลตรวจ ${RESULT_OPTIONS.find((r) => r.value === filters.result)?.label}`,
  ].filter(Boolean).join(" · ");

  const { buffer } = buildInspectionWorkbook(
    filterInspectionItems(items, filters).map((item) => ({ ...item, inspectionAssetStatus: item.assetStatus })),
    {
      roundName: inspection.roundName,
      facilityName: inspection.facilityName,
      districtName: inspection.districtName,
      // The round's own work group wins; otherwise the work group chosen in the filter.
      workGroupName: inspection.workGroupName || (filters.location && filters.location !== NO_WORK_GROUP ? locationLabel : filters.location === NO_WORK_GROUP ? "ไม่ระบุกลุ่มงาน" : ""),
      filterLabel,
      committee: committee.members,
    }
  );
  const filename = `inspection-${inspectionId}-${new Date().toISOString().slice(0, 10)}.xlsx`;
  const thaiName = `ใบตรวจนับ-${inspection.roundName}`.replace(/[\\/:*?"<>|]+/g, "-").slice(0, 80);
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(thaiName)}.xlsx`,
      "Cache-Control": "private, no-store",
    },
  });
}
