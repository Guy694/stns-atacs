import path from "node:path";
import { cwd } from "node:process";
import { clearTimeout, setTimeout } from "node:timers";
import { Worker } from "node:worker_threads";

import { parseCsvObjects } from "@/lib/csv-parse";

export type SpreadsheetRow = Record<string, string>;

const WORKER_TIMEOUT_MS = 20_000;
const WORKER_MEMORY_MB = 256;

export class SpreadsheetParseError extends Error {}

export function spreadsheetWorkerPath(root = cwd()) {
  // turbopackIgnore: stop Turbopack (Next 16.4+) from tracing this runtime path and bundling the whole
  // project root; the worker file is shipped via outputFileTracingIncludes in next.config.ts.
  return path.join(/* turbopackIgnore: true */ root, "scripts", "parse-spreadsheet-worker.mjs");
}

/** อ่าน Excel ใน worker thread ที่จำกัดเวลาและหน่วยความจำ */
export function parseExcelInWorker(bytes: Uint8Array, maxRows: number, workerPath = spreadsheetWorkerPath()): Promise<SpreadsheetRow[]> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const worker = new Worker(workerPath, {
      workerData: { buffer: bytes, maxRows },
      resourceLimits: { maxOldGenerationSizeMb: WORKER_MEMORY_MB, maxYoungGenerationSizeMb: 64 },
    });
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      void worker.terminate();
      fn();
    };
    const timer = setTimeout(
      () => finish(() => reject(new SpreadsheetParseError("อ่านไฟล์ Excel นานเกินกำหนด"))),
      WORKER_TIMEOUT_MS,
    );
    worker.once("message", (message: { ok: boolean; rows?: SpreadsheetRow[]; error?: string }) =>
      finish(() =>
        message.ok && Array.isArray(message.rows)
          ? resolve(message.rows)
          : reject(new SpreadsheetParseError(message.error || "อ่านไฟล์ Excel ไม่สำเร็จ")),
      ),
    );
    worker.once("error", (error) => finish(() => reject(new SpreadsheetParseError(error.message))));
    worker.once("exit", (code) => finish(() => reject(new SpreadsheetParseError(`worker exited (${code})`))));
  });
}

/**
 * อ่านไฟล์นำเข้า: .csv อ่านด้วยตัวอ่านของระบบเอง (ไม่ผ่านไลบรารี xlsx)
 * .xlsx / .xls อ่านใน worker thread แยก
 * คืนค่าไม่เกิน maxRows + 1 แถว เพื่อให้ผู้เรียกตรวจได้ว่าไฟล์เกินโควตาหรือไม่
 */
export async function parseImportFile(bytes: Uint8Array, filename: string, maxRows: number): Promise<SpreadsheetRow[]> {
  const name = filename.toLowerCase();
  if (name.endsWith(".csv")) {
    return parseCsvObjects(Buffer.from(bytes).toString("utf8"), maxRows + 1);
  }
  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    return parseExcelInWorker(bytes, maxRows);
  }
  throw new SpreadsheetParseError("รองรับเฉพาะไฟล์ CSV, XLSX หรือ XLS");
}
