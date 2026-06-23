import { NextRequest, NextResponse } from "next/server";

import { enrollAgentDevice } from "@/lib/agent";
import { notifyTelegramSafe } from "@/lib/telegram";
import { readRequestIp, recordSecurityEvent } from "@/lib/security";

type EnrollBody = {
  enrollmentToken?: string;
  fingerprint?: string;
  hostname?: string | null;
  agentVersion?: string | null;
};

export async function POST(req: NextRequest) {
  let body: EnrollBody;
  try {
    body = (await req.json()) as EnrollBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const enrollmentToken = body.enrollmentToken?.trim() ?? "";
  const fingerprint = body.fingerprint?.trim() ?? "";

  if (!enrollmentToken) {
    return NextResponse.json({ error: "enrollmentToken is required" }, { status: 400 });
  }
  if (!fingerprint) {
    return NextResponse.json({ error: "fingerprint is required" }, { status: 400 });
  }

  try {
    const result = await enrollAgentDevice({
      enrollmentToken,
      fingerprint,
      hostname: body.hostname,
      agentVersion: body.agentVersion,
    });

    await notifyTelegramSafe({
      category: "agent",
      title: result.wasExisting ? "Agent ลงทะเบียนใหม่บนเครื่องเดิม" : "ติดตั้ง Agent สำเร็จ",
      details: {
        เครื่อง: body.hostname ?? `Device #${result.deviceId}`,
        หน่วยงาน: result.facilityName,
        "Agent ID": result.agentId,
        เวอร์ชัน: body.agentVersion,
      },
    });

    return NextResponse.json({
      ok: true,
      agentId: result.agentId,
      agentKey: result.agentKey,
      facilityId: result.facilityId,
      facilityName: result.facilityName,
      deviceId: result.deviceId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message === "INVALID_ENROLLMENT_TOKEN") {
      await recordSecurityEvent({
        eventType: "agent_invalid_enrollment_token",
        ipAddress: readRequestIp(req.headers),
        identity: body.hostname ?? fingerprint,
        path: req.nextUrl.pathname,
        detail: "Enrollment token ไม่ถูกต้องหรือหมดอายุ",
      });
      await notifyTelegramSafe({
        category: "security",
        title: "พยายามติดตั้ง Agent ด้วย enrollment token ที่ไม่ถูกต้อง",
        details: { เครื่อง: body.hostname, fingerprint, IP: readRequestIp(req.headers) },
      });
      return NextResponse.json({ error: "Enrollment token is invalid or expired" }, { status: 401 });
    }
    if (message === "INVALID_FINGERPRINT") {
      return NextResponse.json({ error: "Fingerprint is invalid" }, { status: 400 });
    }
    return NextResponse.json({ error: "Unable to enroll agent" }, { status: 500 });
  }
}
