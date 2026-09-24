/**
 * ตรวจสุขภาพของไฟล์สำรองข้อมูล (สร้างโดย docker/backup.sh)
 * แยกตรรกะออกจากการอ่านไฟล์จริง เพื่อให้ทดสอบได้โดยไม่ต้องมีดิสก์
 */
export type BackupFileInfo = { name: string; bytes: number; modifiedAt: number };

export type BackupStatusFile = {
  state?: string;
  message?: string;
  databaseFile?: string;
  databaseBytes?: number;
  finishedAt?: string;
};

export type BackupHealth = {
  level: "ok" | "warning" | "critical";
  problems: string[];
  latestDatabaseFile: string | null;
  latestDatabaseAgeHours: number | null;
  latestDatabaseBytes: number | null;
  badFileCount: number;
};

export type BackupHealthInput = {
  files: BackupFileInfo[];
  status?: BackupStatusFile | null;
  now?: number;
  /** ไฟล์สำรองต้องใหม่กว่านี้ (ชั่วโมง) */
  maxAgeHours?: number;
  /** ไฟล์เล็กกว่านี้ถือว่าผิดปกติ (ไบต์) */
  minBytes?: number;
};

const HOUR_MS = 60 * 60 * 1000;

export function evaluateBackupHealth(input: BackupHealthInput): BackupHealth {
  const now = input.now ?? Date.now();
  const maxAgeHours = input.maxAgeHours ?? 36;
  const minBytes = input.minBytes ?? 10 * 1024;

  const dumps = input.files
    .filter((file) => /^atacs-db-.*\.sql\.gz$/.test(file.name))
    .sort((a, b) => b.modifiedAt - a.modifiedAt);
  const badFileCount = input.files.filter((file) => file.name.endsWith(".bad")).length;

  const problems: string[] = [];
  let level: BackupHealth["level"] = "ok";
  const escalate = (next: BackupHealth["level"]) => {
    if (next === "critical" || (next === "warning" && level === "ok")) level = next;
  };

  const latest = dumps[0] ?? null;
  const ageHours = latest ? (now - latest.modifiedAt) / HOUR_MS : null;

  if (!latest) {
    problems.push("ไม่พบไฟล์สำรองฐานข้อมูลเลย");
    escalate("critical");
  } else {
    if (ageHours !== null && ageHours > maxAgeHours) {
      problems.push(`ไฟล์สำรองล่าสุดเก่า ${Math.floor(ageHours)} ชั่วโมง (เกิน ${maxAgeHours} ชั่วโมง)`);
      escalate("critical");
    }
    if (latest.bytes < minBytes) {
      problems.push(`ไฟล์สำรองล่าสุดมีขนาดเพียง ${latest.bytes} ไบต์`);
      escalate("critical");
    }
  }

  if (input.status?.state === "failed") {
    problems.push(`รอบสำรองล่าสุดล้มเหลว: ${input.status.message ?? "ไม่ระบุสาเหตุ"}`);
    escalate("critical");
  }

  if (badFileCount > 0) {
    problems.push(`มีไฟล์ที่ตรวจสอบไม่ผ่าน (.bad) ${badFileCount} ไฟล์`);
    escalate("warning");
  }

  if (dumps.length === 1) {
    problems.push("มีไฟล์สำรองเพียงชุดเดียว ยังไม่มีสำเนาย้อนหลัง");
    escalate("warning");
  }

  return {
    level,
    problems,
    latestDatabaseFile: latest?.name ?? null,
    latestDatabaseAgeHours: ageHours === null ? null : Math.round(ageHours * 10) / 10,
    latestDatabaseBytes: latest?.bytes ?? null,
    badFileCount,
  };
}
