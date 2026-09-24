import "server-only";

import type { RowDataPacket } from "mysql2/promise";

import requirements from "@/database/schema-requirements.json";

import { selectRows } from "@/lib/mysql";

/**
 * ตรวจว่าโครงสร้างฐานข้อมูลจริงมีครบตามที่โค้ดต้องใช้หรือไม่
 *
 * เหตุผล: ระบบใช้ `withSchemaFallback` หลายจุด ถ้า migration ยังไม่ถูกรันบนเครื่อง production
 * หน้าจะไม่ error แต่จะ "แสดงข้อมูลว่าง" เงียบ ๆ ซึ่งอันตรายกว่า error
 * ฟังก์ชันนี้ใช้ขึ้นแถบเตือนให้ผู้ดูแลระบบเห็น
 */
export type MigrationRequirement = {
  file: string;
  tables: string[];
  columns: Record<string, string[]>;
};

export type PendingMigration = { file: string; missing: string[] };

export type SchemaReport = {
  checkedAt: string;
  pending: PendingMigration[];
  unavailable: boolean;
};

export const MIGRATION_REQUIREMENTS = requirements as MigrationRequirement[];

/** ตรรกะล้วน แยกจากฐานข้อมูลเพื่อให้ทดสอบได้ */
export function pendingMigrations(
  present: { tables: Set<string>; columns: Map<string, Set<string>> },
  list: MigrationRequirement[] = MIGRATION_REQUIREMENTS
): PendingMigration[] {
  const hasColumn = (table: string, column: string) => present.columns.get(table)?.has(column) ?? false;
  const result: PendingMigration[] = [];
  for (const migration of list) {
    const missing = [
      ...migration.tables.filter((table) => !present.tables.has(table)).map((table) => `ตาราง ${table}`),
      ...Object.entries(migration.columns).flatMap(([table, columns]) =>
        columns.filter((column) => !hasColumn(table, column)).map((column) => `${table}.${column}`)
      ),
    ];
    if (missing.length > 0) result.push({ file: migration.file, missing });
  }
  return result;
}

type SchemaRow = RowDataPacket & { TABLE_NAME: string; COLUMN_NAME: string | null };

let cache: { report: SchemaReport; expiresAt: number } | null = null;
const CACHE_MS = 5 * 60 * 1000;

/** อ่าน information_schema (อ่านอย่างเดียว) แล้ว cache ไว้ 5 นาที */
export async function getSchemaReport(force = false): Promise<SchemaReport> {
  if (!force && cache && cache.expiresAt > Date.now()) return cache.report;

  let report: SchemaReport;
  try {
    const rows = await selectRows<SchemaRow>(
      `SELECT TABLE_NAME, COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE()`
    );
    const tables = new Set<string>();
    const columns = new Map<string, Set<string>>();
    for (const row of rows) {
      tables.add(row.TABLE_NAME);
      if (!columns.has(row.TABLE_NAME)) columns.set(row.TABLE_NAME, new Set());
      if (row.COLUMN_NAME) columns.get(row.TABLE_NAME)!.add(row.COLUMN_NAME);
    }
    report = { checkedAt: new Date().toISOString(), pending: pendingMigrations({ tables, columns }), unavailable: false };
  } catch {
    report = { checkedAt: new Date().toISOString(), pending: [], unavailable: true };
  }

  cache = { report, expiresAt: Date.now() + CACHE_MS };
  return report;
}
