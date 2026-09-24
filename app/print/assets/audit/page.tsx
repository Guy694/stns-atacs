import { redirect } from "next/navigation";

import { PrintToolbar } from "@/app/print/_components/print-toolbar";
import { CHECK_SHEET_CSS, CheckSheetView } from "@/app/print/assets/audit/_components/check-sheet";
import { buildCheckSheet, type CheckSheetResult, type CommitteeSigner } from "@/lib/annual-check-sheet";
import { ASSET_CLASS_OPTIONS } from "@/lib/asset-classes";
import { assetStatusLabel } from "@/lib/asset-status";
import { listAssets, getFacilityById, type AssetWithFacility } from "@/lib/assets";
import { fiscalYearOf } from "@/lib/asset-valuation";
import { getCurrentUser } from "@/lib/auth";
import { formatThaiDate } from "@/lib/date-format";
import { getInspectionCommittee, getInspectionItems } from "@/lib/inspection";
import { listFacilityWorkGroups } from "@/lib/facility-work-groups";
import { canAccessAssetFacility } from "@/lib/permissions";
import { hasPermission } from "@/lib/role-permissions";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? "";
const MAX_ROWS = 2000;

/**
 * ใบตรวจสอบพัสดุประจำปี (A4 แนวนอน) — พิมพ์หรือบันทึกเป็น PDF
 *
 *   /print/assets/audit?facility=1&workGroup=3          ครุภัณฑ์ทุกประเภทของกลุ่มงานนั้น
 *   /print/assets/audit?facility=1&assetClass=IT        เฉพาะประเภทที่เลือก
 *   &year=2569        ปีที่ตรวจสอบ (ค่าเริ่มต้น = ปีงบประมาณปัจจุบัน)
 *   &inspection=12    ดึงรายชื่อคณะกรรมการและ "ผลตรวจ" จากรอบตรวจนับนั้น
 *
 * ช่อง "สถานะพัสดุ" เติมจากผลที่กรรมการสแกน QR บันทึกไว้ในรอบตรวจนับเท่านั้น
 * รายการที่ยังไม่ได้ตรวจผ่านระบบ หรือไม่ได้ระบุรอบ จะเว้นว่างไว้ให้เขียนมือ
 */
export default async function AnnualCheckPrintPage({ searchParams }: Props) {
  const params = await searchParams;
  const user = await getCurrentUser();
  const query = new URLSearchParams(
    Object.entries(params).flatMap(([key, value]) =>
      Array.isArray(value) ? value.map((item) => [key, item]) : value ? [[key, value]] : []
    )
  );
  if (!user) redirect(`/login?next=${encodeURIComponent(`/print/assets/audit?${query.toString()}`)}`);
  if (!(await hasPermission(user.role, "assets.view"))) redirect("/dashboard");

  const facilityId = Number(one(params.facility)) || Number(user.facilityId) || 0;
  if (!facilityId) redirect("/facilities");
  if (!canAccessAssetFacility(user, facilityId)) redirect("/facilities");

  const workGroupId = Number(one(params.workGroup)) || 0;
  const assetClass = one(params.assetClass);
  const yearBE = Number(one(params.year)) || fiscalYearOf(new Date().toISOString().slice(0, 10));
  const inspectionId = Number(one(params.inspection)) || 0;

  const [facility, workGroups] = await Promise.all([
    getFacilityById(facilityId),
    listFacilityWorkGroups(facilityId).catch(() => []),
  ]);

  let assets: AssetWithFacility[] = await listAssets({
    facilityId,
    ...(workGroupId ? { workGroupId } : {}),
    ...(assetClass ? { assetClass } : {}),
  });
  // ครุภัณฑ์ที่จำหน่าย/สูญหายแล้วไม่อยู่ในใบตรวจสอบประจำปี
  assets = assets.filter((asset) => asset.currentStatus !== "Disposed" && asset.currentStatus !== "Lost").slice(0, MAX_ROWS);

  let committee: CommitteeSigner[] = [];
  let results: Map<number, CheckSheetResult> | null = null;
  let checkedCount = 0;
  if (inspectionId) {
    const [committeeResult, items] = await Promise.all([
      getInspectionCommittee(inspectionId).catch(() => ({ members: [], schemaReady: false })),
      getInspectionItems(inspectionId).catch(() => []),
    ]);
    committee = committeeResult.members.map((member) => ({ role: member.role, fullName: member.fullName, position: member.position }));
    results = new Map(
      items.map((item) => [item.assetId, { inspectionStatus: item.inspectionStatus, assetStatus: item.assetStatus }])
    );
    checkedCount = items.filter((item) => item.inspectionStatus !== "Pending").length;
  }

  const workGroupName = workGroups.find((group) => group.id === workGroupId)?.workGroupName ?? "";
  const sheet = buildCheckSheet(assets, {
    yearBE,
    facilityName: facility?.name ?? "-",
    workGroupName,
    results,
    statusLabel: assetStatusLabel,
  });

  const classLabel = assetClass ? ASSET_CLASS_OPTIONS.find((option) => option.value === assetClass)?.label ?? assetClass : "";
  const backHref = workGroupId || assetClass ? `/assets?facility=${facilityId}` : `/facilities/${facilityId}`;

  const pageCss = `
    @page { size: A4 landscape; margin: 10mm 8mm; }
    @media print {
      html, body { background: #fff !important; margin: 0 !important; padding: 0 !important; }
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .chk thead { display: table-header-group; }
      .chk tr { break-inside: avoid; page-break-inside: avoid; }
      .chk-sign { break-inside: avoid; page-break-inside: avoid; }
    }
    ${CHECK_SHEET_CSS}
    .chk-paper { margin: 0 auto; max-width: 277mm; background: #fff; padding: 8mm; }
    @media screen { .chk-paper { box-shadow: 0 6px 20px -12px rgba(0,0,0,.45); } }
  `;

  return (
    <main className="min-h-screen bg-stone-200 px-4 py-6 print:bg-white print:p-0">
      <style>{pageCss}</style>
      <div className="print:hidden">
        <PrintToolbar backHref={backHref} backLabel="กลับ" />
        <div className="mx-auto mb-4 max-w-[277mm] rounded-2xl bg-white p-4 text-sm shadow">
          <h1 className="text-base font-semibold">ใบตรวจสอบพัสดุประจำปี {yearBE} (A4 แนวนอน)</h1>
          <p className="mt-1 text-xs text-stone-600">
            {facility?.name ?? "-"}
            {workGroupName ? ` · ${workGroupName}` : ""}
            {classLabel ? ` · เฉพาะ${classLabel}` : " · ทุกประเภทครุภัณฑ์"} ·
            {" "}{sheet.totalCount.toLocaleString("th-TH")} รายการ · มูลค่ารวม {sheet.grandTotal.toLocaleString("th-TH", { minimumFractionDigits: 2 })} บาท
          </p>
          <p className="mt-1 text-xs text-stone-600">
            ตอนพิมพ์: กระดาษ A4 แนวนอน · ขนาด (Scale) 100% · ปิดหัวกระดาษและท้ายกระดาษ · เลือกเครื่องพิมพ์ “บันทึกเป็น PDF” เพื่อได้ไฟล์ PDF
          </p>
          <p className="mt-1 text-xs text-stone-600">
            ไม่รวมครุภัณฑ์ที่จำหน่าย/สูญหายแล้ว ·{" "}
            {inspectionId
              ? `ช่อง “สถานะพัสดุ” เติมจากผลตรวจของรอบนี้ ${checkedCount.toLocaleString("th-TH")} รายการ รายการที่ยังไม่ได้สแกนจะเว้นว่างไว้`
              : "ช่อง “สถานะพัสดุ” เว้นว่างให้กรรมการเขียนเอง (ไม่ได้ระบุรอบตรวจนับ)"}
          </p>
          {!inspectionId && (
            <p className="mt-1 text-xs text-amber-800">
              เปิดจากหน้ารอบตรวจนับ (หรือเพิ่ม ?inspection=&lt;เลขรอบ&gt;) เพื่อให้ระบบเติมผลตรวจจากการสแกน QR และชื่อคณะกรรมการให้อัตโนมัติ
            </p>
          )}
          {sheet.missingPriceCount > 0 && (
            <p className="mt-1 text-xs text-amber-800">
              มี {sheet.missingPriceCount.toLocaleString("th-TH")} รายการที่ยังไม่ระบุราคา จึงไม่ถูกนับในมูลค่ารวม
            </p>
          )}
        </div>
      </div>

      <div className="chk-paper">
        <CheckSheetView
          sheet={sheet}
          committee={committee}
          printedBy={user.fullName}
          printedAt={formatThaiDate(new Date())}
        />
      </div>
    </main>
  );
}
