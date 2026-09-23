import assert from "node:assert/strict";
import test from "node:test";
import { loadTs } from "./helpers/load-ts.mjs";

const register = loadTs("lib/asset-register.ts", {}, { Math, Number, Map, Array, String, Date, JSON });
const plain = (value) => JSON.parse(JSON.stringify(value));

test("เริ่มคิดค่าเสื่อมตั้งแต่วันที่รับเข้า และครบอายุการใช้งานก่อนวันเดียวกันของอีก n ปี", () => {
  assert.equal(register.depreciationStartDate("2024-01-19"), "2024-01-19");
  assert.equal(register.depreciationStartDate(""), "");
  assert.equal(register.usefulLifeEndDate("2024-01-19", 3), "2027-01-18");
  assert.equal(register.usefulLifeEndDate("2024-02-29", 1), "2025-02-28");
  assert.equal(register.usefulLifeEndDate("", 3), "");
});

// ตัวอย่างจริง: เครื่องพิมพ์ 12,500 บาท รับเข้า 19 ม.ค. 2567 อายุ 3 ปี อัตรา 33.33% คิดรายวัน
test("ตารางค่าเสื่อมรายวันตามปีงบประมาณ", () => {
  const schedule = register.buildRegisterSchedule({ cost: 12500, acquiredOn: "2024-01-19", lifeYears: 3, annualRatePercent: 33.33 });
  assert.equal(schedule.startOn, "2024-01-19");
  assert.equal(schedule.endOn, "2027-01-18");
  assert.equal(schedule.totalDays, 1096); // 3 ปี มีปีอธิกสุรทิน 1 ปี
  assert.equal(schedule.annualAmount, 4166.25);
  assert.equal(schedule.depreciable, 12499);
  assert.deepEqual(plain(schedule.rows), [
    // 19 ม.ค.–30 ก.ย. 2567 = 256 วัน จากปีงบ 366 วัน → 4,166.25 × 256/366
    { fiscalYear: 2567, startOn: "2024-01-19", endDate: "2024-09-30", days: 256, depreciation: 2914.1, accumulated: 2914.1, bookValue: 9585.9 },
    { fiscalYear: 2568, startOn: "2024-10-01", endDate: "2025-09-30", days: 365, depreciation: 4166.25, accumulated: 7080.35, bookValue: 5419.65 },
    { fiscalYear: 2569, startOn: "2025-10-01", endDate: "2026-09-30", days: 365, depreciation: 4166.25, accumulated: 11246.6, bookValue: 1253.4 },
    // งวดสุดท้ายรับส่วนต่างที่เหลือ เพื่อให้มูลค่าสุทธิเหลือ 1 บาทพอดี
    { fiscalYear: 2570, startOn: "2026-10-01", endDate: "2027-01-18", days: 110, depreciation: 1252.4, accumulated: 12499, bookValue: 1 },
  ]);
});

test("ได้มาวันแรกของปีงบ → ปีแรกเต็มปี และรวมค่าเสื่อม = ราคาทุน − 1 เสมอ", () => {
  for (const [cost, life, rate] of [[45000, 5, 20], [12500, 3, 33.33], [999999, 8, 12.5], [5001, 3, null]]) {
    const schedule = register.buildRegisterSchedule({ cost, acquiredOn: "2025-10-01", lifeYears: life, annualRatePercent: rate });
    const rows = plain(schedule.rows);
    assert.equal(rows.length, life, `${cost}: ควรมี ${life} แถว`);
    assert.equal(rows[0].days, 365);
    assert.equal(rows[0].startOn, "2025-10-01");
    const total = rows.reduce((sum, row) => sum + row.depreciation, 0);
    assert.ok(Math.abs(total - (cost - 1)) < 0.005, `${cost}: รวม ${total}`);
    assert.equal(rows.at(-1).bookValue, 1);
    assert.equal(rows.at(-1).endDate, `${2025 + life}-09-30`);
  }
});

test("ข้อมูลไม่พอคำนวณ", () => {
  assert.equal(register.buildRegisterSchedule({ cost: 0, acquiredOn: "2024-01-19", lifeYears: 3 }), null);
  assert.equal(register.buildRegisterSchedule({ cost: 12500, acquiredOn: "", lifeYears: 3 }), null);
  assert.equal(register.buildRegisterSchedule({ cost: 12500, acquiredOn: "2024-01-19", lifeYears: 0 }), null);
  assert.equal(register.registerRowOf(null, 2567), null);
});

test("หมายเหตุแสดงเป็นเดือน (มีเศษบอกเป็นวัน)", () => {
  assert.equal(register.periodMonthsLabel("2024-01-19", "2024-09-30"), "8 เดือน 12 วัน");
  assert.equal(register.periodMonthsLabel("2024-10-01", "2025-09-30"), "12 เดือน");
  assert.equal(register.periodMonthsLabel("2026-10-01", "2027-01-18"), "3 เดือน 18 วัน");
  assert.equal(register.periodMonthsLabel("2024-01-19", "2024-01-31"), "13 วัน");
  assert.equal(register.periodMonthsLabel("", "2024-09-30"), "");
  assert.deepEqual(plain(register.periodMonths("2024-02-29", "2025-02-27")), { months: 11, days: 30 });
});
