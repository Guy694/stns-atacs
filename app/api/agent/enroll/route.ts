import crypto from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import {
  ENROLL_FAILURE_LIMIT,
  ENROLL_SUCCESS_LIMIT,
  ENROLL_WINDOW_MS,
  enrollFailureAllowed,
  enrollSuccessAllowed,
  recordEnrollFailure,
  recordEnrollSuccess,
} from "@/app/api/agent/_lib/enroll-limits";
import { INVALID, isPlainObject, optionalInteger, optionalString, readJsonBody } from "@/app/api/agent/_lib/request-body";
import { enrollAgentDevice, enrollAgentDeviceWithInstallKey } from "@/lib/agent";
import { isAgentInstallKeyConfigured, verifyAgentInstallKey } from "@/lib/agent-install-key";
import { formatThaiDateTime } from "@/lib/date-format";
import { notifyTelegramSafe } from "@/lib/telegram";
import { readRequestIp, recordSecurityEvent } from "@/lib/security";

/** body ของการลงทะเบียนมีแค่ token/คีย์ + ชื่อเครื่อง ไม่กี่ร้อยไบต์ */
const ENROLL_BODY_MAX_BYTES = 16 * 1024;

function tooManyAttempts(retryAfterSeconds: number) {
  return NextResponse.json(
    { error: "Too many enrollment attempts" },
    { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
  );
}

export async function POST(req: NextRequest) {
  const clientIp = readRequestIp(req.headers) ?? "unknown";
  // G9/SEC-03: นับเฉพาะครั้งที่ token/คีย์ผิดต่อ IP — ติดตั้งพร้อมกันหลายร้อยเครื่องหลัง NAT เดียวได้
  const failureGate = enrollFailureAllowed(clientIp);
  if (!failureGate.allowed) {
    await recordSecurityEvent({
      eventType: "agent_enroll_rate_limited",
      ipAddress: clientIp,
      identity: null,
      path: req.nextUrl.pathname,
      detail: `ลงทะเบียนผิดเกิน ${ENROLL_FAILURE_LIMIT} ครั้งใน ${ENROLL_WINDOW_MS / 60000} นาที`,
    });
    return tooManyAttempts(failureGate.retryAfterSeconds);
  }

  const parsed = await readJsonBody(req, ENROLL_BODY_MAX_BYTES);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  }
  if (!isPlainObject(parsed.value)) {
    return NextResponse.json({ error: "JSON body must be an object" }, { status: 400 });
  }
  const body = parsed.value;

  // G11: ชนิดผิด (เช่น fingerprint เป็นตัวเลข/ออบเจกต์) ต้องได้ 400 ไม่ใช่ 500 จาก .trim()
  const stringFields = ["enrollmentToken", "installKey", "fingerprint", "hostname", "agentVersion", "workGroupName"] as const;
  const integerFields = ["facilityId", "workGroupId"] as const;
  const invalidField =
    stringFields.find((key) => optionalString(body[key]) === INVALID) ??
    integerFields.find((key) => optionalInteger(body[key]) === INVALID);
  if (invalidField) {
    return NextResponse.json({ error: `${invalidField} has an invalid type` }, { status: 400 });
  }
  const text = (key: (typeof stringFields)[number]) => {
    const value = body[key];
    return typeof value === "string" ? value.trim() : "";
  };
  const integer = (key: (typeof integerFields)[number]) => {
    const value = optionalInteger(body[key]);
    return typeof value === "number" ? value : 0;
  };

  const enrollmentToken = text("enrollmentToken");
  const installKey = text("installKey");
  const facilityId = integer("facilityId");
  const workGroupId = integer("workGroupId");
  const fingerprint = text("fingerprint");
  const hostname = text("hostname") || null;
  const agentVersion = text("agentVersion") || null;
  const workGroupName = text("workGroupName") || null;

  if (!fingerprint) {
    return NextResponse.json({ error: "fingerprint is required" }, { status: 400 });
  }

  const usesStaticInstall = !enrollmentToken;
  if (usesStaticInstall) {
    if (!installKey) {
      return NextResponse.json({ error: "enrollmentToken or installKey is required" }, { status: 400 });
    }
    if (!facilityId || facilityId <= 0) {
      return NextResponse.json({ error: "facilityId is required for installKey enrollment" }, { status: 400 });
    }
    if (!isAgentInstallKeyConfigured()) {
      return NextResponse.json({ error: "Static agent install key is not configured" }, { status: 503 });
    }
    // SEC-03: คีย์ที่ผูกกับหน่วยงานหนึ่ง จะใช้ลงทะเบียนให้หน่วยงานอื่นไม่ได้
    if (!verifyAgentInstallKey(installKey, facilityId)) {
      recordEnrollFailure(clientIp);
      await recordSecurityEvent({
        eventType: "agent_invalid_install_key",
        ipAddress: readRequestIp(req.headers),
        identity: hostname ?? fingerprint,
        path: req.nextUrl.pathname,
        detail: `Install key ไม่ถูกต้องสำหรับ facility_id=${facilityId}`,
      });
      await notifyTelegramSafe({
        category: "security",
        title: "พยายามติดตั้ง Agent ด้วย install key ที่ไม่ถูกต้อง",
        details: { เครื่อง: hostname, facilityId, fingerprint, IP: readRequestIp(req.headers) },
      });
      return NextResponse.json({ error: "Install key is invalid" }, { status: 401 });
    }
  }

  // เพดานการลงทะเบียนที่สำเร็จต่อหน่วยงาน (install key) หรือต่อ enrollment token — สูงพอสำหรับติดตั้งทั้งหน่วยงาน
  const successScope = usesStaticInstall
    ? `facility:${facilityId}`
    : `token:${crypto.createHash("sha256").update(enrollmentToken).digest("hex").slice(0, 32)}`;
  const successGate = enrollSuccessAllowed(successScope);
  if (!successGate.allowed) {
    await recordSecurityEvent({
      eventType: "agent_enroll_rate_limited",
      ipAddress: clientIp,
      identity: hostname ?? fingerprint,
      path: req.nextUrl.pathname,
      detail: `ลงทะเบียนสำเร็จเกิน ${ENROLL_SUCCESS_LIMIT} เครื่องใน ${ENROLL_WINDOW_MS / 60000} นาที (${usesStaticInstall ? successScope : "enrollment token"})`,
    });
    return tooManyAttempts(successGate.retryAfterSeconds);
  }

  try {
    const result = enrollmentToken
      ? await enrollAgentDevice({
          enrollmentToken,
          fingerprint,
          hostname,
          agentVersion,
        })
      : await enrollAgentDeviceWithInstallKey({
          facilityId,
          workGroupId: workGroupId > 0 ? workGroupId : null,
          workGroupName,
          fingerprint,
          hostname,
          agentVersion,
        });
    recordEnrollSuccess(successScope);

    if (result.previous) {
      // S2: re-enrolment replaces the key of an existing device, so the old agent stops reporting.
      // Usually a reinstall on the same machine; if not expected, revoke the enrollment token/install key.
      const ip = readRequestIp(req.headers);
      await recordSecurityEvent({
        eventType: "agent_reenrolled",
        ipAddress: ip,
        identity: hostname ?? fingerprint,
        path: req.nextUrl.pathname,
        detail: `Device #${result.deviceId} เดิม ${result.previous.hostname ?? "-"} (ล่าสุด ${formatThaiDateTime(result.previous.lastSeenAt)})`,
      });
      await notifyTelegramSafe({
        category: "security",
        title: "Agent ลงทะเบียนซ้ำบนเครื่องเดิม — key เดิมถูกยกเลิก",
        throttle: false,
        details: {
          "เครื่องใหม่": hostname ?? "-",
          "เครื่องเดิม": result.previous.hostname ?? "-",
          "เดิมออนไลน์ล่าสุด": formatThaiDateTime(result.previous.lastSeenAt),
          "สถานะเดิม": result.previous.wasActive ? result.previous.status ?? "-" : "ปิดใช้งาน",
          หน่วยงาน: result.facilityName,
          "Device": `#${result.deviceId}`,
          IP: ip,
          "ถ้าไม่ได้ติดตั้งใหม่": "ปิด token/install key ของหน่วยงานนี้ที่ ตั้งค่าระบบ › Agent",
        },
      });
    } else {
      await notifyTelegramSafe({
        category: "agent",
        title: "ติดตั้ง Agent สำเร็จ",
        details: {
          เครื่อง: hostname ?? `Device #${result.deviceId}`,
          หน่วยงาน: result.facilityName,
          กลุ่มงาน: result.workGroupName ?? "-",
          "Agent ID": result.agentId,
          เวอร์ชัน: agentVersion,
        },
      });
    }

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
      recordEnrollFailure(clientIp);
      await recordSecurityEvent({
        eventType: "agent_invalid_enrollment_token",
        ipAddress: readRequestIp(req.headers),
        identity: hostname ?? fingerprint,
        path: req.nextUrl.pathname,
        detail: "Enrollment token ไม่ถูกต้องหรือหมดอายุ",
      });
      await notifyTelegramSafe({
        category: "security",
        title: "พยายามติดตั้ง Agent ด้วย enrollment token ที่ไม่ถูกต้อง",
        details: { เครื่อง: hostname, fingerprint, IP: readRequestIp(req.headers) },
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
