import { notFound, redirect } from "next/navigation";

import { PrintToolbar } from "@/app/print/_components/print-toolbar";
import { acquisitionMethodLabel, fundingSourceLabel } from "@/lib/acquisition-options";
import { getAssetById } from "@/lib/assets";
import { listLoans } from "@/lib/asset-loans";
import { RETURN_CONDITION_LABELS } from "@/lib/loan-options";
import { assetClassLabel } from "@/lib/asset-classes";
import { listDisposalRequests } from "@/lib/asset-disposals";
import { listRepairs } from "@/lib/asset-repairs";
import { assetStatusLabel } from "@/lib/asset-status";
import { listAssetTransfers } from "@/lib/asset-transfers";
import { depreciationSchedule, valueAsset } from "@/lib/asset-valuation";
import { getCurrentUser } from "@/lib/auth";
import { formatThaiDate } from "@/lib/date-format";
import { DISPOSAL_REQUEST_TYPE_LABELS, DISPOSAL_STATUS_LABELS, disposalMethodLabel } from "@/lib/disposal-options";
import { listInspectionHistoryForAsset } from "@/lib/inspection";
import { canAccessAssetFacility } from "@/lib/permissions";
import { REPAIR_STATUS_LABELS } from "@/lib/repair-options";
import { hasPermission } from "@/lib/role-permissions";

type Props = { params: Promise<{ id: string }> };

const money = (value: number | null | undefined) => (value === null || value === undefined ? "" : value.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const INSPECTION_LABELS = { Found: "พบ", Missing: "ไม่พบ", Pending: "ยังไม่ตรวจ" } as const;

/**
 * ทะเบียนคุมทรัพย์สินรายชิ้น: acquisition details, the depreciation ledger by fiscal year and the asset's
 * history (transfers, repairs, inspections, disposal) on A4 for printing or saving as PDF.
 */
export default async function AssetCardPage({ params }: Props) {
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id <= 0) notFound();
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/print/assets/${id}`)}`);
  if (!(await hasPermission(user.role, "assets.view"))) redirect("/dashboard");
  const asset = await getAssetById(id);
  if (!asset) notFound();
  if (!canAccessAssetFacility(user, asset.facilityId)) redirect("/assets");

  const canViewRepairs = await hasPermission(user.role, "repairs.view");
  const [transfers, repairs, disposals, inspections, loans] = await Promise.all([
    listAssetTransfers(asset.id),
    canViewRepairs ? listRepairs({ assetId: asset.id, limit: 100 }) : Promise.resolve({ rows: [], schemaReady: true }),
    listDisposalRequests({ assetId: asset.id, limit: 50 }),
    listInspectionHistoryForAsset(asset.id),
    listLoans({ assetId: asset.id, limit: 50 }),
  ]);
  const today = new Date().toISOString().slice(0, 10);
  const valuationInput = { ...asset, subtypeName: asset.extensions[asset.assetClass]?.subtypeName };
  const valuation = valueAsset(valuationInput, today);
  const schedule = depreciationSchedule(valuationInput);
  const acquired = asset.purchaseDate || asset.installedAt;
  const location = [asset.workGroupName, asset.locationDetail].filter(Boolean).join(" · ");

  const info: Array<[string, string]> = [
    ["ส่วนราชการ / หน่วยงาน", `${asset.facilityName}${asset.districtName ? ` อำเภอ${asset.districtName}` : ""}`],
    ["ประเภท", `${assetClassLabel(asset.assetClass)}${valuation.life.categoryLabel ? ` · ${valuation.life.categoryLabel}` : ""}`],
    ["เลขครุภัณฑ์", asset.assetNumber || "-"],
    ["รหัสสินทรัพย์", asset.assetAccountingCode || "-"],
    ["ชื่อ / ลักษณะ", asset.assetName],
    ["ยี่ห้อ / รุ่น / แบบ", [asset.manufacturerBrand, asset.manufacturerModel].filter(Boolean).join(" / ") || "-"],
    ["รายละเอียด / คุณสมบัติ", asset.manufacturerSpecification || "-"],
    ["หมายเลข Serial", asset.serialNumber || "-"],
    ["สถานที่ตั้ง / หน่วยงานที่รับผิดชอบ", location || "-"],
    ["ผู้รับผิดชอบ", asset.ownerName || "-"],
    ["ผู้ขาย / ผู้รับจ้าง / ผู้บริจาค", asset.vendorName || "-"],
    ["ประเภทเงิน", fundingSourceLabel(asset.fundingSource) || "-"],
    ["วิธีการได้มา", acquisitionMethodLabel(asset.acquisitionMethod) || "-"],
    ["เลขที่สัญญา / ใบสั่งซื้อ", asset.purchaseOrderNo || "-"],
    ["สิ้นสุดการรับประกัน", asset.warrantyEndDate ? formatThaiDate(asset.warrantyEndDate) : "-"],
    ["สถานะปัจจุบัน", assetStatusLabel(asset.currentStatus)],
  ];

  const cell = "border border-black/60 px-1.5 py-1 align-top";
  const head = `${cell} bg-black/5 text-center font-semibold`;

  return (
    <main className="min-h-screen bg-stone-100 px-4 py-6 print:bg-white print:p-0">
      <style>{"@page { size: A4 portrait; margin: 12mm; } @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }"}</style>
      <PrintToolbar backHref={`/assets/${asset.id}`} backLabel="กลับไปหน้าครุภัณฑ์" />
      <article className="mx-auto max-w-[210mm] bg-white p-[12mm] text-[11px] leading-snug text-black shadow print:max-w-none print:p-0 print:shadow-none">
        <header className="text-center">
          <h1 className="text-base font-bold">ทะเบียนคุมทรัพย์สิน</h1>
          <p className="text-xs">{asset.facilityName}</p>
        </header>

        <table className="mt-3 w-full border-collapse">
          <tbody>
            {Array.from({ length: Math.ceil(info.length / 2) }, (_, row) => (
              <tr key={row}>
                {info.slice(row * 2, row * 2 + 2).map(([label, value]) => (
                  <td key={label} className={`${cell} w-1/2`}><span className="font-semibold">{label}:</span> {value}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        <h2 className="mt-4 text-sm font-bold">รายการได้มาและค่าเสื่อมราคา</h2>
        <p className="text-[10px]">
          อายุการใช้งาน {valuation.life.years ?? "-"} ปี · อัตราค่าเสื่อม {valuation.life.rateLabel || "-"} · วิธีเส้นตรง คงมูลค่าซาก 1 บาท
          {valuation.status === "below-threshold" ? " · ราคาต่ำกว่าเกณฑ์ 10,000 บาท ไม่คิดค่าเสื่อม" : ""}
        </p>
        <table className="mt-1 w-full border-collapse">
          <thead>
            <tr>
              {["วัน เดือน ปี", "ที่เอกสาร", "รายการ", "จำนวนหน่วย", "ราคาต่อหน่วย", "มูลค่ารวม", "ค่าเสื่อมราคาประจำปี", "ค่าเสื่อมราคาสะสม", "มูลค่าสุทธิ"].map((h) => <th key={h} className={head}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className={cell}>{acquired ? formatThaiDate(acquired) : "-"}</td>
              <td className={cell}>{asset.purchaseOrderNo || ""}</td>
              <td className={cell}>ได้มา · {asset.assetName}</td>
              <td className={`${cell} text-center`}>1 {asset.unitName}</td>
              <td className={`${cell} text-right`}>{money(asset.purchasePrice)}</td>
              <td className={`${cell} text-right`}>{money(asset.purchasePrice)}</td>
              <td className={cell} />
              <td className={cell} />
              <td className={`${cell} text-right`}>{money(asset.purchasePrice)}</td>
            </tr>
            {schedule.map((row) => (
              <tr key={row.fiscalYear} className={row.start > today ? "text-black/45" : undefined}>
                <td className={cell}>{formatThaiDate(row.end)}</td>
                <td className={cell} />
                <td className={cell}>ค่าเสื่อมราคาปีงบประมาณ {row.fiscalYear}{row.start > today ? " (ประมาณการ)" : ""}</td>
                <td className={cell} />
                <td className={cell} />
                <td className={cell} />
                <td className={`${cell} text-right`}>{money(row.depreciation)}</td>
                <td className={`${cell} text-right`}>{money(row.accumulated)}</td>
                <td className={`${cell} text-right`}>{money(row.bookValue)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {transfers.rows.length > 0 && (
          <>
            <h2 className="mt-4 text-sm font-bold">ประวัติการโอนย้าย</h2>
            <table className="mt-1 w-full border-collapse">
              <thead><tr>{["วันที่", "จาก", "ไปยัง", "เลขที่หนังสือ", "เหตุผล"].map((h) => <th key={h} className={head}>{h}</th>)}</tr></thead>
              <tbody>
                {transfers.rows.map((row) => (
                  <tr key={row.id}>
                    <td className={cell}>{formatThaiDate(row.transferDate)}</td>
                    <td className={cell}>{[row.fromFacilityName, row.fromWorkGroupName].filter(Boolean).join(" · ")}</td>
                    <td className={cell}>{[row.toFacilityName, row.toWorkGroupName].filter(Boolean).join(" · ")}</td>
                    <td className={cell}>{row.documentNo}</td>
                    <td className={cell}>{row.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {repairs.rows.length > 0 && (
          <>
            <h2 className="mt-4 text-sm font-bold">ประวัติการซ่อม</h2>
            <table className="mt-1 w-full border-collapse">
              <thead><tr>{["วันที่แจ้ง", "อาการ", "การแก้ไข / ผู้ซ่อม", "ค่าใช้จ่าย", "สถานะ"].map((h) => <th key={h} className={head}>{h}</th>)}</tr></thead>
              <tbody>
                {repairs.rows.map((row) => (
                  <tr key={row.id}>
                    <td className={cell}>{formatThaiDate(row.reportedAt)}</td>
                    <td className={cell}>{row.problem}</td>
                    <td className={cell}>{[row.resolution, row.vendorName || row.assignedTo].filter(Boolean).join(" · ")}</td>
                    <td className={`${cell} text-right`}>{money(row.cost)}</td>
                    <td className={cell}>{REPAIR_STATUS_LABELS[row.status]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {loans.rows.length > 0 && (
          <>
            <h2 className="mt-4 text-sm font-bold">ประวัติการยืม-คืน</h2>
            <table className="mt-1 w-full border-collapse">
              <thead><tr>{["ผู้ยืม", "วันที่ยืม", "กำหนดคืน", "วันที่คืน / สภาพ", "วัตถุประสงค์"].map((h) => <th key={h} className={head}>{h}</th>)}</tr></thead>
              <tbody>
                {loans.rows.map((row) => (
                  <tr key={row.id}>
                    <td className={cell}>{row.borrowerName}{row.borrowerUnit ? ` (${row.borrowerUnit})` : ""}</td>
                    <td className={cell}>{formatThaiDate(row.loanedOn)}</td>
                    <td className={cell}>{formatThaiDate(row.dueOn)}</td>
                    <td className={cell}>{row.status === "OnLoan" ? "ยังไม่คืน" : row.status === "Cancelled" ? "ยกเลิก" : `${formatThaiDate(row.returnedOn)} · ${row.returnCondition ? RETURN_CONDITION_LABELS[row.returnCondition] : ""}`}</td>
                    <td className={cell}>{row.purpose}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {inspections.length > 0 && (
          <>
            <h2 className="mt-4 text-sm font-bold">ผลการตรวจสอบพัสดุประจำปี</h2>
            <table className="mt-1 w-full border-collapse">
              <thead><tr>{["รอบตรวจนับ", "วันที่เริ่ม", "ผลตรวจ", "สภาพ", "หมายเหตุ / ผู้ตรวจ"].map((h) => <th key={h} className={head}>{h}</th>)}</tr></thead>
              <tbody>
                {inspections.map((row) => (
                  <tr key={row.inspectionId}>
                    <td className={cell}>{row.roundName}</td>
                    <td className={cell}>{formatThaiDate(row.startDate)}</td>
                    <td className={cell}>{INSPECTION_LABELS[row.inspectionStatus]}</td>
                    <td className={cell}>{row.assetStatus ? assetStatusLabel(row.assetStatus) : ""}</td>
                    <td className={cell}>{[row.conditionNote, row.checkedBy].filter(Boolean).join(" · ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {disposals.rows.length > 0 && (
          <>
            <h2 className="mt-4 text-sm font-bold">การจำหน่าย / สูญหาย</h2>
            <table className="mt-1 w-full border-collapse">
              <thead><tr>{["วันที่เสนอ", "ประเภท / วิธี", "เหตุผล", "ผลการพิจารณา", "เลขที่หนังสือ"].map((h) => <th key={h} className={head}>{h}</th>)}</tr></thead>
              <tbody>
                {disposals.rows.map((row) => (
                  <tr key={row.id}>
                    <td className={cell}>{formatThaiDate(row.eventDate)}</td>
                    <td className={cell}>{DISPOSAL_REQUEST_TYPE_LABELS[row.requestType]}{row.disposalMethod ? ` · ${disposalMethodLabel(row.disposalMethod)}` : ""}</td>
                    <td className={cell}>{row.reason}</td>
                    <td className={cell}>{DISPOSAL_STATUS_LABELS[row.status]}{row.decidedAt ? ` ${formatThaiDate(row.decidedAt)}` : ""}</td>
                    <td className={cell}>{row.approvalDocumentNo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        <p className="mt-6 text-right text-[10px]">พิมพ์เมื่อ {formatThaiDate(today)} โดย {user.fullName}</p>
      </article>
    </main>
  );
}
