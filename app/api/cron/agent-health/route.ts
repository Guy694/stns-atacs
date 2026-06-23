import { NextRequest, NextResponse } from "next/server";

import { findOfflineAgentDevices } from "@/lib/agent";
import { notifyTelegramSafe } from "@/lib/telegram";
import { readRequestIp, recordSecurityEvent } from "@/lib/security";

function isAuthorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    await recordSecurityEvent({
      eventType: "cron_unauthorized",
      ipAddress: readRequestIp(req.headers),
      path: req.nextUrl.pathname,
      detail: "Authorization header ไม่ถูกต้อง",
    });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const configuredThreshold = Number(process.env.AGENT_OFFLINE_MINUTES ?? 300);
  const thresholdMinutes = Number.isFinite(configuredThreshold) ? Math.max(5, configuredThreshold) : 300;
  const devices = await findOfflineAgentDevices(thresholdMinutes);

  const results = await Promise.all(
    devices.map((device) =>
      notifyTelegramSafe({
        category: "agent",
        title: "Agent ไม่ส่งสัญญาณตามเวลาที่กำหนด",
        eventKey: `agent-offline:${device.id}:${device.lastSeenAt ?? "never"}`,
        details: {
          เครื่อง: device.hostname ?? `Device #${device.id}`,
          หน่วยงาน: device.facilityName,
          "Agent ID": device.agentUuid,
          "พบล่าสุด": device.lastSeenAt ?? "ไม่เคยส่งสัญญาณ",
          "เกณฑ์ Offline": `${thresholdMinutes} นาที`,
        },
      })
    )
  );

  return NextResponse.json({
    ok: true,
    offlineDevices: devices.length,
    alertsSent: results.filter((result) => result.sent).length,
  });
}
