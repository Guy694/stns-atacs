import { NextRequest, NextResponse } from "next/server";

import { enrollAgentDevice, enrollAgentDeviceWithInstallKey } from "@/lib/agent";
import { isAgentInstallKeyConfigured, verifyAgentInstallKey } from "@/lib/agent-install-key";
import { notifyTelegramSafe } from "@/lib/telegram";
import { consumeRateLimit } from "@/lib/rate-limit";
import { readRequestIp, recordSecurityEvent } from "@/lib/security";

type EnrollBody = {
  enrollmentToken?: string;
  installKey?: string;
  facilityId?: number | string;
  workGroupId?: number | string | null;
  workGroupName?: string | null;
  fingerprint?: string;
  hostname?: string | null;
  agentVersion?: string | null;
};

/** SEC-03: จำกัดจำนวนครั้งที่ลงทะเบียน Agent ได้ต่อ IP กัน enroll เครื่องปลอมจำนวนมาก */
const ENROLL_LIMIT_PER_IP = 10;
const ENROLL_WINDOW_MS = 10 * 60 * 1000;

export async function POST(req: NextRequest) {
  const clientIp = readRequestIp(req.headers) ?? "unknown";
  const rate = consumeRateLimit(`agent-enroll:${clientIp}`, ENROLL_LIMIT_PER_IP, ENROLL_WINDOW_MS);
  if (!rate.allowed) {
    await recordSecurityEvent({
      eventType: "agent_enroll_rate_limited",
      ipAddress: clientIp,
      identity: null,
      path: req.nextUrl.pathname,
      detail: `เกิน ${ENROLL_LIMIT_PER_IP} ครั้งใน ${ENROLL_WINDOW_MS / 60000} นาที`,
    });
    return NextResponse.json(
      { error: "Too many enrollment attempts" },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
    );
  }

  let body: EnrollBody;
  try {
    body = (await req.json()) as EnrollBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const enrollmentToken = body.enrollmentToken?.trim() ?? "";
  const installKey = body.installKey?.trim() ?? "";
  const facilityId = Number(body.facilityId ?? 0);
  const workGroupId = Number(body.workGroupId ?? 0);
  const fingerprint = body.fingerprint?.trim() ?? "";

  if (!fingerprint) {
    return NextResponse.json({ error: "fingerprint is required" }, { status: 400 });
  }

  const usesStaticInstall = !enrollmentToken;
  if (usesStaticInstall) {
    if (!installKey) {
      return NextResponse.json({ error: "enrollmentToken or installKey is required" }, { status: 400 });
    }
    if (!facilityId || !Number.isInteger(facilityId)) {
      return NextResponse.json({ error: "facilityId is required for installKey enrollment" }, { status: 400 });
    }
    if (!isAgentInstallKeyConfigured()) {
      return NextResponse.json({ error: "Static agent install key is not configured" }, { status: 503 });
    }
    // SEC-03: คีย์ที่ผูกกับหน่วยงานหนึ่ง จะใช้ลงทะเบียนให้หน่วยงานอื่นไม่ได้
    if (!verifyAgentInstallKey(installKey, facilityId)) {
      await recordSecurityEvent({
        eventType: "agent_invalid_install_key",
        ipAddress: readRequestIp(req.headers),
        identity: body.hostname ?? fingerprint,
        path: req.nextUrl.pathname,
        detail: `Install key ไม่ถูกต้องสำหรับ facility_id=${facilityId}`,
      });
      await notifyTelegramSafe({
        category: "security",
        title: "พยายามติดตั้ง Agent ด้วย install key ที่ไม่ถูกต้อง",
        details: { เครื่อง: body.hostname, facilityId, fingerprint, IP: readRequestIp(req.headers) },
      });
      return NextResponse.json({ error: "Install key is invalid" }, { status: 401 });
    }
  }

  try {
    const result = enrollmentToken
      ? await enrollAgentDevice({
          enrollmentToken,
          fingerprint,
          hostname: body.hostname,
          agentVersion: body.agentVersion,
        })
      : await enrollAgentDeviceWithInstallKey({
          facilityId,
          workGroupId: Number.isInteger(workGroupId) && workGroupId > 0 ? workGroupId : null,
          workGroupName: body.workGroupName,
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
        กลุ่มงาน: result.workGroupName ?? "-",
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
      workGroupId: result.workGroupId,
      workGroupName: result.workGroupName,
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
    if (message === "INVALID_FACILITY") {
      return NextResponse.json({ error: "Facility is invalid or inactive" }, { status: 400 });
    }
    if (message === "WORK_GROUP_REQUIRED") {
      return NextResponse.json({ error: "workGroupId is required for this facility" }, { status: 400 });
    }
    if (message === "WORK_GROUP_TOO_LONG") {
      return NextResponse.json({ error: "workGroupName is too long" }, { status: 400 });
    }
    if (message === "WORK_GROUP_UNAVAILABLE") {
      return NextResponse.json({ error: "workGroupId must match an active work group for this facility" }, { status: 400 });
    }
    return NextResponse.json({ error: "Unable to enroll agent" }, { status: 500 });
  }
}
