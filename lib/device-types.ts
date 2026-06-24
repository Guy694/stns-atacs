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
  { id: 0, name: "เครื่องแม่ข่าย",                category: "Hardware" },
  { id: 0, name: "เครื่องคอมพิวเตอร์ตั้งโต๊ะ",     category: "Hardware" },
  { id: 0, name: "เครื่องคอมพิวเตอร์ All-in-One",  category: "Hardware" },
  { id: 0, name: "เครื่องคอมพิวเตอร์พกพา",         category: "Hardware" },
  { id: 0, name: "แท็บเล็ต",                      category: "Hardware" },
  { id: 0, name: "เครื่องพิมพ์",                   category: "Hardware" },
  { id: 0, name: "เครื่องพิมพ์ฉลาก",               category: "Hardware" },
  { id: 0, name: "เครื่องพิมพ์มัลติฟังก์ชัน",       category: "Hardware" },
  { id: 0, name: "สแกนเนอร์",                     category: "Hardware" },
  { id: 0, name: "เครื่องอ่านบาร์โค้ด",            category: "Hardware" },
  { id: 0, name: "ไฟร์วอลล์",                     category: "Hardware" },
  { id: 0, name: "สวิตช์เครือข่าย",                category: "Hardware" },
  { id: 0, name: "เราเตอร์",                      category: "Hardware" },
  { id: 0, name: "อุปกรณ์กระจายสัญญาณไร้สาย",      category: "Hardware" },
  { id: 0, name: "อุปกรณ์จัดเก็บข้อมูลบนเครือข่าย", category: "Hardware" },
  { id: 0, name: "อุปกรณ์สำรองข้อมูล",             category: "Hardware" },
  { id: 0, name: "เครื่องสำรองไฟ",                 category: "Hardware" },
  { id: 0, name: "ตู้ Rack / อุปกรณ์จัดเก็บในตู้",  category: "Hardware" },
  { id: 0, name: "อุปกรณ์ควบคุมห้องประชุม",        category: "Hardware" },
  { id: 0, name: "โปรเจกเตอร์",                   category: "Hardware" },
  { id: 0, name: "กล้องวงจรปิด IP",                category: "Hardware" },
  { id: 0, name: "โทรศัพท์ IP",                   category: "Hardware" },
  { id: 0, name: "อุปกรณ์ IoT ทางการแพทย์",        category: "Hardware" },
  { id: 0, name: "อุปกรณ์อื่นๆ",                   category: "Hardware" },
  { id: 0, name: "ระบบปฏิบัติการ",                 category: "Software" },
  { id: 0, name: "ระบบสารสนเทศโรงพยาบาล",          category: "Software" },
  { id: 0, name: "ระบบฐานข้อมูล",                  category: "Software" },
  { id: 0, name: "ระบบสำรองข้อมูล",                category: "Software" },
  { id: 0, name: "ระบบป้องกันไวรัส",               category: "Software" },
  { id: 0, name: "ระบบบัญชีและการเงิน",            category: "Software" },
  { id: 0, name: "ระบบบริหารงานบุคคล",             category: "Software" },
  { id: 0, name: "ระบบคลังยา/คลังพัสดุ",           category: "Software" },
  { id: 0, name: "ระบบรายงานและ Dashboard",        category: "Software" },
  { id: 0, name: "ระบบจัดการสิทธิ์ผู้ใช้",          category: "Software" },
  { id: 0, name: "ซอฟต์แวร์ลิขสิทธิ์",             category: "Software" },
  { id: 0, name: "ซอฟต์แวร์อื่นๆ",                 category: "Software" },
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

export async function listActiveDeviceTypes(): Promise<DeviceTypeRow[]> {
  try {
    return await selectRows<DeviceTypeRow>(
      `SELECT id, name, category, is_active, sort_order
       FROM asset_device_types
       WHERE is_active = 1
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
