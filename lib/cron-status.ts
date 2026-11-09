import { getAppSetting, setAppSetting } from "@/lib/app-settings";

/**
 * M15: ทุก route ใน app/api/cron บันทึกเวลาที่รันล่าสุดไว้ใน app_settings (ไม่ต้องรัน migration)
 * หน้า ตั้งค่าระบบ แสดงสถานะ เพื่อให้เห็นทันทีเมื่อไม่มีตัวเรียก cron หรือ CRON_SECRET ไม่ตรงกัน
 */
export type CronJobKey = "agent-health" | "daily-summary" | "backup-check";
export type CronRun = { at: string; ok: boolean; detail?: string };
export type CronHealth = "ok" | "late" | "failed" | "never";

export const CRON_JOBS: { key: CronJobKey; label: string; everyMinutes: number }[] = [
  { key: "agent-health", label: "ตรวจเครื่อง Agent ที่ขาดการติดต่อ", everyMinutes: 60 },
  { key: "daily-summary", label: "สรุปงานค้างประจำวัน (Telegram)", everyMinutes: 24 * 60 },
  { key: "backup-check", label: "ตรวจไฟล์สำรองฐานข้อมูล", everyMinutes: 24 * 60 },
];

const settingKey = (job: CronJobKey) => `cron.last_run.${job}`;

export function parseCronRun(raw: string | null | undefined): CronRun | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<CronRun>;
    if (typeof value?.at !== "string" || Number.isNaN(Date.parse(value.at)) || typeof value.ok !== "boolean") return null;
    return { at: value.at, ok: value.ok, ...(typeof value.detail === "string" ? { detail: value.detail } : {}) };
  } catch {
    return null;
  }
}

/** ok ถ้ารันสำเร็จภายใน 2 เท่าของรอบที่ควรรัน (เผื่อรอบที่เลื่อน) */
export function cronJobHealth(run: CronRun | null, now: Date, everyMinutes: number): CronHealth {
  if (!run) return "never";
  if (!run.ok) return "failed";
  return now.getTime() - Date.parse(run.at) > everyMinutes * 2 * 60_000 ? "late" : "ok";
}

/** เรียกท้าย route cron ทุกตัว — ห้ามทำให้งานหลักล้ม */
export async function recordCronRun(job: CronJobKey, ok: boolean, detail?: string) {
  try {
    const run: CronRun = { at: new Date().toISOString(), ok, ...(detail ? { detail: detail.slice(0, 200) } : {}) };
    await setAppSetting(settingKey(job), JSON.stringify(run));
  } catch (error) {
    console.error(`[cron] could not record ${job} run`, error);
  }
}

export async function listCronStatus(now = new Date()) {
  return Promise.all(
    CRON_JOBS.map(async (job) => {
      const run = parseCronRun(await getAppSetting(settingKey(job.key)).catch(() => null));
      return { ...job, run, health: cronJobHealth(run, now, job.everyMinutes) };
    })
  );
}
