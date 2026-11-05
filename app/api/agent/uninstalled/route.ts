import { NextRequest, NextResponse } from "next/server";

import { isPlainObject, readLimitedText } from "@/app/api/agent/_lib/request-body";
import { confirmAgentUninstalled } from "@/lib/agent";
import { AGENT_UNINSTALLED_MAX_BYTES, parseAgentUninstalledBody } from "@/lib/agent-uninstall";
import { formatThaiDateTime } from "@/lib/date-format";
import { notifyTelegramSafe } from "@/lib/telegram";
import { readRequestIp, recordSecurityEvent } from "@/lib/security";

/**
 * Agent 2.2.0+ ยืนยันว่ากำลังถอนการติดตั้งตัวเอง (หรือสคริปต์ถอนด้วยมือแจ้งเซิร์ฟเวอร์)
 * ยืนยันด้วย x-agent-id / x-agent-key ของเครื่อง ตอบ 200 แล้วเท่านั้น agent จึงลบตัวเอง
 * หลังจากนี้กุญแจของเครื่องส่งรายงานไม่ได้อีก (401) เรียกซ้ำด้วยกุญแจเดิมได้ผลเดิม (idempotent)
 */
export async function POST(req: NextRequest) {
  const agentId = req.headers.get("x-agent-id")?.trim() ?? "";
  const agentKey = req.headers.get("x-agent-key")?.trim() ?? "";
  const ip = readRequestIp(req.headers);
  if (!agentId || !agentKey) {
    await recordSecurityEvent({
      eventType: "agent_missing_credentials",
      ipAddress: ip,
      identity: agentId || null,
      path: req.nextUrl.pathname,
      detail: "Missing x-agent-id or x-agent-key (uninstalled)",
    });
    return NextResponse.json({ error: "Missing x-agent-id or x-agent-key" }, { status: 401 });
  }

  // body เล็กมาก ({ reason, requestedAt }) — ไม่ส่ง body เลยก็ได้
  let read: Awaited<ReturnType<typeof readLimitedText>>;
  try {
    read = await readLimitedText(req, AGENT_UNINSTALLED_MAX_BYTES);
  } catch {
    return NextResponse.json({ error: "Unable to read request body" }, { status: 400 });
  }
  if (!read.ok) return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  let body: unknown = {};
  if (read.text.trim()) {
    try {
      body = JSON.parse(read.text) as unknown;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    if (!isPlainObject(body)) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { reason } = parseAgentUninstalledBody(body);

  try {
    const result = await confirmAgentUninstalled({ agentId, agentKey, reason });
    if (result.outcome === "invalid") {
      await recordSecurityEvent({
        eventType: "agent_invalid_credentials",
        ipAddress: ip,
        identity: agentId,
        path: req.nextUrl.pathname,
        detail: "Agent uninstall confirmation credentials ไม่ถูกต้อง",
      });
      return NextResponse.json({ error: "Agent credentials are invalid" }, { status: 401 });
    }
    if (result.outcome === "not-requested") {
      // ผู้ดูแลยกเลิกคำสั่งไปแล้ว: agent ต้องไม่ลบตัวเอง
      return NextResponse.json(
        { error: "No uninstall request is pending for this agent", code: "UNINSTALL_NOT_REQUESTED" },
        { status: 409 }
      );
    }
    if (result.outcome === "already") {
      return NextResponse.json({ ok: true, uninstalled: true, alreadyUninstalled: true, deviceId: result.deviceId });
    }

    const detail = `Device #${result.deviceId} ${result.hostname ?? "-"} · ${result.facilityName}`
      + (reason === "manual" ? " · ถอนด้วยสคริปต์ที่เครื่อง" : ` · สั่งโดย ${result.requestedBy ?? "-"}`);
    await recordSecurityEvent({
      eventType: "agent_uninstalled",
      ipAddress: ip,
      identity: agentId,
      path: req.nextUrl.pathname,
      detail,
      skipBurstAlert: true,
    });
    await notifyTelegramSafe({
      category: "agent",
      title: reason === "manual" ? "ถอนการติดตั้ง Agent ด้วยมือแล้ว" : "Agent ถอนการติดตั้งตัวเองตามคำสั่งแล้ว",
      eventKey: `agent-uninstalled:${result.deviceId}:${result.agentUuid}`,
      details: {
        เครื่อง: result.hostname ?? `Device #${result.deviceId}`,
        หน่วยงาน: result.facilityName,
        "Agent ID": result.agentUuid,
        เวอร์ชัน: result.agentVersion ?? "-",
        ...(reason === "remote"
          ? { "สั่งโดย": result.requestedBy ?? "-", "สั่งเมื่อ": formatThaiDateTime(result.requestedAt, "-") }
          : { วิธี: "สคริปต์ uninstall-atacs-agent ที่เครื่อง" }),
        IP: ip,
      },
    });
    return NextResponse.json({ ok: true, uninstalled: true, deviceId: result.deviceId });
  } catch (error) {
    console.error("[agent-uninstalled] unable to confirm uninstall", error);
    return NextResponse.json({ error: "Unable to record the uninstall" }, { status: 500 });
  }
}
