import { redirect } from "next/navigation";

import { PrintToolbar } from "@/app/print/_components/print-toolbar";
import { ASSET_CLASS_OPTIONS, assetClassLabel } from "@/lib/asset-classes";
import { CAPITALIZATION_THRESHOLD, fiscalYearOf, fiscalYearRange, VALUATION_STATUS_LABELS } from "@/lib/asset-valuation";
import { getCurrentUser } from "@/lib/auth";
import { listAssets } from "@/lib/assets";
import { formatThaiDate } from "@/lib/date-format";
import { resolveFacilityFilter } from "@/lib/facility-scope";
import { hasPermission } from "@/lib/role-permissions";
import { buildValuationSheet, filterValuationAssets } from "@/lib/valuation-sheet";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? "";
const MAX_ROWS = 2000;
const baht = (value: number | null | undefined) =>
  value === null || value === undefined ? "-" : value.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * รายงานสรุปมูลค่าคงเหลือครุภัณฑ์ (A4 แนวนอน) — พิมพ์หรือบันทึกเป็น PDF
 *
 *   /print/assets/valuation?fy=2569                       ทุกประเภท ตามสิทธิ์ของผู้ใช้
 *   &facility=1      เฉพาะหน่วยงาน (แอดมินเท่านั้น ผู้ใช้อื่นถูกล็อกตามหน่วยงานตัวเอง)
 *   &assetClass=IT   เฉพาะประเภทครุภัณฑ์
 *   &detail=0        ซ่อนตารางรายชิ้น (สรุปอย่างเดียว)
 */
export default async function ValuationPrintPage({ searchParams }: Props) {
  const params = await searchParams;
  const user = await getCurrentUser();
  const query = new URLSearchParams(
    Object.entries(params).flatMap(([key, value]) =>
      Array.isArray(value) ? value.map((item) => [key, item]) : value ? [[key, value]] : []
    )
  );
  if (!user) redirect(`/login?next=${encodeURIComponent(`/print/assets/valuation?${query.toString()}`)}`);
  if (!(await hasPermission(user.role, "reports.view"))) redirect("/dashboard");

  const requestedFacility = Number(one(params.facility)) || undefined;
  const facilityId = resolveFacilityFilter(user, requestedFacility);
  if (facilityId === null) redirect("/profile");

  const todayIso = new Date().toISOString().slice(0, 10);
  const fiscalYear = Number(one(params.fy)) || fiscalYearOf(todayIso);
  if (!Number.isInteger(fiscalYear) || fiscalYear < 2500 || fiscalYear > 2700) redirect("/reports?view=valuation");
  const assetClass = ASSET_CLASS_OPTIONS.some((option) => option.value === one(params.assetClass)) ? one(params.assetClass) : "";
  const showDetail = one(params.detail) !== "0";

  const all = await listAssets({ facilityId });
  const scoped = filterValuationAssets(
    all.map((asset) => ({ ...asset, subtypeName: asset.extensions[asset.assetClass]?.subtypeName })),
    { assetClass }
  );
  const { report, byFacility } = buildValuationSheet(scoped, fiscalYear, todayIso);

  const scopeLabel = facilityId ? all[0]?.facilityName ?? "หน่วยงานที่เลือก" : "ทุกหน่วยงาน";
  const classLabel = assetClass ? assetClassLabel(assetClass, "full") : "ทุกประเภทครุภัณฑ์";
  const range = fiscalYearRange(fiscalYear);
  const detailItems = report.items.slice(0, MAX_ROWS);
  const backHref = `/reports?view=valuation${fiscalYear !== fiscalYearOf(todayIso) ? `&fy=${fiscalYear}` : ""}`;

  const pageCss = `
    @page { size: A4 landscape; margin: 10mm 8mm; }
    @media print {
      html, body { background: #fff !important; margin: 0 !important; padding: 0 !important; }
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .val thead { display: table-header-group; }
      .val tr { break-inside: avoid; page-break-inside: avoid; }
      .val-break { break-before: page; page-break-before: always; }
    }
    .val { color: #000; background: #fff; font-size: 9pt; }
    .val-head { text-align: center; font-weight: 700; }
    .val-head h1 { margin: 0; font-size: 14pt; }
    .val-head p { margin: 1.5mm 0 0; font-size: 11pt; font-weight: 400; }
    .val h2 { margin: 6mm 0 0; font-size: 11pt; }
    .val table { width: 100%; border-collapse: collapse; margin-top: 2mm; }
    .val th, .val td { border: 0.3mm solid #333; padding: 1.1mm 1.5mm; vertical-align: middle; }
    .val thead th { background: #d9d9d9; text-align: center; font-size: 8.5pt; }
    .val .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
    .val .mid { text-align: center; }
    .val tr.total td { font-weight: 700; background: #f0f0f0; }
    .val-note { margin-top: 3mm; font-size: 8pt; color: #444; }
    .val-sign { margin-top: 12mm; display: flex; justify-content: flex-end; text-align: center; font-size: 10pt; break-inside: avoid; }
    .val-paper { margin: 0 auto; max-width: 277mm; background: #fff; padding: 8mm; }
    @media screen { .val-paper { box-shadow: 0 6px 20px -12px rgba(0,0,0,.45); } }
  `;

  const totalsRow = (label: string, totals: typeof report.totals, colSpan = 1) => (
    <tr className="total">
      <td colSpan={colSpan} className="mid">{label}</td>
      <td className="num">{totals.count.toLocaleString("th-TH")}</td>
      <td className="num">{baht(totals.cost)}</td>
      <td className="num">{baht(totals.depreciationThisYear)}</td>
      <td className="num">{baht(totals.accumulated)}</td>
      <td className="num">{baht(totals.bookValue)}</td>
      <td className="num">{totals.fullyDepreciated.toLocaleString("th-TH")}</td>
    </tr>
  );

  const summaryHead = (first: string) => (
    <thead>
      <tr>
        <th>{first}</th><th>จำนวน</th><th>ราคาทุน (บาท)</th><th>ค่าเสื่อมปีงบ {fiscalYear}</th><th>ค่าเสื่อมสะสม</th><th>มูลค่าสุทธิคงเหลือ</th><th>ครบอายุ</th>
      </tr>
    </thead>
  );

  const excludedEntries = (Object.keys(report.excluded) as Array<keyof typeof report.excluded>).filter((key) => report.excluded[key] > 0);

  return (
    <main className="min-h-screen bg-stone-200 px-4 py-6 print:bg-white print:p-0">
      <style>{pageCss}</style>
      <div className="print:hidden">
        <PrintToolbar backHref={backHref} backLabel="กลับหน้ารายงาน" />
        <div className="mx-auto mb-4 max-w-[277mm] rounded-2xl bg-white p-4 text-sm shadow">
          <h1 className="text-base font-semibold">รายงานสรุปมูลค่าคงเหลือครุภัณฑ์ ปีงบประมาณ {fiscalYear} (A4 แนวนอน)</h1>
          <p className="mt-1 text-xs text-stone-600">{scopeLabel} · {classLabel} · {report.totals.count.toLocaleString("th-TH")} รายการที่คิดค่าเสื่อม</p>
          <p className="mt-1 text-xs text-stone-600">ตอนพิมพ์: A4 แนวนอน · Scale 100% · ปิดหัวกระดาษและท้ายกระดาษ · เลือก “บันทึกเป็น PDF” เพื่อได้ไฟล์ PDF</p>
          {detailItems.length < report.items.length && (
            <p className="mt-1 text-xs text-amber-800">ตารางรายชิ้นแสดง {MAX_ROWS.toLocaleString("th-TH")} รายการแรกจาก {report.items.length.toLocaleString("th-TH")} รายการ (ยอดสรุปนับครบทุกรายการ)</p>
          )}
        </div>
      </div>

      <div className="val-paper">
        <section className="val">
          <div className="val-head">
            <h1>รายงานสรุปมูลค่าคงเหลือครุภัณฑ์ ปีงบประมาณ {fiscalYear}</h1>
            <p>{scopeLabel} · {classLabel}</p>
            <p>ณ วันที่ {formatThaiDate(report.asOf)} (ปีงบประมาณ {formatThaiDate(range.start)} – {formatThaiDate(range.end)})</p>
          </div>

          <h2>1. สรุปตามประเภท (ตารางอายุการใช้งาน)</h2>
          <table>
            {summaryHead("ประเภท")}
            <tbody>
              {report.rows.length === 0 ? (
                <tr><td colSpan={7} className="mid">ไม่มีรายการที่คิดค่าเสื่อมราคา</td></tr>
              ) : report.rows.map((row) => (
                <tr key={row.categoryId ?? row.categoryLabel}>
                  <td>{row.categoryLabel}</td>
                  <td className="num">{row.count.toLocaleString("th-TH")}</td>
                  <td className="num">{baht(row.cost)}</td>
                  <td className="num">{baht(row.depreciationThisYear)}</td>
                  <td className="num">{baht(row.accumulated)}</td>
                  <td className="num">{baht(row.bookValue)}</td>
                  <td className="num">{row.fullyDepreciated.toLocaleString("th-TH")}</td>
                </tr>
              ))}
              {report.rows.length > 0 && totalsRow("รวมทั้งสิ้น", report.totals)}
            </tbody>
          </table>

          {byFacility.length > 1 && (
            <>
              <h2>2. สรุปตามหน่วยงาน</h2>
              <table>
                {summaryHead("หน่วยงาน")}
                <tbody>
                  {byFacility.map((row) => (
                    <tr key={row.facilityId}>
                      <td>{row.facilityName}</td>
                      <td className="num">{row.totals.count.toLocaleString("th-TH")}</td>
                      <td className="num">{baht(row.totals.cost)}</td>
                      <td className="num">{baht(row.totals.depreciationThisYear)}</td>
                      <td className="num">{baht(row.totals.accumulated)}</td>
                      <td className="num">{baht(row.totals.bookValue)}</td>
                      <td className="num">{row.totals.fullyDepreciated.toLocaleString("th-TH")}</td>
                    </tr>
                  ))}
                  {totalsRow("รวมทั้งสิ้น", report.totals)}
                </tbody>
              </table>
            </>
          )}

          <p className="val-note">
            หมายเหตุ: คิดค่าเสื่อมราคาแบบเส้นตรง ราคาซาก 1 บาท คำนวณเป็นรายวันตามวันที่ได้มา · ไม่รวมรายการจำหน่าย/สูญหาย {report.terminalCount.toLocaleString("th-TH")} รายการ ·
            ครุภัณฑ์ราคาต่ำกว่า {CAPITALIZATION_THRESHOLD.toLocaleString("th-TH")} บาท ไม่คิดค่าเสื่อม
            {report.belowThresholdCost > 0 ? ` (มูลค่ารวม ${baht(report.belowThresholdCost)} บาท)` : ""}
            {excludedEntries.length > 0 && (
              <> · รายการที่ไม่นำมาคำนวณ: {excludedEntries.map((key) => `${VALUATION_STATUS_LABELS[key]} ${report.excluded[key].toLocaleString("th-TH")} รายการ`).join(", ")}</>
            )}
            {" "}· ตัวเลขเป็นการประมาณเพื่อบริหารทรัพย์สิน ไม่ใช่การบันทึกบัญชีแยกประเภท
          </p>

          {showDetail && (
            <div className="val-break">
              <h2>{byFacility.length > 1 ? "3" : "2"}. รายการครุภัณฑ์รายชิ้น</h2>
              <table style={{ tableLayout: "fixed" }}>
                <colgroup>
                  {["4%", "12%", "22%", "9%", "9%", "5%", "9%", "9%", "9%", "8%", "4%"].map((width, index) => <col key={index} style={{ width }} />)}
                </colgroup>
                <thead>
                  <tr>
                    <th>ที่</th><th>เลขทะเบียน</th><th>รายการ / หน่วยงาน</th><th>วันที่ได้มา</th><th>ราคาทุน</th><th>อายุ (ปี)</th>
                    <th>ค่าเสื่อมปีงบ</th><th>ค่าเสื่อมสะสม</th><th>มูลค่าคงเหลือ</th><th>ครบอายุ</th><th>หมายเหตุ</th>
                  </tr>
                </thead>
                <tbody>
                  {detailItems.map(({ asset, valuation, depreciationThisYear }, index) => (
                    <tr key={asset.id}>
                      <td className="mid">{index + 1}</td>
                      <td>{asset.assetRegistrationNo ?? "-"}</td>
                      <td>{asset.assetName}<br /><span style={{ fontSize: "7.5pt", color: "#555" }}>{asset.facilityName}</span></td>
                      <td className="mid">{valuation.startDate ? formatThaiDate(valuation.startDate) : "-"}</td>
                      <td className="num">{baht(valuation.cost)}</td>
                      <td className="mid">{valuation.life.years ?? "-"}</td>
                      <td className="num">{valuation.status === "ok" ? baht(depreciationThisYear) : "-"}</td>
                      <td className="num">{valuation.status === "ok" ? baht(valuation.accumulated) : "-"}</td>
                      <td className="num">{baht(valuation.bookValue)}</td>
                      <td className="mid">{valuation.status === "ok" && valuation.fullyDepreciatedOn ? formatThaiDate(valuation.fullyDepreciatedOn) : "-"}</td>
                      <td style={{ fontSize: "7.5pt" }}>{valuation.status === "ok" ? (valuation.isFullyDepreciated ? "ครบอายุ" : "") : VALUATION_STATUS_LABELS[valuation.status]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="val-sign">
            <div>
              <p>ลงชื่อ ................................................ ผู้จัดทำ</p>
              <p style={{ marginTop: "1.5mm" }}>({user.fullName})</p>
              <p style={{ marginTop: "1.5mm", fontSize: "8pt", color: "#444" }}>พิมพ์เมื่อ {formatThaiDate(new Date())}</p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
