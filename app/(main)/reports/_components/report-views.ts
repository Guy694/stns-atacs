export const REPORT_VIEW_GROUPS = [
  {
    label: "ภาพรวม",
    views: [
      { key: "summary", label: "ภาพรวม" },
      { key: "facility", label: "แยกตามหน่วยงาน" },
      { key: "type", label: "แยกตามประเภท" },
      { key: "expiring", label: "ใกล้หมดอายุ MA" },
      { key: "broken", label: "ชำรุด / ไม่ใช้งาน" },
    ],
  },
  {
    label: "การเงิน",
    views: [
      { key: "valuation", label: "มูลค่าและค่าเสื่อมราคา" },
      { key: "depreciation", label: "สรุปค่าเสื่อมรายปีงบ" },
      { key: "replacement", label: "แผนทดแทน" },
    ],
  },
  {
    label: "ซ่อม–โอน–จำหน่าย",
    views: [
      { key: "repairs", label: "งานซ่อม" },
      { key: "transfers", label: "โอนย้าย" },
      { key: "disposal", label: "จำหน่าย / สูญหาย" },
    ],
  },
] as const;

export type ReportView = (typeof REPORT_VIEW_GROUPS)[number]["views"][number]["key"];

export function reportViewHref(key: ReportView, fiscalYear: number, currentFiscalYear: number) {
  return `/reports?view=${key}${fiscalYear !== currentFiscalYear ? `&fy=${fiscalYear}` : ""}`;
}
