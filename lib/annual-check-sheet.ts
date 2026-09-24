import { assetClassLabel } from "@/lib/asset-classes";

/**
 * ใบตรวจสอบพัสดุประจำปี (A4 แนวนอน)
 *
 * ตามแบบฟอร์มของ สสจ.สตูล: หัวเรื่อง "ตรวจสอบพัสดุประจำปี <ปี พ.ศ.>" ตามด้วยหน่วยงานและกลุ่มงาน
 * แล้วแบ่งตารางเป็นช่วง ๆ ตามประเภทครุภัณฑ์ (เช่น "ครุภัณฑ์คอมพิวเตอร์") ปิดท้ายด้วยช่องลงนามคณะกรรมการ
 *
 * ไฟล์นี้เป็นตรรกะล้วน ไม่แตะฐานข้อมูล เพื่อให้ทดสอบได้
 */
export type CheckSheetAsset = {
  id: number;
  assetNumber?: string | null;
  assetRegistrationNo?: string | null;
  assetAccountingCode?: string | null;
  assetName: string;
  assetClass?: string | null;
  manufacturerBrand?: string | null;
  manufacturerModel?: string | null;
  purchasePrice?: number | null;
  purchaseDate?: string | null;
  installedAt?: string | null;
  workGroupName?: string | null;
  locationDetail?: string | null;
  unitName?: string | null;
  currentStatus?: string | null;
};

export type CheckSheetRow = {
  assetId: number;
  seq: number;
  acquiredOn: string;
  assetCode: string;
  accountingCode: string;
  detail: string;
  quantity: string;
  unitPrice: string;
  total: string;
  usedAt: string;
  status: string;
};

export type CheckSheetGroup = {
  key: string;
  label: string;
  rows: CheckSheetRow[];
  subtotal: number;
};

export type CheckSheet = {
  title: string;
  facilityName: string;
  workGroupName: string;
  groups: CheckSheetGroup[];
  totalCount: number;
  grandTotal: number;
  /** รายการที่ยังไม่มีราคา — ไม่ถูกนับในยอดรวม */
  missingPriceCount: number;
};

/** ผลตรวจนับรายชิ้นจากรอบที่เปิดไว้ (กรรมการสแกน QR แล้วบันทึกผล) */
export type CheckSheetResult = {
  inspectionStatus: "Pending" | "Found" | "Missing";
  /** สถานะครุภัณฑ์ที่กรรมการบันทึกตอนตรวจ เช่น Active / Broken / Inactive */
  assetStatus?: string | null;
};

export type CheckSheetOptions = {
  /** ปีที่ตรวจสอบ (พ.ศ.) */
  yearBE: number;
  facilityName: string;
  workGroupName?: string;
  /**
   * ผลตรวจจากรอบตรวจนับ (assetId → ผล)
   * ถ้าไม่ส่งมา หรือรายการนั้นยังไม่ได้สแกน ช่อง "สถานะพัสดุ" จะเว้นว่างให้กรรมการเขียนเอง
   */
  results?: Map<number, CheckSheetResult> | null;
  /** ป้ายสถานะครุภัณฑ์ เช่น assetStatusLabel (Broken → ชำรุด) */
  statusLabel?: (status: string | null | undefined) => string;
};

/**
 * ข้อความในช่อง "สถานะพัสดุ"
 * - ยังไม่ได้ตรวจผ่านระบบ (ไม่มีผล หรือ Pending) → เว้นว่างไว้ให้เขียนมือ
 * - ตรวจแล้วไม่พบ → "ไม่พบ"
 * - ตรวจพบและใช้งานได้ → "ตรวจพบ"
 * - ตรวจพบแต่สภาพไม่ปกติ → "ตรวจพบ (ชำรุด)" ตามสถานะที่กรรมการบันทึก
 */
export function checkSheetStatusText(
  result: CheckSheetResult | undefined,
  statusLabel?: (status: string | null | undefined) => string
) {
  if (!result || result.inspectionStatus === "Pending") return "";
  if (result.inspectionStatus === "Missing") return "ไม่พบ";
  const assetStatus = (result.assetStatus ?? "").trim();
  if (!assetStatus || assetStatus === "Active") return "ตรวจพบ";
  const label = statusLabel?.(assetStatus) ?? assetStatus;
  return `ตรวจพบ (${label})`;
}

const THAI_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** "2024-03-15" → "15 มี.ค. 2567" (ปี พ.ศ. เต็ม ตามแบบฟอร์ม) */
export function checkSheetDate(iso: string | null | undefined, fallback = "") {
  const value = String(iso ?? "").slice(0, 10);
  if (!DATE.test(value)) return fallback;
  const [year, month, day] = value.split("-").map(Number);
  if (!month || month < 1 || month > 12) return fallback;
  return `${day} ${THAI_MONTHS[month - 1]} ${year + 543}`;
}

export function money(value: number | null | undefined, fallback = "") {
  if (value === null || value === undefined || !Number.isFinite(value)) return fallback;
  return value.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** "เครื่องคอมพิวเตอร์แบบที่ 1 ASUS รุ่น ..." โดยไม่ซ้ำยี่ห้อ/รุ่นที่อยู่ในชื่ออยู่แล้ว */
export function checkSheetDetail(asset: CheckSheetAsset) {
  const name = (asset.assetName ?? "").trim();
  const lower = name.toLowerCase();
  const brand = (asset.manufacturerBrand ?? "").trim();
  const model = (asset.manufacturerModel ?? "").trim();
  const parts = [name];
  if (brand && !lower.includes(brand.toLowerCase())) parts.push(`ยี่ห้อ ${brand}`);
  if (model && !lower.includes(model.toLowerCase())) parts.push(`รุ่น ${model}`);
  return parts.filter(Boolean).join(" ");
}

/** ใช้ประจำที่ไหน: กลุ่มงาน → สถานที่ติดตั้ง */
function usedAtText(asset: CheckSheetAsset) {
  return (asset.workGroupName ?? "").trim() || (asset.locationDetail ?? "").trim() || "";
}

export function buildCheckSheet(assets: CheckSheetAsset[], options: CheckSheetOptions): CheckSheet {
  const byClass = new Map<string, CheckSheetGroup>();
  let seq = 0;
  let grandTotal = 0;
  let missingPriceCount = 0;

  const sorted = [...assets].sort((a, b) => {
    const classCompare = assetClassLabel(a.assetClass, "full").localeCompare(assetClassLabel(b.assetClass, "full"), "th");
    if (classCompare !== 0) return classCompare;
    const dateCompare = String(a.purchaseDate ?? a.installedAt ?? "").localeCompare(String(b.purchaseDate ?? b.installedAt ?? ""));
    if (dateCompare !== 0) return dateCompare;
    return a.id - b.id;
  });

  for (const asset of sorted) {
    const key = String(asset.assetClass ?? "Other");
    const label = assetClassLabel(asset.assetClass, "full");
    const group = byClass.get(key) ?? { key, label, rows: [], subtotal: 0 };

    const price = Number.isFinite(asset.purchasePrice) ? Number(asset.purchasePrice) : null;
    if (price === null) missingPriceCount += 1;
    else {
      group.subtotal += price;
      grandTotal += price;
    }

    seq += 1;
    group.rows.push({
      assetId: asset.id,
      seq,
      acquiredOn: checkSheetDate(asset.purchaseDate ?? asset.installedAt),
      assetCode: (asset.assetNumber ?? asset.assetRegistrationNo ?? "").trim(),
      accountingCode: (asset.assetAccountingCode ?? "").trim(),
      detail: checkSheetDetail(asset),
      quantity: (asset.unitName ?? "").trim() ? `1 ${(asset.unitName ?? "").trim()}` : "1",
      unitPrice: money(price),
      total: money(price),
      usedAt: usedAtText(asset),
      status: checkSheetStatusText(options.results?.get(asset.id), options.statusLabel),
    });
    byClass.set(key, group);
  }

  const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
  const groups = [...byClass.values()]
    .map((group) => ({ ...group, subtotal: round2(group.subtotal) }))
    .sort((a, b) => a.label.localeCompare(b.label, "th"));

  return {
    title: `ตรวจสอบพัสดุประจำปี ${options.yearBE}`,
    facilityName: options.facilityName,
    workGroupName: options.workGroupName ?? "",
    groups,
    totalCount: seq,
    grandTotal: round2(grandTotal),
    missingPriceCount,
  };
}

export type CommitteeSigner = { role?: "chair" | "member" | null; fullName: string; position?: string | null };

/** ช่องลงนาม: ประธานอยู่บรรทัดบนเดี่ยว ๆ ที่เหลือเป็นกรรมการเรียงเป็นแถว (เว้นว่างเมื่อยังไม่ได้บันทึกชื่อ) */
export function checkSheetSigners(committee: CommitteeSigner[], minMembers = 3) {
  const chair = committee.find((member) => member.role === "chair") ?? committee[0];
  const members = committee.filter((member) => member !== chair);
  const padded = [...members];
  while (padded.length < minMembers) padded.push({ role: "member", fullName: "" });
  return {
    chair: { label: "ประธานกรรมการ", fullName: chair?.fullName ?? "" },
    members: padded.map((member) => ({ label: "กรรมการ", fullName: member.fullName ?? "" })),
  };
}
