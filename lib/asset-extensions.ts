import "server-only";
import type { RowDataPacket } from "mysql2/promise";
import { executeStatement, selectRows } from "@/lib/mysql";
import { validateAssetDetails, type AssetExtensions, type AssetSubtype, type AssetDetails } from "@/lib/asset-details";

export async function listAssetSubtypes(): Promise<AssetSubtype[]> {
  const rows = await selectRows<RowDataPacket>("SELECT id, asset_class, name, is_active FROM asset_subtypes ORDER BY asset_class, name");
  return rows.map(row => ({ id: Number(row.id), assetClass: row.asset_class, name: row.name, isActive: Boolean(row.is_active) }));
}

export async function loadAssetExtensions(ids: number[]): Promise<Map<number, AssetExtensions>> {
  const result = new Map<number, AssetExtensions>();
  if (!ids.length) return result;
  const rows = await selectRows<RowDataPacket>(`SELECT e.*, s.name AS subtype_name FROM asset_extensions e LEFT JOIN asset_subtypes s ON s.id = e.subtype_id WHERE e.asset_id IN (${ids.map(() => "?").join(",")})`, ids);
  for (const row of rows) {
    const item = result.get(row.asset_id) ?? {};
    if (Number(row.schema_version) !== 1) throw new Error("เวอร์ชันรายละเอียดครุภัณฑ์ไม่รองรับ");
    item[row.asset_class] = { subtypeId: row.subtype_id, subtypeName: row.subtype_name ?? "", schemaVersion: 1, details: validateAssetDetails(row.asset_class, typeof row.details === "string" ? JSON.parse(row.details) : row.details) };
    result.set(row.asset_id, item);
  }
  return result;
}

/** Called inside the same transaction as the central registry write. */
export async function saveAssetExtension(assetId: number, assetClass: string, subtypeId: number | null | undefined, patch: AssetDetails | undefined) {
  if (subtypeId === undefined && patch === undefined) return;
  if (assetClass === "IT") throw new Error("ข้อมูลส่วนขยายใช้สำหรับครุภัณฑ์นอกกลุ่ม IT");
  const rows = await selectRows<RowDataPacket>("SELECT subtype_id, details, schema_version FROM asset_extensions WHERE asset_id = ? AND asset_class = ? FOR UPDATE", [assetId, assetClass]);
  const current = rows[0];
  if (current && Number(current.schema_version) !== 1) throw new Error("เวอร์ชันรายละเอียดครุภัณฑ์ไม่รองรับ");
  const selected = subtypeId === undefined ? current?.subtype_id ?? null : subtypeId;
  if (selected !== null) {
    if (!Number.isSafeInteger(selected) || selected <= 0) throw new Error("ประเภทย่อยไม่ถูกต้อง");
    const subtypes = await selectRows<RowDataPacket>("SELECT asset_class, is_active FROM asset_subtypes WHERE id = ? FOR UPDATE", [selected]);
    const subtype = subtypes[0];
    if (!subtype || subtype.asset_class !== assetClass || (!subtype.is_active && selected !== current?.subtype_id)) throw new Error("ประเภทย่อยไม่อยู่ในกลุ่มนี้หรือถูกปิดใช้งานแล้ว");
  }
  const stored = current ? (typeof current.details === "string" ? JSON.parse(current.details) : current.details) : {};
  const details = validateAssetDetails(assetClass, { ...stored, ...patch });
  await executeStatement(`INSERT INTO asset_extensions (asset_id, asset_class, subtype_id, schema_version, details) VALUES (?, ?, ?, 1, ?) ON DUPLICATE KEY UPDATE subtype_id = VALUES(subtype_id), details = VALUES(details)`, [assetId, assetClass, selected, JSON.stringify(details)]);
}
