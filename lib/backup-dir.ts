import "server-only";

import fs from "node:fs/promises";
import path from "node:path";

import type { BackupFileInfo, BackupStatusFile } from "@/lib/backup-status";
import { isBackupDirEntry } from "@/lib/backup-status";

export function backupCheckDir() {
  return process.env.BACKUP_CHECK_DIR?.trim() || "/backups";
}

/** Lists ATACS backup files (names, sizes, times only — never reads the dumps) plus the optional last-status.json. */
export async function readBackupDir(dir = backupCheckDir()): Promise<{ files: BackupFileInfo[]; status: BackupStatusFile | null; error: string | null }> {
  let entries: string[];
  try {
    // The backup folder is a runtime mount (/backups), not part of the build: don't trace it.
    entries = await fs.readdir(/*turbopackIgnore: true*/ dir);
  } catch {
    return { files: [], status: null, error: `อ่านโฟลเดอร์สำรองข้อมูลไม่ได้ (${dir})` };
  }

  const files: BackupFileInfo[] = [];
  for (const name of entries) {
    if (!isBackupDirEntry(name)) continue;
    try {
      const stat = await fs.stat(path.join(/*turbopackIgnore: true*/ dir, name));
      if (stat.isFile()) files.push({ name, bytes: stat.size, modifiedAt: stat.mtimeMs });
    } catch {
      // ไฟล์หายไประหว่างอ่าน — ข้าม
    }
  }

  let status: BackupStatusFile | null = null;
  try {
    status = JSON.parse(await fs.readFile(path.join(/*turbopackIgnore: true*/ dir, "last-status.json"), "utf8")) as BackupStatusFile;
  } catch {
    status = null;
  }

  return { files, status, error: null };
}
