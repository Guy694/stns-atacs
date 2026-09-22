"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { cancelDisposalRequest, createDisposalRequest, decideDisposalRequest, getDisposalRequest, recordDisposalExecution } from "@/lib/asset-disposals";
import { isTerminalAssetStatus } from "@/lib/asset-status";
import { recordAssetStatusHistory } from "@/lib/asset-status-history";
import { valueAsset } from "@/lib/asset-valuation";
import { getCurrentUser } from "@/lib/auth";
import { getAssetById, updateAsset } from "@/lib/assets";
import { writeAuditLog } from "@/lib/audit";
import { canManageAsset, canMutateAssets } from "@/lib/permissions";
import { hasPermission } from "@/lib/role-permissions";
import { friendlyLifecycleError } from "@/lib/schema-errors";
import { getInspectionById, getInspectionItems } from "@/lib/inspection";
import { itemOutcome } from "@/lib/inspection-report";
import { canManageFacility } from "@/lib/permissions";
import { notifyTelegramSafe } from "@/lib/telegram";
import { DISPOSAL_REQUEST_TYPE_LABELS, disposalMethodLabel, isDisposalMethod } from "@/lib/disposal-options";

export type DisposalType = "Broken" | "Inactive" | "Disposed" | "Lost";

const text = (fd: FormData, key: string) => (fd.get(key) as string | null)?.trim() ?? "";

function revalidateAsset(assetId: number, facilityId?: number) {
  revalidatePath("/assets");
  revalidatePath(`/assets/${assetId}`);
  revalidatePath("/disposal");
  revalidatePath("/reports");
  if (facilityId) revalidatePath(`/facilities/${facilityId}`);
  revalidatePath("/");
}

/**
 * Broken/Inactive are operational and apply immediately.
 * Disposed/Lost create a request; only an approver can change the asset to those statuses.
 */
export async function disposalAssetAction(_prev: string | null, fd: FormData): Promise<string | null> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canMutateAssets(user)) return "คุณไม่มีสิทธิ์ดำเนินการนี้";
  if (!(await hasPermission(user.role, "disposal.manage"))) return "สิทธิ์การจำหน่าย/ชำรุดถูกปิดใช้งาน";

  const assetId = Number(fd.get("assetId"));
  const disposalType = text(fd, "disposalType") as DisposalType;
  const reason = text(fd, "reason");
  const noteDate = text(fd, "noteDate") || new Date().toISOString().slice(0, 10);

  if (!Number.isSafeInteger(assetId) || assetId <= 0) return "ไม่พบ ID ทรัพย์สิน";
  if (!["Broken", "Inactive", "Disposed", "Lost"].includes(disposalType)) return "กรุณาเลือกประเภทการดำเนินการ";
  if (!reason) return "กรุณาระบุเหตุผล";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(noteDate) || noteDate > new Date().toISOString().slice(0, 10)) return "วันที่ไม่ถูกต้องหรือเกินวันที่ปัจจุบัน";

  let redirectTo = `/assets/${assetId}`;
  try {
    const asset = await getAssetById(assetId);
    if (!asset) return "ไม่พบทรัพย์สิน";
    if (!canManageAsset(user, asset.facilityId)) return "คุณไม่มีสิทธิ์บันทึกการดำเนินการทรัพย์สินของหน่วยงานนี้";
    if (isTerminalAssetStatus(asset.currentStatus)) return "ทรัพย์สินนี้จำหน่ายหรือบันทึกสูญหายแล้ว";

    if (disposalType === "Disposed" || disposalType === "Lost") {
      const valuation = valueAsset({ ...asset, subtypeName: asset.extensions[asset.assetClass]?.subtypeName }, noteDate);
      const result = await createDisposalRequest({
        assetId,
        requestType: disposalType,
        disposalMethod: text(fd, "disposalMethod") || null,
        reason,
        eventDate: noteDate,
        bookValue: valuation.status === "ok" || valuation.status === "below-threshold" ? valuation.bookValue : null,
        factFindingNote: disposalType === "Lost" ? text(fd, "factFindingNote") : null,
        userId: user.id,
        userName: user.fullName,
      });
      await writeAuditLog({ userId: user.id, userName: user.fullName, action: "dispose", entity: "asset_disposal_requests", entityId: result.requestId, summary: result.note });
      await notifyTelegramSafe({
        category: "lifecycle",
        title: `คำขอ${DISPOSAL_REQUEST_TYPE_LABELS[disposalType]} #${result.requestId} รออนุมัติ`,
        eventKey: `disposal-request:${result.requestId}`,
        details: {
          หน่วยงาน: asset.facilityName,
          ครุภัณฑ์: [asset.assetNumber, asset.assetName].filter(Boolean).join(" "),
          วิธีจำหน่าย: disposalType === "Disposed" ? disposalMethodLabel(text(fd, "disposalMethod")) : null,
          เหตุผล: reason,
          ผู้เสนอ: user.fullName,
        },
      });
      redirectTo = `/disposal?requestId=${result.requestId}`;
    } else {
      const label = disposalType === "Broken" ? "บันทึกชำรุด" : "ระงับการใช้งาน";
      const note = `[${label}] ${noteDate} — ${reason}`;
      // usage_description keeps the user's own description; the event is kept in status history.
      await updateAsset(assetId, { currentStatus: disposalType, updatedBy: user.fullName, lastUpdatedAt: new Date().toISOString().slice(0, 10) });
      await recordAssetStatusHistory({ assetId, fromStatus: asset.currentStatus, toStatus: disposalType, note, changedByUserId: user.id, changedBy: user.fullName });
      await writeAuditLog({ userId: user.id, userName: user.fullName, action: "dispose", entity: "information_assets", entityId: assetId, summary: note });
    }
    revalidateAsset(assetId, asset.facilityId);
  } catch (err) {
    return friendlyLifecycleError(err);
  }

  redirect(redirectTo);
}

export async function decideDisposalAction(_prev: string | null, fd: FormData): Promise<string | null> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canMutateAssets(user) || !(await hasPermission(user.role, "disposal.approve"))) return "คุณไม่มีสิทธิ์อนุมัติคำขอจำหน่าย";

  const requestId = Number(fd.get("requestId"));
  const decision = text(fd, "decision");
  if (!Number.isSafeInteger(requestId) || requestId <= 0) return "ไม่พบคำขอ";
  if (decision !== "Approved" && decision !== "Rejected") return "กรุณาเลือกผลการพิจารณา";
  const proceedsRaw = text(fd, "proceedsAmount").replace(/,/g, "");
  const proceedsAmount = proceedsRaw ? Number(proceedsRaw) : null;
  if (proceedsAmount !== null && (!Number.isFinite(proceedsAmount) || proceedsAmount < 0)) return "จำนวนเงินที่ได้รับต้องเป็นตัวเลขไม่ติดลบ";

  try {
    const request = await getDisposalRequest(requestId);
    if (!request) return "ไม่พบคำขอ";
    if (!canManageAsset(user, request.facilityId)) return "คุณไม่มีสิทธิ์พิจารณาคำขอของหน่วยงานนี้";
    const result = await decideDisposalRequest({
      requestId,
      decision,
      note: text(fd, "decisionNote"),
      approvalDocumentNo: text(fd, "approvalDocumentNo"),
      proceedsAmount,
      userId: user.id,
      userName: user.fullName,
    });
    await writeAuditLog({ userId: user.id, userName: user.fullName, action: "dispose", entity: "asset_disposal_requests", entityId: requestId, summary: result.note });
    revalidateAsset(result.assetId, result.facilityId);
    await notifyTelegramSafe({
      category: "lifecycle",
      title: `${decision === "Approved" ? "อนุมัติ" : "ไม่อนุมัติ"}คำขอ${DISPOSAL_REQUEST_TYPE_LABELS[request.requestType]} #${requestId}`,
      eventKey: `disposal-decision:${requestId}`,
      details: {
        หน่วยงาน: request.facilityName,
        ครุภัณฑ์: [request.assetRegistrationNo, request.assetName].filter(Boolean).join(" "),
        หนังสืออนุมัติ: text(fd, "approvalDocumentNo") || null,
        หมายเหตุ: text(fd, "decisionNote") || null,
        ผู้พิจารณา: user.fullName,
      },
    });
  } catch (err) {
    return friendlyLifecycleError(err);
  }
  redirect(`/disposal?requestId=${requestId}`);
}

/** Records the actual sale/exchange/transfer/destruction of an approved disposal. */
export async function recordExecutionAction(_prev: string | null, fd: FormData): Promise<string | null> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canMutateAssets(user)) return "คุณไม่มีสิทธิ์ดำเนินการนี้";
  const [canRequest, canApprove] = await Promise.all([hasPermission(user.role, "disposal.manage"), hasPermission(user.role, "disposal.approve")]);
  if (!canRequest && !canApprove) return "คุณไม่มีสิทธิ์บันทึกผลการจำหน่าย";
  const requestId = Number(fd.get("requestId"));
  if (!Number.isSafeInteger(requestId) || requestId <= 0) return "ไม่พบคำขอ";
  const proceedsRaw = text(fd, "proceedsAmount").replace(/,/g, "");
  const proceedsAmount = proceedsRaw ? Number(proceedsRaw) : null;
  if (proceedsAmount !== null && (!Number.isFinite(proceedsAmount) || proceedsAmount < 0)) return "จำนวนเงินที่ได้รับต้องเป็นตัวเลขไม่ติดลบ";
  try {
    const request = await getDisposalRequest(requestId);
    if (!request) return "ไม่พบคำขอ";
    if (!canManageAsset(user, request.facilityId)) return "คุณไม่มีสิทธิ์บันทึกผลของหน่วยงานนี้";
    const result = await recordDisposalExecution({
      requestId,
      executedOn: text(fd, "executedOn"),
      documentNo: text(fd, "executionDocumentNo"),
      proceedsAmount,
      note: text(fd, "executionNote"),
      userId: user.id,
      userName: user.fullName,
    });
    await writeAuditLog({ userId: user.id, userName: user.fullName, action: "dispose", entity: "asset_disposal_requests", entityId: requestId, summary: result.note });
    revalidateAsset(result.assetId, result.facilityId);
  } catch (err) {
    return friendlyLifecycleError(err).replace("add_asset_lifecycle.sql", "add_registry_completeness.sql");
  }
  redirect(`/disposal?requestId=${requestId}`);
}

export async function cancelDisposalAction(_prev: string | null, fd: FormData): Promise<string | null> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canMutateAssets(user)) return "คุณไม่มีสิทธิ์ดำเนินการนี้";
  const requestId = Number(fd.get("requestId"));
  if (!Number.isSafeInteger(requestId) || requestId <= 0) return "ไม่พบคำขอ";
  try {
    const request = await getDisposalRequest(requestId);
    if (!request) return "ไม่พบคำขอ";
    if (!canManageAsset(user, request.facilityId)) return "คุณไม่มีสิทธิ์ยกเลิกคำขอของหน่วยงานนี้";
    const canCancelOthers = await hasPermission(user.role, "disposal.approve");
    const result = await cancelDisposalRequest({ requestId, userId: user.id, userName: user.fullName, canCancelOthers });
    await writeAuditLog({ userId: user.id, userName: user.fullName, action: "dispose", entity: "asset_disposal_requests", entityId: requestId, summary: `ยกเลิกคำขอ #${requestId}` });
    revalidateAsset(result.assetId, result.facilityId);
  } catch (err) {
    return friendlyLifecycleError(err);
  }
  redirect(`/disposal?requestId=${requestId}`);
}

export type BulkDisposalResult = { ok: boolean; message: string; created: number[]; skipped: string[] } | null;

/**
 * Creates one disposal request per selected item from an inspection's findings:
 * broken / unused → จำหน่าย (with the chosen method), not found → สูญหาย.
 * Outcomes are re-read on the server; the browser only sends which assets were ticked.
 */
export async function bulkDisposalFromInspectionAction(_prev: BulkDisposalResult, fd: FormData): Promise<BulkDisposalResult> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canMutateAssets(user) || !(await hasPermission(user.role, "disposal.manage"))) return { ok: false, message: "คุณไม่มีสิทธิ์เสนอจำหน่าย", created: [], skipped: [] };

  const inspectionId = Number(fd.get("inspectionId"));
  const inspection = Number.isSafeInteger(inspectionId) && inspectionId > 0 ? await getInspectionById(inspectionId) : null;
  if (!inspection) return { ok: false, message: "ไม่พบรอบตรวจนับ", created: [], skipped: [] };
  if (!canManageFacility(user, inspection.facilityId)) return { ok: false, message: "คุณไม่มีสิทธิ์จัดการรอบตรวจนับของหน่วยงานนี้", created: [], skipped: [] };

  const selected = new Set(fd.getAll("assetIds").map((value) => Number(value)).filter((id) => Number.isSafeInteger(id) && id > 0));
  if (!selected.size) return { ok: false, message: "กรุณาเลือกรายการอย่างน้อย 1 รายการ", created: [], skipped: [] };
  const method = text(fd, "disposalMethod");
  const reason = text(fd, "reason");
  const eventDate = text(fd, "eventDate") || new Date().toISOString().slice(0, 10);
  if (!reason) return { ok: false, message: "กรุณาระบุเหตุผล", created: [], skipped: [] };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate) || eventDate > new Date().toISOString().slice(0, 10)) return { ok: false, message: "วันที่ไม่ถูกต้องหรือเกินวันที่ปัจจุบัน", created: [], skipped: [] };

  const items = (await getInspectionItems(inspectionId)).filter((item) => selected.has(item.assetId));
  const needsMethod = items.some((item) => ["broken", "unused"].includes(itemOutcome({ ...item, inspectionAssetStatus: item.assetStatus })));
  if (needsMethod && !isDisposalMethod(method)) return { ok: false, message: "กรุณาเลือกวิธีการจำหน่ายสำหรับรายการชำรุด/เสื่อมสภาพ", created: [], skipped: [] };

  const created: number[] = [];
  const skipped: string[] = [];
  for (const item of items) {
    const label = item.assetNumber || item.assetName;
    const outcome = itemOutcome({ ...item, inspectionAssetStatus: item.assetStatus });
    if (!["broken", "unused", "missing"].includes(outcome)) { skipped.push(`${label}: ผลตรวจไม่ใช่ชำรุด/เสื่อมสภาพ/ไม่พบ`); continue; }
    try {
      const asset = await getAssetById(item.assetId);
      if (!asset) { skipped.push(`${label}: ไม่พบทรัพย์สิน`); continue; }
      if (!canManageAsset(user, asset.facilityId)) { skipped.push(`${label}: ไม่มีสิทธิ์`); continue; }
      const requestType = outcome === "missing" ? "Lost" : "Disposed";
      const valuation = valueAsset({ ...asset, subtypeName: asset.extensions[asset.assetClass]?.subtypeName }, eventDate);
      const result = await createDisposalRequest({
        assetId: item.assetId,
        requestType,
        disposalMethod: requestType === "Disposed" ? method : null,
        reason: `${reason} (จากรอบตรวจนับ ${inspection.roundName}: ${outcome === "missing" ? "ไม่พบ" : outcome === "broken" ? "ชำรุด" : "เสื่อมสภาพ/ไม่ใช้งาน"})`,
        eventDate,
        bookValue: valuation.status === "ok" || valuation.status === "below-threshold" ? valuation.bookValue : null,
        userId: user.id,
        userName: user.fullName,
      });
      created.push(result.requestId);
      await writeAuditLog({ userId: user.id, userName: user.fullName, action: "dispose", entity: "asset_disposal_requests", entityId: result.requestId, summary: result.note });
      revalidatePath(`/assets/${item.assetId}`);
    } catch (error) {
      skipped.push(`${label}: ${friendlyLifecycleError(error)}`);
    }
  }
  revalidatePath("/disposal");
  revalidatePath(`/inspection/${inspectionId}`);
  if (created.length) {
    await notifyTelegramSafe({
      category: "lifecycle",
      title: `คำขอจำหน่าย/สูญหายจากผลตรวจนับ ${created.length} รายการ รออนุมัติ`,
      eventKey: `disposal-bulk:${created.join(",").slice(0, 180)}`,
      details: { หน่วยงาน: inspection.facilityName, รอบตรวจนับ: inspection.roundName, คำขอ: created.map((id) => `#${id}`).join(" "), ผู้เสนอ: user.fullName },
    });
  }
  return {
    ok: created.length > 0,
    message: created.length ? `สร้างคำขอ ${created.length} รายการ รอผู้มีสิทธิ์อนุมัติที่เมนูจำหน่ายและเหตุผิดปกติ` : "ไม่ได้สร้างคำขอ",
    created,
    skipped,
  };
}
