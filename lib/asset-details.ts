/** Shared, versioned schema for non-IT data. Keys are also CSV column names. */
export type DetailField = { key: string; label: string; type?: "date" | "number"; max?: number };
export const ASSET_DETAIL_FIELDS: Record<string, DetailField[]> = {
  Office: [{ key: "material", label: "วัสดุ" }, { key: "dimensions", label: "ขนาด (ระบุหน่วย)" }],
  Medical: [{ key: "medical_device_no", label: "เลขทะเบียนเครื่องมือแพทย์" }, { key: "calibration_date", label: "วันที่สอบเทียบล่าสุด", type: "date" }, { key: "next_calibration_date", label: "วันครบกำหนดสอบเทียบ", type: "date" }],
  Vehicle: [{ key: "license_plate", label: "ทะเบียนรถ" }, { key: "registration_province", label: "จังหวัดที่จดทะเบียน" }, { key: "chassis_number", label: "เลขตัวถัง" }, { key: "engine_number", label: "เลขเครื่องยนต์" }, { key: "fuel_type", label: "เชื้อเพลิง" }, { key: "odometer_km", label: "ระยะทางสะสม (กม.)", type: "number" }, { key: "insurance_expiry", label: "วันสิ้นสุดประกันภัย", type: "date" }, { key: "tax_expiry", label: "วันครบกำหนดภาษี", type: "date" }],
  Building: [{ key: "building_number", label: "เลขที่อาคาร" }, { key: "land_title_number", label: "เลขเอกสารสิทธิ์ที่ดิน" }, { key: "floor_area_sqm", label: "พื้นที่ใช้สอย (ตร.ม.)", type: "number" }, { key: "floor_count", label: "จำนวนชั้น", type: "number", max: 300 }, { key: "completion_date", label: "วันที่ก่อสร้างแล้วเสร็จ", type: "date" }],
  Utility: [{ key: "utility_system", label: "ระบบสาธารณูปโภค" }, { key: "capacity", label: "กำลัง / ความจุ (ระบุหน่วย)" }, { key: "meter_number", label: "หมายเลขมิเตอร์" }, { key: "next_service_date", label: "วันบำรุงรักษาครั้งถัดไป", type: "date" }],
  Other: [{ key: "specific_description", label: "รายละเอียดเฉพาะเพิ่มเติม" }],
};
// Keep legacy detail keys when editing older records; new classes share applicable fields.
ASSET_DETAIL_FIELDS.PermanentBuilding = ASSET_DETAIL_FIELDS.Building;
ASSET_DETAIL_FIELDS.Structure = ASSET_DETAIL_FIELDS.Building;
ASSET_DETAIL_FIELDS.Electrical = ASSET_DETAIL_FIELDS.Utility.map(field => field.key === "utility_system" ? { ...field, label: "ระบบ / ชนิดอุปกรณ์ไฟฟ้า" } : field);
for (const group of ["Advertising", "Agricultural", "Factory", "Construction", "Survey", "Education", "Kitchen", "Sports", "Music", "Weapons", "Field", "Intangible"]) {
  ASSET_DETAIL_FIELDS[group] = ASSET_DETAIL_FIELDS.Other;
}

export const DETAIL_COLUMNS = [...new Set(Object.values(ASSET_DETAIL_FIELDS).flat().map(f => f.key))];
export type AssetDetails = Record<string, string>;
export type AssetExtension = { subtypeId: number | null; subtypeName: string; details: AssetDetails; schemaVersion: number };
export type AssetExtensions = Record<string, AssetExtension>;
export type AssetSubtype = { id: number; assetClass: string; name: string; isActive: boolean };

export function validateAssetDetails(assetClass: string, value: unknown): AssetDetails {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("รายละเอียดเฉพาะต้องเป็นข้อมูลแบบ object");
  const definitions = ASSET_DETAIL_FIELDS[assetClass] ?? [];
  const result: AssetDetails = {};
  for (const [key, raw] of Object.entries(value)) {
    const field = definitions.find(f => f.key === key);
    if (!field) throw new Error(`ข้อมูล ${key} ไม่อยู่ในกลุ่ม ${assetClass}`);
    if (typeof raw !== "string") throw new Error(`${field.label} ต้องเป็นข้อความ`);
    const text = raw.trim();
    if (text.length > 1000) throw new Error(`${field.label} ยาวเกิน 1,000 ตัวอักษร`);
    if (text && field.type === "date") {
      const date = new Date(`${text}T00:00:00Z`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== text) throw new Error(`${field.label} ต้องเป็นวันที่จริง YYYY-MM-DD`);
    }
    if (text && field.type === "number" && (!/^\d+(\.\d+)?$/.test(text) || !Number.isFinite(Number(text)) || Number(text) > (field.max ?? 1e12))) throw new Error(`${field.label} ต้องเป็นตัวเลขตั้งแต่ 0 ถึง ${field.max ?? 1e12}`);
    if (key === "floor_count" && text && !Number.isInteger(Number(text))) throw new Error("จำนวนชั้นต้องเป็นจำนวนเต็ม");
    result[key] = text;
  }
  if (result.calibration_date && result.next_calibration_date && result.next_calibration_date < result.calibration_date) throw new Error("วันครบกำหนดสอบเทียบต้องไม่ก่อนวันที่สอบเทียบล่าสุด");
  return result;
}
