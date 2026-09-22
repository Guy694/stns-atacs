import "server-only";

import { isTerminalAssetStatus, OPERATIONAL_ASSET_STATUSES } from "@/lib/asset-status";
import { recordAssetStatusHistory } from "@/lib/asset-status-history";
import { updateAsset } from "@/lib/assets";
import { writeAuditLog } from "@/lib/audit";
import { listFacilityWorkGroups } from "@/lib/facility-work-groups";
import { getInspectionById, getInspectionItemContext, updateInspectionItem } from "@/lib/inspection";
import { canManageFacility } from "@/lib/permissions";

/**
 * Records one inspection result. Shared by the item form (server action) and the offline batch sync
 * (/api/inspection/[id]/results) so both apply the same checks and side effects:
 * round open, asset not disposed/lost, facility permission, work group of this facility,
 * optional register update to where it was found, status change + history, audit log.
 * Role permissions (inspection.create, not a viewer) are checked by the callers.
 */
export type InspectionResultActor = {
  id: number;
  fullName: string;
  role: "admin" | "officer" | "viewer";
  facilityId?: number | null;
  managedAssetFacilityIds?: number[];
};

export type InspectionResultInput = {
  itemId: number;
  inspectionStatus: string;
  assetStatus: string;
  conditionNote?: string;
  /** undefined = the form did not ask; null = found, no work group; number = work group where found. */
  foundWorkGroupId?: number | null;
  foundLocation?: string;
  updateRegistry?: boolean;
  /** When set (batch sync), the item must belong to this round. */
  inspectionId?: number;
  /** Written into the audit summary, e.g. the time a queued offline scan was made. */
  auditNote?: string;
};

export type InspectionResultErrorCode = "invalid" | "not-found" | "closed" | "terminal" | "forbidden" | "bad-group";

export class InspectionResultError extends Error {
  constructor(public code: InspectionResultErrorCode, message: string, public inspectionId?: number) {
    super(message);
    this.name = "InspectionResultError";
  }
}

const VALID_ASSET_STATUSES = new Set<string>(OPERATIONAL_ASSET_STATUSES);

export async function recordInspectionResult(user: InspectionResultActor, input: InspectionResultInput) {
  const itemId = Number(input.itemId);
  const inspectionStatus = String(input.inspectionStatus ?? "").trim();
  const assetStatus = String(input.assetStatus ?? "").trim();
  const conditionNote = String(input.conditionNote ?? "").trim().slice(0, 2000);
  if (!Number.isSafeInteger(itemId) || itemId <= 0 || (inspectionStatus !== "Found" && inspectionStatus !== "Missing") || !VALID_ASSET_STATUSES.has(assetStatus)) {
    throw new InspectionResultError("invalid", "ข้อมูลผลตรวจไม่ถูกต้อง");
  }

  const item = await getInspectionItemContext(itemId);
  if (!item || (input.inspectionId !== undefined && item.inspectionId !== input.inspectionId)) {
    throw new InspectionResultError("not-found", "ไม่พบรายการในรอบตรวจนับนี้");
  }
  const round = await getInspectionById(item.inspectionId);
  if (round?.roundStatus === "Closed") throw new InspectionResultError("closed", "รอบตรวจนับปิดแล้ว", item.inspectionId);
  if (isTerminalAssetStatus(item.currentStatus)) throw new InspectionResultError("terminal", "ครุภัณฑ์จำหน่าย/สูญหายแล้ว", item.inspectionId);
  if (!canManageFacility(user, item.facilityId)) throw new InspectionResultError("forbidden", "ไม่มีสิทธิ์ตรวจนับของหน่วยงานนี้", item.inspectionId);

  let foundWorkGroupId = input.foundWorkGroupId;
  let foundWorkGroupName = "";
  const foundLocation = String(input.foundLocation ?? "").trim().slice(0, 255);
  if (foundWorkGroupId !== undefined && foundWorkGroupId !== null) {
    foundWorkGroupId = Number(foundWorkGroupId);
    const groups = await listFacilityWorkGroups(item.facilityId);
    const group = groups.find((entry) => entry.id === foundWorkGroupId);
    // The registered group is accepted even if it was deactivated since.
    if (!group && foundWorkGroupId !== item.workGroupId) throw new InspectionResultError("bad-group", "กลุ่มงานไม่ใช่ของหน่วยงานนี้", item.inspectionId);
    foundWorkGroupName = group?.workGroupName ?? "";
  }

  await updateInspectionItem({
    itemId,
    inspectionStatus,
    assetStatus,
    conditionNote,
    checkedBy: user.fullName,
    foundWorkGroupId,
    foundLocation,
    registeredWorkGroupId: item.workGroupId,
  });

  const today = new Date().toISOString().slice(0, 10);
  // Optionally move the register to where it was found (otherwise the difference is only reported).
  const moved = inspectionStatus === "Found" && foundWorkGroupId !== undefined &&
    ((foundWorkGroupId !== null && foundWorkGroupId !== item.workGroupId) || (foundLocation !== "" && foundLocation !== item.locationDetail));
  const foundText = [foundWorkGroupName, foundLocation].filter(Boolean).join(" ");
  if (moved && input.updateRegistry) {
    await updateAsset(item.assetId, {
      ...(foundWorkGroupId !== null && foundWorkGroupId !== item.workGroupId ? { workGroupId: foundWorkGroupId } : {}),
      ...(foundLocation ? { locationDetail: foundLocation } : {}),
      updatedBy: user.fullName,
      lastUpdatedAt: today,
    });
    await recordAssetStatusHistory({
      assetId: item.assetId,
      fromStatus: item.currentStatus,
      toStatus: item.currentStatus ?? "Active",
      note: `[ปรับที่ตั้งตามผลตรวจนับ #${item.inspectionId}] พบที่ ${foundText || "-"}`,
      changedByUserId: user.id,
      changedBy: user.fullName,
    });
  }

  const statusChanged = (item.currentStatus ?? "") !== assetStatus;
  if (statusChanged) {
    await updateAsset(item.assetId, { currentStatus: assetStatus, updatedBy: user.fullName, lastUpdatedAt: today });
    await recordAssetStatusHistory({
      assetId: item.assetId,
      fromStatus: item.currentStatus,
      toStatus: assetStatus,
      note: conditionNote || `อัปเดตจากรอบตรวจนับ #${item.inspectionId}`,
      changedByUserId: user.id,
      changedBy: user.fullName,
    });
  }

  await writeAuditLog({
    userId: user.id,
    userName: user.fullName,
    action: "inspect",
    entity: "asset_inspection_items",
    entityId: itemId,
    summary: `ตรวจครุภัณฑ์ ${item.assetId}: ${inspectionStatus}, สถานะ ${assetStatus}${moved ? `, พบที่ ${foundText}` : ""}${input.auditNote ? ` (${input.auditNote})` : ""}`,
  });

  return { inspectionId: item.inspectionId, assetId: item.assetId, moved, statusChanged };
}
