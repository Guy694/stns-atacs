import "server-only";

import type { RowDataPacket } from "mysql2/promise";
import { executeStatement, selectRows } from "@/lib/mysql";

export type DeviceTypeRow = RowDataPacket & {
  id: number;
  name: string;
  category: "Hardware" | "Software";
  is_active: number;
  sort_order: number;
};

const FALLBACK_DEVICE_TYPES: Pick<DeviceTypeRow, "id" | "name" | "category">[] = [
  { id: 0, name: "Server",           category: "Hardware" },
  { id: 0, name: "PC / Workstation", category: "Hardware" },
  { id: 0, name: "Notebook",         category: "Hardware" },
  { id: 0, name: "Printer",          category: "Hardware" },
  { id: 0, name: "Firewall",         category: "Hardware" },
  { id: 0, name: "Switch",           category: "Hardware" },
  { id: 0, name: "Router",           category: "Hardware" },
  { id: 0, name: "Access Point",     category: "Hardware" },
  { id: 0, name: "NAS / Storage",    category: "Hardware" },
  { id: 0, name: "HIS",              category: "Software" },
  { id: 0, name: "OS License",       category: "Software" },
  { id: 0, name: "Antivirus",        category: "Software" },
];

export async function listDeviceTypes(): Promise<DeviceTypeRow[]> {
  try {
    return await selectRows<DeviceTypeRow>(
      `SELECT id, name, category, is_active, sort_order
       FROM asset_device_types
       ORDER BY category, sort_order, name`
    );
  } catch {
    // fallback ถ้ายังไม่ได้รัน migration
    return FALLBACK_DEVICE_TYPES.map((t) => ({ ...t, is_active: 1, sort_order: 0 } as DeviceTypeRow));
  }
}

export async function createDeviceType(name: string, category: "Hardware" | "Software") {
  return executeStatement(
    "INSERT INTO asset_device_types (name, category) VALUES (?, ?)",
    [name, category]
  );
}

export async function updateDeviceType(id: number, name: string, category: "Hardware" | "Software") {
  return executeStatement(
    "UPDATE asset_device_types SET name = ?, category = ? WHERE id = ?",
    [name, category, id]
  );
}

export async function toggleDeviceTypeActive(id: number, active: boolean) {
  return executeStatement(
    "UPDATE asset_device_types SET is_active = ? WHERE id = ?",
    [active ? 1 : 0, id]
  );
}
