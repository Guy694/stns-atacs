import { NextRequest, NextResponse } from "next/server";

import { reportAgentInventory, type AgentReportPayload } from "@/lib/agent";
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

  let payload: AgentReportPayload;
  try {
    payload = (await req.json()) as AgentReportPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!payload.fingerprint?.trim()) {
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
    return NextResponse.json({ ok: true, ...result });
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
    if (process.env.NODE_ENV !== "production") {
      return NextResponse.json({ error: "Unable to process inventory report", detail: message }, { status: 500 });
    }
    return NextResponse.json({ error: "Unable to process inventory report" }, { status: 500 });
  }
}
