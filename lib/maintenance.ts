import "server-only";

import { getAppSetting, listAppSettingsByPrefix, setAppSetting } from "@/lib/app-settings";

/**
 * โหมดปิดปรับปรุงระบบ
 *
 * เมื่อเปิดใช้งาน ผู้ใช้ทั่วไปจะถูกพาไปหน้า /maintenance และเข้าสู่ระบบไม่ได้
 * ผู้ดูแลระบบ (role = admin) ยังเข้าใช้งานได้ตามปกติ เพื่อให้ทำงานปรับปรุงต่อได้
 *
 * เก็บค่าในตาราง app_settings เดียวกับการตั้งค่าอื่น จึงไม่ต้องรัน migration เพิ่ม
 */
const PREFIX = "maintenance.";
const KEYS = {
  enabled: `${PREFIX}enabled`,
  message: `${PREFIX}message`,
  expectedBack: `${PREFIX}expected_back`,
  startedAt: `${PREFIX}started_at`,
  startedBy: `${PREFIX}started_by`,
} as const;

/** setting_value เป็น varchar(255) */
export const MAINTENANCE_MESSAGE_MAX = 255;

export const DEFAULT_MAINTENANCE_MESSAGE =
  "ระบบกำลังปิดปรับปรุงชั่วคราว ขออภัยในความไม่สะดวก กรุณาเข้าใช้งานใหม่อีกครั้งภายหลัง";

export type MaintenanceState = {
  enabled: boolean;
  message: string;
  /** เวลาที่คาดว่าจะกลับมาใช้งานได้ (ข้อความอิสระ เช่น "18:00 น. วันนี้") */
  expectedBack: string;
  startedAt: string;
  startedBy: string;
};

function toBoolean(value: string | undefined) {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "on";
}

export async function getMaintenanceState(): Promise<MaintenanceState> {
  const settings = await listAppSettingsByPrefix(PREFIX);
  return {
    enabled: toBoolean(settings[KEYS.enabled]),
    message: settings[KEYS.message]?.trim() || DEFAULT_MAINTENANCE_MESSAGE,
    expectedBack: settings[KEYS.expectedBack]?.trim() ?? "",
    startedAt: settings[KEYS.startedAt]?.trim() ?? "",
    startedBy: settings[KEYS.startedBy]?.trim() ?? "",
  };
}

/** อ่านเฉพาะสถานะเปิด/ปิด ใช้ในเส้นทางที่เรียกบ่อย ๆ (layout, หน้าแรก, ล็อกอิน) */
export async function isMaintenanceEnabled() {
  return toBoolean((await getAppSetting(KEYS.enabled)) ?? undefined);
}

export async function setMaintenanceState(input: {
  enabled: boolean;
  message?: string;
  expectedBack?: string;
  actorName?: string;
}) {
  const message = (input.message ?? "").trim().slice(0, MAINTENANCE_MESSAGE_MAX);
  const expectedBack = (input.expectedBack ?? "").trim().slice(0, MAINTENANCE_MESSAGE_MAX);

  await setAppSetting(KEYS.enabled, input.enabled ? "true" : "false");
  await setAppSetting(KEYS.message, message || DEFAULT_MAINTENANCE_MESSAGE);
  await setAppSetting(KEYS.expectedBack, expectedBack);

  if (input.enabled) {
    // บันทึกว่าใครเปิดและเปิดเมื่อไร เพื่อให้แอดมินคนอื่นเห็นว่าใครกำลังทำงานอยู่
    await setAppSetting(KEYS.startedAt, new Date().toISOString());
    await setAppSetting(KEYS.startedBy, (input.actorName ?? "").trim().slice(0, MAINTENANCE_MESSAGE_MAX));
  } else {
    await setAppSetting(KEYS.startedAt, "");
    await setAppSetting(KEYS.startedBy, "");
  }
}

/** ผู้ใช้คนนี้ยังใช้งานระบบได้ขณะปิดปรับปรุงหรือไม่ */
export function canBypassMaintenance(user: { role?: string } | null | undefined) {
  return user?.role === "admin";
}
