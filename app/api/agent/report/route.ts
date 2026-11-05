import { NextRequest, NextResponse } from "next/server";

import { isPlainObject, readJsonBody } from "@/app/api/agent/_lib/request-body";
import { AgentLinkedAssetError, reportAgentInventory, type AgentReportPayload } from "@/lib/agent";
import { announcedApiBaseUrl } from "@/lib/agent-api-base";
import { AGENT_REPORT_MAX_BYTES } from "@/lib/agent-payload";
import { notifyTelegramSafe } from "@/lib/telegram";
import { readRequestIp, recordSecurityEvent } from "@/lib/security";

function readAgentCredentials(req: NextRequest) {
  const agentId = req.headers.get("x-agent-id")?.trim() ?? "";
  const agentKey = req.headers.get("x-agent-key")?.trim() ?? "";
  return { agentId, agentKey };
}

export async function POST(req: NextRequest) {
  const { agentId, agentKey } = readAgentCredentials(req);
  if (!agentId || !agentKey) {
    await recordSecurityEvent({
      eventType: "agent_missing_credentials",
      ipAddress: readRequestIp(req.headers),
      identity: agentId || null,
      path: req.nextUrl.pathname,
      detail: "Missing x-agent-id or x-agent-key",
    });
    return NextResponse.json({ error: "Missing x-agent-id or x-agent-key" }, { status: 401 });
  }

  // SEC-15/G12: จำกัดขนาด body ขณะอ่านแบบ stream (รายงานปกติไม่เกินไม่กี่สิบ KB)
  // ตรวจ content-length อย่างเดียวไม่พอ — chunked encoding ไม่มี header นี้
  const parsed = await readJsonBody(req, AGENT_REPORT_MAX_BYTES);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  }
  const payload = parsed.value as AgentReportPayload;

  if (!isPlainObject(payload) || typeof payload.fingerprint !== "string" || !payload.fingerprint.trim()) {
    return NextResponse.json({ error: "fingerprint is required" }, { status: 400 });
  }

  try {
    const result = await reportAgentInventory({ agentId, agentKey, payload });
    if (result.recovered) {
      await notifyTelegramSafe({
        category: "agent",
        title: "Agent กลับมาออนไลน์และส่งข้อมูลแล้ว",
        details: {
          เครื่อง: result.hostname ?? `Device #${result.deviceId}`,
          หน่วยงาน: result.facilityName,
          "Agent ID": result.agentUuid,
        },
      });
    }
    const apiBaseUrl = announcedApiBaseUrl();
    return NextResponse.json({ ok: true, ...result, ...(apiBaseUrl ? { apiBaseUrl } : {}) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message === "INVALID_AGENT_CREDENTIALS") {
      await recordSecurityEvent({
        eventType: "agent_invalid_credentials",
        ipAddress: readRequestIp(req.headers),
        identity: agentId,
        path: req.nextUrl.pathname,
        detail: "Agent inventory credentials ไม่ถูกต้อง",
      });
      await notifyTelegramSafe({
        category: "security",
        title: "พยายามส่ง Agent inventory ด้วย credentials ที่ไม่ถูกต้อง",
        details: { "Agent ID": agentId, IP: readRequestIp(req.headers) },
      });
      return NextResponse.json({ error: "Agent credentials are invalid" }, { status: 401 });
    }
    if (message === "INVALID_FINGERPRINT") {
      return NextResponse.json({ error: "Fingerprint is invalid" }, { status: 400 });
    }
    if (error instanceof AgentLinkedAssetError) {
      // G10: บันทึกว่าเครื่องออนไลน์แล้ว แต่ทะเบียนที่ผูกไว้ใช้ไม่ได้ (ย้าย/เปลี่ยนประเภท/ลบ) — ให้ผู้ดูแลแก้การผูก
      const detail = error.linkedAssetId
        ? `ทะเบียน #${error.linkedAssetId}: ${error.reason}`
        : error.reason;
      await recordSecurityEvent({
        eventType: "agent_linked_asset_invalid",
        ipAddress: readRequestIp(req.headers),
        identity: agentId,
        path: req.nextUrl.pathname,
        detail,
      });
      await notifyTelegramSafe({
        category: "agent",
        title: "Agent ส่งข้อมูลได้ แต่ทะเบียนที่ผูกไว้ใช้ไม่ได้แล้ว",
        eventKey: `agent-linked-asset-invalid:${agentId}:${error.linkedAssetId ?? "registration"}`,
        details: {
          "Agent ID": agentId,
          ปัญหา: detail,
          แก้ไข: "ผูกทะเบียนใหม่หรือยกเลิกการผูกที่ ตั้งค่าระบบ › Agent",
        },
      });
      return NextResponse.json(
        {
          error: `Linked asset is no longer valid for this agent (${detail}). The heartbeat was recorded; an administrator must re-link or unlink the device. / ทะเบียนที่ผูกกับ Agent นี้ใช้ไม่ได้แล้ว (${detail}) บันทึกสถานะเครื่องแล้ว กรุณาให้ผู้ดูแลผูกทะเบียนใหม่หรือยกเลิกการผูก`,
          code: "LINKED_ASSET_INVALID",
          linkedAssetId: error.linkedAssetId,
        },
        { status: 409 }
      );
    }
    if (process.env.NODE_ENV !== "production") {
      return NextResponse.json({ error: "Unable to process inventory report", detail: message }, { status: 500 });
    }
    return NextResponse.json({ error: "Unable to process inventory report" }, { status: 500 });
  }
}
