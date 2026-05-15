import { NextRequest, NextResponse } from "next/server";

import { heartbeatAgent } from "@/lib/agent";

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

  let status: string | null = null;
  try {
    const body = (await req.json()) as { status?: string };
    status = body.status?.trim() ?? null;
  } catch {
    status = null;
  }

  try {
    const result = await heartbeatAgent({ agentId, agentKey, status });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message === "INVALID_AGENT_CREDENTIALS") {
      return NextResponse.json({ error: "Agent credentials are invalid" }, { status: 401 });
    }
    return NextResponse.json({ error: "Unable to update heartbeat" }, { status: 500 });
  }
}
