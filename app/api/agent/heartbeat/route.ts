import { NextRequest, NextResponse } from "next/server";

import { heartbeatAgent } from "@/lib/agent";
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

  let status: string | null = null;
  try {
    const body = (await req.json()) as { status?: string };
    status = body.status?.trim() ?? null;
  } catch {
    status = null;
  }

  try {
    const result = await heartbeatAgent({ agentId, agentKey, status });
    if (result.recovered) {
      await notifyTelegramSafe({
        category: "agent",
        title: "Agent กลับมาออนไลน์",
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
        detail: "Agent heartbeat credentials ไม่ถูกต้อง",
      });
      await notifyTelegramSafe({
        category: "security",
        title: "พยายามส่ง Agent heartbeat ด้วย credentials ที่ไม่ถูกต้อง",
        details: { "Agent ID": agentId, IP: readRequestIp(req.headers) },
      });
      return NextResponse.json({ error: "Agent credentials are invalid" }, { status: 401 });
    }
    return NextResponse.json({ error: "Unable to update heartbeat" }, { status: 500 });
  }
}
