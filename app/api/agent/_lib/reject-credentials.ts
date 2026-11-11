import { NextRequest, NextResponse } from "next/server";

import { agentUuidStatus } from "@/lib/agent";
import { classifyAgentAuthFailure, describeReportingMachine } from "@/lib/agent-auth-failure";
import { todayBangkok } from "@/lib/local-date";
import { readRequestIp, recordSecurityEvent } from "@/lib/security";
import { notifyTelegramSafe } from "@/lib/telegram";

const MESSAGES = {
  "wrong-key": "Agent credentials are invalid",
  retired: "This agent was uninstalled or retired by an administrator",
  unknown: "This agent is not registered on this server",
} as const;

/**
 * 401 for an agent whose id/key were rejected (SEC8). Only a known, active id with a wrong key raises a
 * security alert; retired machines and ids missing from the database (stale agents) are logged quietly,
 * with the reporting machine described so an administrator can find and uninstall it.
 */
export async function rejectAgentCredentials(req: NextRequest, agentId: string, payload: unknown, endpoint: "report" | "heartbeat") {
  const failure = classifyAgentAuthFailure(await agentUuidStatus(agentId));
  const ip = readRequestIp(req.headers);
  const machine = describeReportingMachine(payload);
  const detail = {
    "wrong-key": `Agent ${endpoint}: กุญแจไม่ถูกต้อง · ${machine}`,
    retired: `Agent ที่ถอนการติดตั้งหรือลบออกจากระบบแล้วยังส่ง${endpoint === "report" ? "รายงาน" : " heartbeat"}มา · ${machine}`,
    unknown: `Agent ID นี้ไม่มีในระบบ (ข้อมูลเครื่องถูกลบ) · ${machine}`,
  }[failure.kind];

  await recordSecurityEvent({
    eventType: failure.eventType,
    ipAddress: ip,
    identity: agentId,
    path: req.nextUrl.pathname,
    detail,
    skipBurstAlert: !failure.alertSecurity,
  });

  if (failure.kind === "wrong-key") {
    await notifyTelegramSafe({
      category: "security",
      title: `พยายามส่ง Agent ${endpoint} ด้วยกุญแจที่ไม่ถูกต้อง`,
      details: { "Agent ID": agentId, IP: ip, เครื่อง: machine },
    });
  } else if (failure.kind === "unknown" && endpoint === "report") {
    // Once per agent per day: enough to know a stale agent exists, without an alert every 4 hours.
    await notifyTelegramSafe({
      category: "agent",
      title: "มี Agent ที่ไม่มีในระบบยังส่งข้อมูลมา",
      eventKey: `agent-unknown:${agentId}:${todayBangkok()}`,
      details: { เครื่อง: machine, "Agent ID": agentId, IP: ip, วิธีแก้: "ดูที่ ตั้งค่าระบบ › Agent › Agent ที่ไม่มีในระบบ" },
    });
  }

  return NextResponse.json({ error: MESSAGES[failure.kind], code: failure.code }, { status: 401 });
}
