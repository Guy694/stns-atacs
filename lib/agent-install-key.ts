import "server-only";

import crypto from "node:crypto";

/**
 * SEC-03: คีย์ติดตั้ง Agent
 *
 * รูปแบบค่าใน ATACS_AGENT_INSTALL_KEY (คั่นหลายรายการด้วย ,)
 *   - `123:KEY`  คีย์ที่ผูกกับหน่วยงาน id 123 — ใช้ติดตั้งได้เฉพาะหน่วยงานนั้น (แนะนำ)
 *   - `KEY`      คีย์กลางแบบเดิม ใช้ได้ทุกหน่วยงาน (ยังรองรับเพื่อความเข้ากันได้ แต่ไม่ควรใช้ต่อ)
 *
 * คีย์นี้ถือเป็นความลับระดับผู้ดูแลระบบ ห้ามส่งไปยังเบราว์เซอร์ของผู้ใช้ทั่วไป
 * ผู้ใช้ระดับหน่วยงานให้ใช้ enrollment token ต่อหน่วยงานแทน
 */
export type AgentInstallKeyEntry = { facilityId: number | null; key: string };

function sha256Buffer(value: string) {
  return crypto.createHash("sha256").update(value).digest();
}

function readInstallKeyEntries(): AgentInstallKeyEntry[] {
  return (process.env.ATACS_AGENT_INSTALL_KEY ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const match = /^(\d+)\s*:\s*(.+)$/.exec(entry);
      if (match) return { facilityId: Number(match[1]), key: match[2].trim() };
      return { facilityId: null, key: entry };
    })
    .filter((entry) => entry.key.length > 0);
}

/** คีย์กลาง (ไม่ผูกหน่วยงาน) — ใช้แสดงให้ผู้ดูแลระบบระดับสูงสุดเท่านั้น */
export function getPrimaryAgentInstallKey() {
  return readInstallKeyEntries().find((entry) => entry.facilityId === null)?.key ?? null;
}

/** คีย์ที่ใช้ติดตั้งให้หน่วยงานนี้ได้ (คีย์เฉพาะหน่วยงานก่อน ถ้าไม่มีจึงใช้คีย์กลาง) */
export function getAgentInstallKeyForFacility(facilityId: number) {
  const entries = readInstallKeyEntries();
  return entries.find((entry) => entry.facilityId === facilityId)?.key
    ?? entries.find((entry) => entry.facilityId === null)?.key
    ?? null;
}

/** คีย์ที่ผูกกับหน่วยงานนี้โดยตรงเท่านั้น (ไม่คืนคีย์กลาง) — ใช้แสดงให้ผู้ดูแลระดับหน่วยงาน */
export function getFacilityBoundAgentInstallKey(facilityId: number) {
  return readInstallKeyEntries().find((entry) => entry.facilityId === facilityId)?.key ?? null;
}

export function isAgentInstallKeyConfigured() {
  return readInstallKeyEntries().length > 0;
}

/**
 * ตรวจคีย์แบบ timing-safe และบังคับขอบเขตหน่วยงาน
 * คีย์ที่ผูกกับหน่วยงานอื่นจะใช้กับ facilityId นี้ไม่ได้
 */
export function verifyAgentInstallKey(input: string, facilityId?: number) {
  const value = input.trim();
  if (!value) return false;

  const inputHash = sha256Buffer(value);
  return readInstallKeyEntries().some((entry) => {
    if (!crypto.timingSafeEqual(inputHash, sha256Buffer(entry.key))) return false;
    if (entry.facilityId === null) return true;
    return facilityId !== undefined && entry.facilityId === facilityId;
  });
}
