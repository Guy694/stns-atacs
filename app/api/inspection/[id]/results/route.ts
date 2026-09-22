import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

import { getCurrentUser } from "@/lib/auth";
import { getInspectionById, getInspectionItems } from "@/lib/inspection";
import { InspectionResultError, recordInspectionResult } from "@/lib/inspection-results";
import { parseBatch, type SyncOutcome } from "@/lib/offline-inspection";
import { canManageFacility, canMutateAssets } from "@/lib/permissions";
import { hasPermission } from "@/lib/role-permissions";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Batch save for scans queued while offline. Each entry goes through the same rules as the item form
 * (recordInspectionResult); one bad entry does not stop the others.
 * Codes: invalid / not-found / closed / terminal / forbidden / bad-group are final; "retry" = try again later.
 */
export async function POST(request: NextRequest, { params }: RouteContext) {
  // Same-site only (session cookies are SameSite=Lax; this also rejects cross-site form posts).
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!request.headers.get("content-type")?.includes("application/json")) return NextResponse.json({ error: "JSON only" }, { status: 415 });

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบใหม่" }, { status: 401 });
  if (!canMutateAssets(user) || !(await hasPermission(user.role, "inspection.create"))) {
    return NextResponse.json({ error: "ไม่มีสิทธิ์บันทึกผลตรวจนับ" }, { status: 403 });
  }

  const inspectionId = Number((await params).id);
  if (!Number.isSafeInteger(inspectionId) || inspectionId <= 0) return NextResponse.json({ error: "ไม่พบรอบตรวจนับ" }, { status: 404 });
  const round = await getInspectionById(inspectionId);
  if (!round) return NextResponse.json({ error: "ไม่พบรอบตรวจนับ" }, { status: 404 });
  if (!canManageFacility(user, round.facilityId)) return NextResponse.json({ error: "ไม่มีสิทธิ์ตรวจนับของหน่วยงานนี้" }, { status: 403 });
  if (round.roundStatus === "Closed") return NextResponse.json({ error: "รอบตรวจนับปิดแล้ว ผลที่ค้างอยู่บันทึกไม่ได้", code: "closed" }, { status: 409 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  }
  const parsed = parseBatch(body);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  // Current status of each item is needed for "keep status" scans.
  const outcomes: SyncOutcome[] = [];
  const items = new Map((await getInspectionItems(inspectionId)).map((item) => [item.id, item]));
  for (const entry of parsed.entries) {
    const item = items.get(entry.itemId);
    if (!item) {
      outcomes.push({ clientId: entry.clientId, itemId: entry.itemId, ok: false, code: "not-found", error: "ไม่พบรายการในรอบตรวจนับนี้" });
      continue;
    }
    try {
      await recordInspectionResult(user, {
        inspectionId,
        itemId: entry.itemId,
        inspectionStatus: entry.inspectionStatus,
        assetStatus: entry.assetStatus || item.currentStatus || "Active",
        conditionNote: entry.conditionNote,
        foundWorkGroupId: entry.foundWorkGroupId,
        foundLocation: entry.foundLocation,
        auditNote: `สแกนออฟไลน์ ${entry.scannedAt.slice(0, 19).replace("T", " ")}`,
      });
      outcomes.push({ clientId: entry.clientId, itemId: entry.itemId, ok: true });
    } catch (error) {
      if (error instanceof InspectionResultError) {
        outcomes.push({ clientId: entry.clientId, itemId: entry.itemId, ok: false, code: error.code, error: error.message });
      } else {
        console.error("offline inspection sync failed", error instanceof Error ? error.message : error);
        outcomes.push({ clientId: entry.clientId, itemId: entry.itemId, ok: false, code: "retry", error: "บันทึกไม่สำเร็จ จะลองใหม่อัตโนมัติ" });
      }
    }
  }

  if (outcomes.some((outcome) => outcome.ok)) revalidatePath(`/inspection/${inspectionId}`);
  return NextResponse.json({ ok: true, saved: outcomes.filter((outcome) => outcome.ok).length, results: outcomes });
}
