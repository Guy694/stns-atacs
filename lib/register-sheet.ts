import { assetClassLabel } from "@/lib/asset-classes";
import { acquisitionMethodLabel, fundingSourceLabel } from "@/lib/acquisition-options";
import { bahtText, buildRegisterSchedule, periodMonthsLabel, shortSlashDate, shortThaiDate, type RegisterSchedule } from "@/lib/asset-register";

/**
 * แปลงข้อมูลครุภัณฑ์ 1 รายการ เป็นข้อมูลของ "ทะเบียนคุมทรัพย์สิน" 1 แผ่น (A4 แนวนอน)
 * ล้วน ๆ ไม่แตะฐานข้อมูล เพื่อให้ทดสอบและพรีวิวได้
 */
export const REGISTER_MINISTRY = "สำนักงานปลัดกระทรวงสาธารณสุข";

export type RegisterAsset = {
  id: number;
  assetNumber: string;
  assetRegistrationNo?: string;
  assetName: string;
  assetClass?: string | null;
  deviceType?: string | null;
  manufacturerBrand?: string | null;
  manufacturerModel?: string | null;
  manufacturerSpecification?: string | null;
  serialNumber?: string | null;
  facilityName?: string | null;
  workGroupName?: string | null;
  locationDetail?: string | null;
  vendorName?: string | null;
  unitName?: string | null;
  purchasePrice?: number | null;
  purchaseDate?: string | null;
  installedAt?: string | null;
  purchaseOrderNo?: string | null;
  usefulLifeYears?: number | null;
  fundingSource?: string | null;
  acquisitionMethod?: string | null;
};

export type CheckboxOption = { label: string; checked: boolean; note?: string };

export type RegisterSheetRow = {
  date: string;
  documentNo: string;
  detail: string;
  quantity: string;
  unitPrice: string;
  total: string;
  life: string;
  rate: string;
  depreciation: string;
  accumulated: string;
  bookValue: string;
  note: string;
};

export type RegisterSheet = {
  assetId: number;
  ministry: string;
  facilityName: string;
  assetClassLabel: string;
  assetNumber: string;
  specification: string;
  model: string;
  location: string;
  vendorName: string;
  fundingOptions: CheckboxOption[];
  methodOptions: CheckboxOption[];
  startNote: string;
  rows: RegisterSheetRow[];
  /** ข้อมูลที่ยังกรอกไม่ครบ เพื่อเตือนบนหน้าจอ (ไม่พิมพ์ลงเอกสาร) */
  missing: string[];
};

const FUNDING_BOXES: Array<{ label: string; match: string[] }> = [
  { label: "เงินงบประมาณ", match: ["Budget"] },
  { label: "เงินนอกงบประมาณ (เงินบำรุง)", match: ["Maintenance"] },
  { label: "เงินบริจาค/เงินช่วยเหลือ", match: ["Donation"] },
  { label: "อื่น ๆ", match: ["Fund", "Other"] },
];

const METHOD_BOXES: Array<{ label: string; match: string[] }> = [
  { label: "เฉพาะเจาะจง", match: ["Specific"] },
  { label: "สอบราคา", match: [] },
  { label: "ประกวดราคา", match: ["EBidding", "EMarket"] },
  { label: "วิธีคัดเลือก", match: ["Selection"] },
  { label: "รับบริจาค", match: ["Donation"] },
  { label: "อื่น ๆ", match: ["Transfer", "Other"] },
];

function boxes(options: Array<{ label: string; match: string[] }>, value: string, noteFor: (value: string) => string) {
  const code = (value ?? "").trim();
  const list: CheckboxOption[] = options.map((option) => ({ label: option.label, checked: Boolean(code) && option.match.includes(code) }));
  const other = list[list.length - 1];
  if (other.checked) other.note = noteFor(code);
  return list;
}

/** จำนวนบรรทัดในตารางอย่างน้อย เพื่อให้เอกสารเต็มหน้า A4 แนวนอน */
export const REGISTER_MIN_ROWS = 12;

const blankRow = (): RegisterSheetRow => ({ date: "", documentNo: "", detail: "", quantity: "", unitPrice: "", total: "", life: "", rate: "", depreciation: "", accumulated: "", bookValue: "", note: "" });

export function buildRegisterSheet(asset: RegisterAsset, lifeYears: number | null, annualRatePercent: number | null): RegisterSheet {
  const acquiredOn = asset.purchaseDate || asset.installedAt || "";
  const cost = asset.purchasePrice ?? null;
  const schedule: RegisterSchedule | null = cost && acquiredOn && lifeYears
    ? buildRegisterSchedule({ cost, acquiredOn, lifeYears, annualRatePercent })
    : null;

  const rows: RegisterSheetRow[] = [];
  // ชื่อรายการ + ยี่ห้อ/รุ่น โดยไม่ซ้ำกับที่มีอยู่ในชื่อแล้ว
  const plain = (value: string) => value.toLowerCase().replace(/\s+/g, "");
  const baseName = asset.assetName ?? "";
  const extras = [asset.manufacturerBrand, asset.manufacturerModel]
    .map((value) => (value ?? "").trim())
    .filter((value) => value && !plain(baseName).includes(plain(value)));
  const name = [baseName, extras.join(" ")].filter(Boolean).join(" ");
  rows.push({
    ...blankRow(),
    date: shortThaiDate(acquiredOn),
    documentNo: asset.purchaseOrderNo ?? "",
    detail: name,
    quantity: `1 ${asset.unitName?.trim() || "เครื่อง"}`,
    unitPrice: bahtText(cost),
    total: bahtText(cost),
    life: lifeYears ? String(lifeYears) : "",
    rate: annualRatePercent ? annualRatePercent.toFixed(2) : "",
    depreciation: cost ? "0.00" : "",
    accumulated: cost ? "0.00" : "",
    bookValue: bahtText(cost),
  });
  rows.push({ ...blankRow(), date: schedule ? `เริ่มคิด ${shortSlashDate(schedule.startOn)}` : "", detail: asset.serialNumber ? `S/N ${asset.serialNumber}` : "" });
  rows.push(blankRow());

  for (const row of schedule?.rows ?? []) {
    rows.push({
      ...blankRow(),
      date: shortThaiDate(row.endDate),
      detail: `คำนวณค่าเสื่อมราคาปีงบ ${row.fiscalYear}`,
      depreciation: bahtText(row.depreciation),
      accumulated: bahtText(row.accumulated),
      bookValue: bahtText(row.bookValue),
      note: periodMonthsLabel(row.startOn, row.endDate),
    });
  }
  while (rows.length < REGISTER_MIN_ROWS) rows.push(blankRow());

  const missing: string[] = [];
  if (!cost) missing.push("ราคาทุน");
  if (!acquiredOn) missing.push("วันที่ได้มา");
  if (!lifeYears) missing.push("อายุการใช้งาน");
  if (!asset.vendorName) missing.push("ผู้ขาย/ผู้บริจาค");
  if (!asset.fundingSource) missing.push("ประเภทเงิน");
  if (!asset.acquisitionMethod) missing.push("วิธีการได้มา");

  return {
    assetId: asset.id,
    ministry: REGISTER_MINISTRY,
    facilityName: asset.facilityName ?? "",
    assetClassLabel: assetClassLabel(asset.assetClass, "full"),
    assetNumber: asset.assetNumber || asset.assetRegistrationNo || "",
    specification: asset.manufacturerSpecification?.trim() || asset.deviceType || "",
    model: [asset.manufacturerBrand, asset.manufacturerModel].filter(Boolean).join(" รุ่น ") || "",
    location: [asset.workGroupName, asset.locationDetail].filter(Boolean).join(" · "),
    vendorName: asset.vendorName ?? "",
    fundingOptions: boxes(FUNDING_BOXES, asset.fundingSource ?? "", (code) => fundingSourceLabel(code)),
    methodOptions: boxes(METHOD_BOXES, asset.acquisitionMethod ?? "", (code) => acquisitionMethodLabel(code)),
    startNote: schedule
      ? `เริ่มคิดค่าเสื่อมราคา ${shortSlashDate(schedule.startOn)} ถึง ${shortSlashDate(schedule.endOn)} · คิดรายวัน · คงเหลือ 1 บาท`
      : "",
    rows,
    missing,
  };
}
