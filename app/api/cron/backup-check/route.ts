import fs from "node:fs/promises";
import path from "node:path";

import { NextRequest, NextResponse } from "next/server";

import { evaluateBackupHealth, type BackupFileInfo, type BackupStatusFile } from "@/lib/backup-status";
import { readRequestIp, recordSecurityEvent } from "@/lib/security";
import { notifyTelegramSafe } from "@/lib/telegram";

export const dynamic = "force-dynamic";

function isAuthorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

function bangkokToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

async function readBackupDir(dir: string): Promise<{ files: BackupFileInfo[]; status: BackupStatusFile | null; error: string | null }> {
  let entries: string[];
  try {
    entries = await fs.readdir(dir);
  } catch {
    return { files: [], status: null, error: `อ่านโฟลเดอร์สำรองข้อมูลไม่ได้ (${dir})` };
  }

  const files: BackupFileInfo[] = [];
  for (const name of entries) {
    if (!name.startsWith("atacs-")) continue;
    try {
      const stat = await fs.stat(path.join(dir, name));
      if (stat.isFile()) files.push({ name, bytes: stat.size, modifiedAt: stat.mtimeMs });
    } catch {
      // ไฟล์หายไประหว่างอ่าน — ข้าม
    }
  }

  let status: BackupStatusFile | null = null;
  try {
    status = JSON.parse(await fs.readFile(path.join(dir, "last-status.json"), "utf8")) as BackupStatusFile;
  } catch {
    status = null;
  }

  return { files, status, error: null };
}

/**
 * ตรวจว่าการสำรองข้อมูลยังทำงานอยู่จริง (เรียกวันละครั้งโดยคอนเทนเนอร์ cron)
 * ส่ง Telegram เฉพาะเมื่อพบปัญหา และไม่เกินวันละหนึ่งข้อความต่อระดับความรุนแรง
 * ?dry=1 = ตรวจอย่างเดียว ไม่ส่งแจ้งเตือน
 */
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

  const dir = process.env.BACKUP_CHECK_DIR?.trim() || "/backups";
  const { files, status, error } = await readBackupDir(dir);

  const health = error
    ? { level: "critical" as const, problems: [error], latestDatabaseFile: null, latestDatabaseAgeHours: null, latestDatabaseBytes: null, badFileCount: 0 }
    : evaluateBackupHealth({
        files,
        status,
        maxAgeHours: Number(process.env.BACKUP_MAX_AGE_HOURS ?? 36) || 36,
      });

  if (req.nextUrl.searchParams.get("dry") === "1") {
    return NextResponse.json({ ok: true, directory: dir, health });
  }
  if (health.level === "ok") {
    return NextResponse.json({ ok: true, directory: dir, health, sent: false, reason: "healthy" });
  }

  const result = await notifyTelegramSafe({
    category: "security",
    title: health.level === "critical" ? "การสำรองข้อมูล ATACS มีปัญหา" : "การสำรองข้อมูล ATACS ต้องตรวจสอบ",
    eventKey: `backup-check:${health.level}:${bangkokToday()}`,
    details: {
      ปัญหา: health.problems.join(" · "),
      "ไฟล์ล่าสุด": health.latestDatabaseFile ?? "-",
      "อายุไฟล์ (ชม.)": health.latestDatabaseAgeHours ?? "-",
      โฟลเดอร์: dir,
    },
  });

  return NextResponse.json({ ok: true, directory: dir, health, sent: result.sent });
}
