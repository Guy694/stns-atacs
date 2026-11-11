import { NextRequest, NextResponse } from "next/server";

import { rejectAgentCredentials } from "@/app/api/agent/_lib/reject-credentials";

import { INVALID, isPlainObject, optionalString, readJsonBody } from "@/app/api/agent/_lib/request-body";
import { heartbeatAgent } from "@/lib/agent";
import { notifyTelegramSafe } from "@/lib/telegram";
import { readRequestIp, recordSecurityEvent } from "@/lib/security";

const HEARTBEAT_BODY_MAX_BYTES = 4 * 1024;

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

  // G11: body ของ heartbeat มีแค่ { status } — จำกัดขนาด และไม่ล้มเมื่อชนิดผิด (ไม่มี body ก็ใช้ได้เหมือนเดิม)
  let status: string | null = null;
  const parsed = await readJsonBody(req, HEARTBEAT_BODY_MAX_BYTES);
  if (!parsed.ok && parsed.status === 413) {
    return NextResponse.json({ error: parsed.error }, { status: 413 });
  }
  if (parsed.ok && isPlainObject(parsed.value)) {
    const value = optionalString(parsed.value.status);
    if (value === INVALID) {
      return NextResponse.json({ error: "status has an invalid type" }, { status: 400 });
    }
    status = value?.trim() || null;
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
      return rejectAgentCredentials(req, agentId, null, "heartbeat");
    }
    return NextResponse.json({ error: "Unable to update heartbeat" }, { status: 500 });
  }
}
