import { ACQUISITION_METHODS, FUNDING_SOURCES } from "@/lib/acquisition-options";
import { ASSET_CREATE_CLASS_OPTIONS } from "@/lib/asset-classes";
import { ASSET_DETAIL_FIELDS, DETAIL_COLUMNS } from "@/lib/asset-details";

/**
 * คำอธิบายคอลัมน์ของไฟล์นำเข้าทรัพย์สิน (CSV / Excel)
 *
 * ไฟล์นี้เป็นแหล่งข้อมูลเดียว (single source of truth) ใช้ทั้ง
 *   - หัวคอลัมน์และแถวตัวอย่างของไฟล์ต้นแบบ
 *   - ชีต "คำอธิบายคอลัมน์" ในไฟล์ Excel ต้นแบบ
 *   - ตารางอธิบายในหน้าจอนำเข้าข้อมูล
 * เพื่อไม่ให้เอกสารกับระบบไม่ตรงกัน
 */
export type ImportColumnRequirement = "required" | "conditional" | "optional" | "key";

export type ImportColumn = {
  column: string;
  label: string;
  requirement: ImportColumnRequirement;
  /** รูปแบบค่าที่รับ เช่น ข้อความ, ตัวเลข, YYYY-MM-DD */
  format: string;
  /** ค่าที่อนุญาต (ถ้ามีชุดค่าตายตัว) */
  allowed?: string;
  example: string;
  note?: string;
};

export const REQUIREMENT_LABELS: Record<ImportColumnRequirement, string> = {
  key: "กุญแจอ้างอิง",
  required: "จำเป็น",
  conditional: "จำเป็นบางกรณี",
  optional: "ไม่บังคับ",
};

const classList = ASSET_CREATE_CLASS_OPTIONS.map((option) => option.value).join(", ");
const fundingList = FUNDING_SOURCES.map((item) => `${item.value} (${item.label})`).join(", ");
const methodList = ACQUISITION_METHODS.map((item) => `${item.value} (${item.label})`).join(", ");

const CORE_COLUMNS: ImportColumn[] = [
  {
    column: "id",
    label: "รหัสอ้างอิงในระบบ",
    requirement: "key",
    format: "ตัวเลข",
    example: "",
    note: "เว้นว่าง = เพิ่มรายการใหม่ · ใส่เลข id = แก้ไขรายการเดิม (ต้องอยู่ในหน่วยงานที่เลือก) วิธีที่ปลอดภัยที่สุดคือส่งออกข้อมูลเดิมมาแก้แล้วนำเข้ากลับ",
  },
  {
    column: "work_group_id",
    label: "รหัสกลุ่มงาน",
    requirement: "conditional",
    format: "ตัวเลข",
    example: "3",
    note: "หน่วยงานที่มีกลุ่มงาน (รพ./สสจ./สสอ.) ต้องระบุ · ดูรหัสได้จากหน้าจอนำเข้าข้อมูล หรือกรอก work_group_name แทนได้",
  },
  {
    column: "work_group_name",
    label: "ชื่อกลุ่มงาน",
    requirement: "optional",
    format: "ข้อความ",
    example: "งานธุรการ",
    note: "ใช้แทน work_group_id ได้ ต้องตรงกับชื่อกลุ่มงานที่เปิดใช้งานอยู่ในหน่วยงานนั้น (ถ้ากรอกทั้งสองช่อง ระบบใช้ work_group_id)",
  },
  {
    column: "asset_registration_no",
    label: "เลขทะเบียนครุภัณฑ์",
    requirement: "optional",
    format: "ข้อความ",
    example: "7440-001-0006/186/69",
    note: "ห้ามซ้ำกับรายการอื่นในระบบ · เว้นว่างได้ถ้ายังไม่ได้กำหนดเลข",
  },
  { column: "asset_name", label: "ชื่อครุภัณฑ์", requirement: "required", format: "ข้อความ", example: "เครื่องคอมพิวเตอร์แบบที่ 1", note: "ช่องเดียวที่ขาดไม่ได้ ถ้าเว้นว่างระบบจะข้ามแถวนั้น" },
  {
    column: "asset_class",
    label: "ประเภทครุภัณฑ์ (20 ประเภท)",
    requirement: "conditional",
    format: "รหัสภาษาอังกฤษ",
    allowed: classList,
    example: "IT",
    note: "เว้นว่าง = IT (ครุภัณฑ์คอมพิวเตอร์) · ประเภทนี้เป็นตัวกำหนดอายุการใช้งานและอัตราค่าเสื่อมราคา",
  },
  { column: "asset_category", label: "หมวด (เฉพาะครุภัณฑ์คอมพิวเตอร์)", requirement: "conditional", format: "รหัส", allowed: "Hardware, Software", example: "Hardware", note: "ใช้เฉพาะเมื่อ asset_class = IT" },
  { column: "asset_group", label: "กลุ่มย่อยเดิม", requirement: "optional", format: "ข้อความ", example: "Computer", note: "ข้อมูลเดิมของระบบ ไม่จำเป็นสำหรับข้อมูลใหม่" },
  { column: "device_type", label: "ประเภทอุปกรณ์", requirement: "optional", format: "ข้อความ", example: "Desktop", note: "ควรใช้ชื่อที่มีอยู่แล้วในระบบ (ตั้งค่า > ประเภทอุปกรณ์)" },
  { column: "subtype_id", label: "รหัสประเภทย่อย", requirement: "optional", format: "ตัวเลข", example: "", note: "ใช้กับครุภัณฑ์ที่ไม่ใช่คอมพิวเตอร์ · ใส่ __CLEAR__ เพื่อล้างค่าเดิมตอนแก้ไข" },
  { column: "manufacturer_brand", label: "ยี่ห้อ", requirement: "optional", format: "ข้อความ", example: "ASUS" },
  { column: "manufacturer_model", label: "รุ่น / แบบ", requirement: "optional", format: "ข้อความ", example: "ExpertCenter D500" },
  { column: "manufacturer_specification", label: "คุณลักษณะ", requirement: "optional", format: "ข้อความ", example: "CPU i5 / RAM 16 GB / SSD 512 GB" },
  { column: "serial_number", label: "Serial Number", requirement: "optional", format: "ข้อความ", example: "SN-0001", note: "ห้ามซ้ำภายในหน่วยงานเดียวกัน (ยกเว้นค่าอย่าง -, N/A, ไม่มี)" },
  { column: "operating_system", label: "ระบบปฏิบัติการ", requirement: "optional", format: "ข้อความ", example: "Windows", note: "ใช้เฉพาะครุภัณฑ์คอมพิวเตอร์" },
  { column: "operating_system_version", label: "รุ่นระบบปฏิบัติการ", requirement: "optional", format: "ข้อความ", example: "11 Pro" },
  { column: "windows_license_status", label: "สถานะลิขสิทธิ์ Windows", requirement: "conditional", format: "รหัส", allowed: "Genuine (แท้), NotGenuine (ไม่แท้), Unknown (ไม่ทราบ)", example: "Genuine", note: "จำเป็นเมื่อเป็นเครื่องคอมพิวเตอร์" },
  { column: "private_ip", label: "IP ภายใน", requirement: "optional", format: "IPv4 หรือ IPv4/prefix", example: "192.168.1.10" },
  { column: "public_ip", label: "IP สาธารณะ", requirement: "optional", format: "IPv4", example: "" },
  { column: "owner_name", label: "ผู้รับผิดชอบ / ผู้ครอบครอง", requirement: "optional", format: "ข้อความ", example: "นางสาวสมหญิง ใจดี" },
  { column: "location_detail", label: "ที่ตั้ง", requirement: "optional", format: "ข้อความ", example: "ห้องธุรการ ชั้น 1", note: "พิมพ์ได้อิสระ ค่าใหม่จะกลายเป็นตัวเลือกในแบบฟอร์มให้ครั้งถัดไป" },
  { column: "current_status", label: "สถานะ", requirement: "optional", format: "รหัส", allowed: "Active (พร้อมใช้งาน), Broken (ชำรุด), Inactive (ไม่ใช้งาน), Disposed (จำหน่ายแล้ว), Lost (สูญหาย)", example: "Active", note: "เว้นว่าง = Active" },
  { column: "purchase_price", label: "ราคาที่ได้มา (บาท)", requirement: "optional", format: "ตัวเลข ไม่ใส่คอมมา", example: "24000", note: "จำเป็นถ้าต้องการให้ระบบคิดค่าเสื่อมราคาและออกทะเบียนคุมทรัพย์สิน" },
  { column: "purchase_date", label: "วันที่ได้มา", requirement: "optional", format: "YYYY-MM-DD (ค.ศ.)", example: "2026-06-16", note: "ใช้เป็นวันเริ่มคิดค่าเสื่อมราคา · ต้องเป็น ค.ศ. เช่น พ.ศ. 2569 = 2026" },
  { column: "purchase_order_no", label: "เลขที่ใบสั่งซื้อ / สัญญา", requirement: "optional", format: "ข้อความ", example: "PO-2569-001" },
  { column: "maintenance_start_date", label: "วันเริ่ม MA", requirement: "optional", format: "YYYY-MM-DD", example: "2026-06-16" },
  { column: "maintenance_end_date", label: "วันสิ้นสุด MA", requirement: "optional", format: "YYYY-MM-DD", example: "2029-06-15", note: "ใช้เตือนสัญญาใกล้หมดอายุ" },
  { column: "installed_at", label: "วันที่ติดตั้ง / เริ่มใช้งาน", requirement: "optional", format: "YYYY-MM-DD", example: "2026-06-20", note: "ใช้แทนวันที่ได้มาในการคิดค่าเสื่อม เมื่อไม่มี purchase_date" },
  { column: "usage_description", label: "ลักษณะการใช้งาน", requirement: "optional", format: "ข้อความ", example: "ใช้งานธุรการ" },
  { column: "useful_life_years", label: "อายุการใช้งาน (ปี)", requirement: "optional", format: "ตัวเลข", example: "", note: "เว้นว่างให้ระบบใช้ค่าตามตารางอายุการใช้งานของกระทรวง · ใส่ __CLEAR__ เพื่อกลับไปใช้ค่าตามตาราง" },
  { column: "asset_code_prefix", label: "คำนำหน้าเลขครุภัณฑ์", requirement: "optional", format: "ข้อความ", example: "สสจ.สต.", note: "เว้นว่างให้ใช้ค่าประจำหน่วยงาน" },
  { column: "asset_accounting_code", label: "รหัสสินทรัพย์ (บัญชี)", requirement: "optional", format: "ข้อความ", example: "110000708882", note: "เลขสินทรัพย์จากระบบบัญชี ใช้ในใบตรวจสอบพัสดุประจำปี" },
  { column: "funding_source", label: "ประเภทเงินที่ใช้ซื้อ", requirement: "optional", format: "รหัส หรือชื่อภาษาไทย", allowed: fundingList, example: "Budget", note: "ใช้ในทะเบียนคุมทรัพย์สิน (ช่องประเภทเงิน)" },
  { column: "acquisition_method", label: "วิธีการได้มา", requirement: "optional", format: "รหัส หรือชื่อภาษาไทย", allowed: methodList, example: "Specific", note: "ใช้ในทะเบียนคุมทรัพย์สิน (ช่องวิธีการได้มา)" },
  { column: "vendor_name", label: "ผู้ขาย / ผู้รับจ้าง / ผู้บริจาค", requirement: "optional", format: "ข้อความ ไม่เกิน 255 ตัวอักษร", example: "บริษัท ตัวอย่าง จำกัด" },
  { column: "warranty_end_date", label: "วันสิ้นสุดการรับประกัน", requirement: "optional", format: "YYYY-MM-DD", example: "2029-06-15" },
  { column: "unit_name", label: "หน่วยนับ", requirement: "optional", format: "ข้อความ ไม่เกิน 30 ตัวอักษร", example: "เครื่อง", note: "เช่น เครื่อง ชุด ตัว คัน" },
];

/** คอลัมน์รายละเอียดเฉพาะกลุ่ม (ใช้เฉพาะครุภัณฑ์บางประเภท) */
const DETAIL_COLUMN_INFO = new Map<string, { label: string; classes: string[]; type?: string }>();
for (const [assetClass, fields] of Object.entries(ASSET_DETAIL_FIELDS)) {
  for (const field of fields) {
    const entry = DETAIL_COLUMN_INFO.get(field.key) ?? { label: field.label, classes: [], type: field.type };
    if (!entry.classes.includes(assetClass)) entry.classes.push(assetClass);
    DETAIL_COLUMN_INFO.set(field.key, entry);
  }
}

const DETAIL_IMPORT_COLUMNS: ImportColumn[] = DETAIL_COLUMNS.map((column) => {
  const info = DETAIL_COLUMN_INFO.get(column);
  const format = info?.type === "date" ? "YYYY-MM-DD" : info?.type === "number" ? "ตัวเลข" : "ข้อความ";
  return {
    column,
    label: info?.label ?? column,
    requirement: "optional" as const,
    format,
    example: "",
    note: `รายละเอียดเฉพาะกลุ่ม ${(info?.classes ?? []).slice(0, 4).join(", ")}${(info?.classes?.length ?? 0) > 4 ? " และกลุ่มอื่น" : ""} · ใส่ __CLEAR__ เพื่อล้างค่าเดิม`,
  };
});

/**
 * ลำดับคอลัมน์ในไฟล์ต้นแบบ — ต้องตรงกับลำดับที่ /api/export/assets เขียนข้อมูลออกมา
 * คอลัมน์ที่เพิ่มภายหลังต่อท้ายเสมอ เพื่อให้ไฟล์เก่าที่ผู้ใช้เก็บไว้ยังใช้ได้
 * (การนำเข้าอ่านจากชื่อหัวคอลัมน์ ไม่ใช่ตำแหน่ง ลำดับจึงมีผลกับไฟล์ที่ระบบสร้างเท่านั้น)
 */
const COLUMN_ORDER = [
  "id", "work_group_id", "asset_registration_no", "asset_name", "asset_class", "asset_category", "asset_group",
  "device_type", "manufacturer_brand", "manufacturer_model", "manufacturer_specification", "serial_number",
  "operating_system", "operating_system_version", "windows_license_status", "private_ip", "public_ip",
  "owner_name", "location_detail", "current_status", "purchase_price", "purchase_date", "purchase_order_no",
  "maintenance_start_date", "maintenance_end_date", "installed_at", "usage_description", "subtype_id",
  ...DETAIL_COLUMNS,
  "useful_life_years", "asset_code_prefix", "asset_accounting_code", "funding_source", "acquisition_method",
  "vendor_name", "warranty_end_date", "unit_name",
  // เพิ่มใหม่ (ก.ย. 2569): กรอกชื่อกลุ่มงานแทนรหัสได้
  "work_group_name",
];

const ALL_COLUMNS = [...CORE_COLUMNS, ...DETAIL_IMPORT_COLUMNS];

export const IMPORT_COLUMNS: ImportColumn[] = COLUMN_ORDER.map((column) => {
  const found = ALL_COLUMNS.find((item) => item.column === column);
  if (!found) throw new Error(`ไม่มีคำอธิบายของคอลัมน์ ${column} ใน lib/asset-import-columns.ts`);
  return found;
});

export const IMPORT_HEADERS = IMPORT_COLUMNS.map((item) => item.column);

export function importSampleRow(values: Record<string, string>) {
  return IMPORT_HEADERS.map((header) => values[header] ?? "");
}
