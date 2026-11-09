import "server-only";

import crypto from "node:crypto";

/**
 * คำสั่งติดตั้ง Agent แบบ "เลือกหน่วยงานแล้วคัดลอก"
 *
 * แต่ละหน่วยงาน (+กลุ่มงาน) มีแถว agent_enrollments แบบใช้ซ้ำหนึ่งแถว (ชื่อขึ้นต้น INSTALL_SCOPE_PREFIX)
 * รหัสในคำสั่งคำนวณซ้ำได้จาก AUTH_SECRET + id ของแถว + ขอบเขต จึงไม่ต้องเก็บ plaintext ใน DB
 * (เก็บเฉพาะ sha256 ใน token_hash เหมือน token แบบเดิม — /api/agent/enroll ไม่ต้องเปลี่ยน)
 * ยกเลิกรายหน่วย = ปิดแถว (is_active = 0) ครั้งถัดไปจะได้แถวใหม่ → รหัสใหม่ คำสั่งเก่าใช้ไม่ได้
 */
export const INSTALL_SCOPE_PREFIX = "คำสั่งติดตั้ง ·";
export const INSTALL_TOKEN_PREFIX = "atacs_enroll_";

export type InstallScope = { id: number; facilityId: number; workGroupId: number | null };
export type InstallOs = "windows" | "linux";

type Env = Record<string, string | undefined>;

export function installTokenSecret(env: Env = process.env): string {
  const secret = env.AUTH_SECRET?.trim();
  if (!secret) throw new Error("AUTH_SECRET is required to issue agent install commands");
  return secret;
}

function positiveInt(value: unknown, field: string) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number <= 0) throw new Error(`Invalid install scope ${field}`);
  return number;
}

export function deriveInstallToken(scope: InstallScope, secret: string | undefined): string {
  const key = secret?.trim();
  if (!key) throw new Error("AUTH_SECRET is required to issue agent install commands");
  const id = positiveInt(scope.id, "id");
  const facilityId = positiveInt(scope.facilityId, "facilityId");
  const workGroupId = scope.workGroupId == null ? 0 : positiveInt(scope.workGroupId, "workGroupId");
  const mac = crypto.createHmac("sha256", key).update(`agent-install:v1:${id}:${facilityId}:${workGroupId}`).digest("base64url");
  return `${INSTALL_TOKEN_PREFIX}${mac}`;
}

export function hashInstallToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/** ตรวจว่า token_hash ที่เก็บไว้ยังตรงกับรหัสที่คำนวณได้ด้วย AUTH_SECRET ปัจจุบัน (timing-safe) */
export function installTokenMatches(scope: InstallScope, tokenHash: string, secret: string): boolean {
  const expected = Buffer.from(hashInstallToken(deriveInstallToken(scope, secret)), "utf8");
  const actual = Buffer.from(String(tokenHash ?? ""), "utf8");
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

export function installScopeEnrollmentName(facilityName: string, workGroupName?: string | null) {
  return [INSTALL_SCOPE_PREFIX.replace(/ ·$/, ""), facilityName, workGroupName].filter(Boolean).join(" · ");
}

export function isInstallScopeEnrollmentName(name: string | null | undefined) {
  return typeof name === "string" && name.startsWith(INSTALL_SCOPE_PREFIX);
}
