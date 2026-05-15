import { NextRequest, NextResponse } from "next/server";

import { reportAgentInventory, type AgentReportPayload } from "@/lib/agent";

function readAgentCredentials(req: NextRequest) {
  const agentId = req.headers.get("x-agent-id")?.trim() ?? "";
  const agentKey = req.headers.get("x-agent-key")?.trim() ?? "";
  return { agentId, agentKey };
}

export async function POST(req: NextRequest) {
  const { agentId, agentKey } = readAgentCredentials(req);
  if (!agentId || !agentKey) {
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
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message === "INVALID_AGENT_CREDENTIALS") {
      return NextResponse.json({ error: "Agent credentials are invalid" }, { status: 401 });
    }
    if (message === "INVALID_FINGERPRINT") {
      return NextResponse.json({ error: "Fingerprint is invalid" }, { status: 400 });
    }
    return NextResponse.json({ error: "Unable to process inventory report" }, { status: 500 });
  }
}
