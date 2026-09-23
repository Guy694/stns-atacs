import { fiscalYearOf, fiscalYearRange } from "@/lib/asset-valuation";

/**
 * ทะเบียนคุมทรัพย์สิน (แบบของทางราชการ): ตารางค่าเสื่อมราคารายปีงบประมาณ
 * วิธีคิดตามที่หน่วยงานใช้จริง
 * - เริ่มคิดค่าเสื่อมราคาตั้งแต่วันที่รับเข้า (วันที่ได้มา) และคิดเป็นรายวัน
 * - ค่าเสื่อมราคาต่อปี = ราคาทุน × อัตราต่อปี (เช่น 33.33% สำหรับอายุใช้งาน 3 ปี)
 * - ปิดยอดทุกวันที่ 30 กันยายน (สิ้นปีงบประมาณ) เฉลี่ยตามจำนวนวันที่คิดในปีงบนั้น ÷ จำนวนวันของปีงบนั้น
 * - ตัดค่าเสื่อมได้ไม่เกิน (ราคาทุน − 1 บาท) งวดสุดท้ายรับส่วนต่างที่เหลือทั้งหมด แล้วมูลค่าสุทธิคงเหลือ 1 บาทตลอดไป
 * ไฟล์นี้เป็นการคำนวณล้วน ไม่แตะฐานข้อมูล
 */
export const REGISTER_RESIDUAL_VALUE = 1;

export type RegisterInput = {
  /** ราคาทุน (บาท) */
  cost: number;
  /** วันที่ได้มา/รับเข้า YYYY-MM-DD — เริ่มคิดค่าเสื่อมราคาวันนี้เลย */
  acquiredOn: string;
  /** อายุการใช้งาน (ปี) */
  lifeYears: number;
  /** อัตราค่าเสื่อมราคาต่อปี (%) — ไม่ระบุจะใช้ 100 / อายุการใช้งาน */
  annualRatePercent?: number | null;
};

export type RegisterRow = {
  fiscalYear: number;
  /** วันแรกของช่วงที่คิดในปีงบนี้ */
  startOn: string;
  /** วันปิดยอด (30 กันยายน) หรือวันสุดท้ายของอายุการใช้งาน ถ้าครบก่อน */
  endDate: string;
  /** จำนวนวันที่คิดค่าเสื่อมในปีงบนี้ */
  days: number;
  depreciation: number;
  accumulated: number;
  bookValue: number;
};

export type RegisterSchedule = {
  cost: number;
  /** วันที่เริ่มคิดค่าเสื่อมราคา = วันที่รับเข้า */
  startOn: string;
  /** วันสุดท้ายของอายุการใช้งาน */
  endOn: string;
  lifeYears: number;
  ratePercent: number;
  annualAmount: number;
  totalDays: number;
  /** จำนวนที่ตัดค่าเสื่อมได้ทั้งหมด = ราคาทุน − 1 */
  depreciable: number;
  rows: RegisterRow[];
};

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const DATE = /^\d{4}-\d{2}-\d{2}/;
const DAY_MS = 86_400_000;

const toMs = (iso: string) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
const toIso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const inclusiveDays = (fromMs: number, toMsValue: number) => Math.round((toMsValue - fromMs) / DAY_MS) + 1;

/** เริ่มคิดค่าเสื่อมราคาตั้งแต่วันที่รับเข้า */
export function depreciationStartDate(acquiredOn: string) {
  const value = String(acquiredOn ?? "").slice(0, 10);
  return DATE.test(value) ? value : "";
}

/** วันสุดท้ายของอายุการใช้งาน (รับเข้า 19 ม.ค. 67 อายุ 3 ปี → 18 ม.ค. 70) */
export function usefulLifeEndDate(acquiredOn: string, lifeYears: number) {
  const startOn = depreciationStartDate(acquiredOn);
  if (!startOn || !Number.isFinite(lifeYears) || lifeYears <= 0) return "";
  const date = new Date(toMs(startOn));
  date.setUTCFullYear(date.getUTCFullYear() + Math.round(lifeYears));
  return toIso(date.getTime() - DAY_MS);
}

/**
 * ตารางค่าเสื่อมราคารายปีงบประมาณ คิดรายวันตั้งแต่วันที่รับเข้า
 * ค่าเสื่อมของปีงบ = ค่าเสื่อมต่อปี × (จำนวนวันที่คิดในปีงบนั้น ÷ จำนวนวันของปีงบนั้น)
 * และไม่เกิน (ราคาทุน − 1) โดยงวดสุดท้ายรับส่วนต่างที่เหลือทั้งหมด
 */
export function buildRegisterSchedule(input: RegisterInput): RegisterSchedule | null {
  const cost = Number(input.cost);
  const lifeYears = Number(input.lifeYears);
  if (!Number.isFinite(cost) || cost <= REGISTER_RESIDUAL_VALUE) return null;
  if (!Number.isFinite(lifeYears) || lifeYears <= 0) return null;
  const startOn = depreciationStartDate(input.acquiredOn);
  const endOn = usefulLifeEndDate(input.acquiredOn, lifeYears);
  if (!startOn || !endOn) return null;

  const ratePercent = input.annualRatePercent && input.annualRatePercent > 0 ? input.annualRatePercent : round2(100 / lifeYears);
  const annualAmount = round2((cost * ratePercent) / 100);
  const depreciable = round2(cost - REGISTER_RESIDUAL_VALUE);
  const startMs = toMs(startOn);
  const endMs = toMs(endOn);

  const rows: RegisterRow[] = [];
  let accumulated = 0;
  for (let fiscalYear = fiscalYearOf(startOn); fiscalYear <= fiscalYearOf(endOn); fiscalYear += 1) {
    const range = fiscalYearRange(fiscalYear);
    const fyStart = toMs(range.start);
    const fyEnd = toMs(range.end);
    const periodStart = Math.max(fyStart, startMs);
    const periodEnd = Math.min(fyEnd, endMs);
    if (periodEnd < periodStart) continue;
    const remaining = round2(depreciable - accumulated);
    if (remaining <= 0) break;
    const days = inclusiveDays(periodStart, periodEnd);
    const share = (annualAmount * days) / inclusiveDays(fyStart, fyEnd);
    const depreciation = Math.min(round2(share), remaining);
    accumulated = round2(accumulated + depreciation);
    rows.push({
      fiscalYear,
      startOn: toIso(periodStart),
      endDate: toIso(periodEnd),
      days,
      depreciation,
      accumulated,
      bookValue: round2(cost - accumulated),
    });
  }
  // เศษจากการปัดเศษหรืออัตราที่รวมไม่ถึง 100% ใส่ในงวดสุดท้าย เพื่อให้เหลือ 1 บาทพอดี
  const last = rows[rows.length - 1];
  if (last && accumulated < depreciable) {
    last.depreciation = round2(last.depreciation + (depreciable - accumulated));
    last.accumulated = depreciable;
    last.bookValue = REGISTER_RESIDUAL_VALUE;
  }

  return { cost, startOn, endOn, lifeYears, ratePercent, annualAmount, totalDays: inclusiveDays(startMs, endMs), depreciable, rows };
}

/** แถวของปีงบประมาณที่ระบุ (ใช้ตอนกรอกทะเบียนประจำปี) */
export function registerRowOf(schedule: RegisterSchedule | null, fiscalYear: number) {
  return schedule?.rows.find((row) => row.fiscalYear === fiscalYear) ?? null;
}

/**
 * ความยาวของช่วงเป็น "เดือน" สำหรับช่องหมายเหตุในทะเบียน
 * นับเดือนเต็มจากวันเริ่ม แล้วบอกเศษเป็นวัน เช่น 19 ม.ค.–30 ก.ย. = "8 เดือน 12 วัน", 1 ต.ค.–30 ก.ย. = "12 เดือน"
 */
export function periodMonths(startOn: string, endOn: string) {
  if (!DATE.test(startOn) || !DATE.test(endOn)) return { months: 0, days: 0 };
  const start = new Date(toMs(startOn));
  const endExclusive = new Date(toMs(endOn) + DAY_MS);
  let months = (endExclusive.getUTCFullYear() - start.getUTCFullYear()) * 12 + (endExclusive.getUTCMonth() - start.getUTCMonth());
  // นับจากวันเริ่มใหม่ทุกครั้ง (setUTCMonth ซ้อนกันจะเพี้ยนเมื่อวันเกินจำนวนวันของเดือนปลายทาง)
  const markerAt = (count: number) => {
    const marker = new Date(start.getTime());
    marker.setUTCMonth(start.getUTCMonth() + count);
    return marker.getTime();
  };
  while (months > 0 && markerAt(months) > endExclusive.getTime()) months -= 1;
  const days = Math.round((endExclusive.getTime() - markerAt(Math.max(0, months))) / DAY_MS);
  return { months: Math.max(0, months), days: Math.max(0, days) };
}

export function periodMonthsLabel(startOn: string, endOn: string) {
  const { months, days } = periodMonths(startOn, endOn);
  if (!months && !days) return "";
  const parts = [] as string[];
  if (months) parts.push(`${months.toLocaleString("th-TH")} เดือน`);
  if (days) parts.push(`${days.toLocaleString("th-TH")} วัน`);
  return parts.join(" ");
}

const THAI_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

/** "2024-01-19" → "19 ม.ค. 67" (ปี พ.ศ. 2 หลัก ตามแบบทะเบียนคุมทรัพย์สิน) */
export function shortThaiDate(iso: string | null | undefined, fallback = "") {
  const value = String(iso ?? "").slice(0, 10);
  if (!DATE.test(value)) return fallback;
  const [year, month, day] = value.split("-").map(Number);
  return `${day} ${THAI_MONTHS[month - 1]} ${String(year + 543).slice(-2)}`;
}

/** "2024-02-01" → "1/2/67" (บรรทัด "เริ่มคิด") */
export function shortSlashDate(iso: string | null | undefined, fallback = "") {
  const value = String(iso ?? "").slice(0, 10);
  if (!DATE.test(value)) return fallback;
  const [year, month, day] = value.split("-").map(Number);
  return `${day}/${month}/${String(year + 543).slice(-2)}`;
}

export function bahtText(value: number | null | undefined, fallback = "") {
  if (value === null || value === undefined || !Number.isFinite(value)) return fallback;
  return value.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
