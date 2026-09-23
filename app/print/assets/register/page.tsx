import { redirect } from "next/navigation";

import { PrintToolbar } from "@/app/print/_components/print-toolbar";
import { REGISTER_SHEET_CSS, RegisterSheetView } from "@/app/print/assets/register/_components/register-sheet";
import { listAssets, listAssetsByIds, type AssetWithFacility } from "@/lib/assets";
import { resolveUsefulLife } from "@/lib/asset-valuation";
import { getCurrentUser } from "@/lib/auth";
import { formatThaiDate } from "@/lib/date-format";
import { canAccessAssetFacility } from "@/lib/permissions";
import { buildRegisterSheet } from "@/lib/register-sheet";
import { hasPermission } from "@/lib/role-permissions";
import { parseIdList } from "@/lib/sticker-sheet";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const MAX_SHEETS = 300;
const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? "";

/**
 * ทะเบียนคุมทรัพย์สิน (A4 แนวนอน) — 1 แผ่นต่อครุภัณฑ์ 1 รายการ พิมพ์หรือบันทึกเป็น PDF
 * เลือกด้วย ?ids=1,2,3 หรือ ?facility=ID[&workGroup=ID]
 * ค่าเสื่อมราคาคิดแบบทะเบียนราชการ: เริ่มเดือนถัดจากวันที่ได้มา ปิดยอดทุก 30 ก.ย. เหลือมูลค่าสุทธิ 1 บาท
 */
export default async function AssetRegisterPrintPage({ searchParams }: Props) {
  const params = await searchParams;
  const user = await getCurrentUser();
  const query = new URLSearchParams(
    Object.entries(params).flatMap(([key, value]) => (Array.isArray(value) ? value.map((item) => [key, item]) : value ? [[key, value]] : []))
  );
  if (!user) redirect(`/login?next=${encodeURIComponent(`/print/assets/register?${query.toString()}`)}`);
  if (!(await hasPermission(user.role, "assets.view"))) redirect("/dashboard");

  const ids = parseIdList(params.ids, MAX_SHEETS);
  const facilityId = Number(one(params.facility)) || 0;
  const workGroupId = Number(one(params.workGroup)) || 0;

  let assets: AssetWithFacility[] = [];
  if (ids.length) {
    assets = await listAssetsByIds(ids);
  } else if (facilityId) {
    if (!canAccessAssetFacility(user, facilityId)) redirect("/facilities");
    assets = await listAssets({ facilityId, ...(workGroupId ? { workGroupId } : {}) });
  }
  assets = assets.filter((asset) => canAccessAssetFacility(user, asset.facilityId)).slice(0, MAX_SHEETS);

  const today = formatThaiDate(new Date());
  const sheets = assets.map((asset) => {
    const life = resolveUsefulLife({ ...asset, subtypeName: asset.extensions[asset.assetClass]?.subtypeName });
    return {
      sheet: buildRegisterSheet(asset, life.years, life.annualRate),
      assetName: asset.assetName,
      assetNumber: asset.assetNumber,
    };
  });
  const incomplete = sheets.filter((entry) => entry.sheet.missing.length > 0);
  const backHref = ids.length === 1 ? `/assets/${ids[0]}` : facilityId ? `/facilities/${facilityId}` : "/assets";

  const pageCss = `
    @page { size: A4 landscape; margin: 0; }
    @media print {
      html, body { background: #fff !important; margin: 0 !important; padding: 0 !important; }
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .reg-sheet { box-shadow: none !important; margin: 0 !important; break-after: page; page-break-after: always; }
      .reg-sheet:last-of-type { break-after: auto; page-break-after: auto; }
    }
    ${REGISTER_SHEET_CSS}
    .reg-sheet { margin: 0 auto 6mm; box-shadow: 0 6px 20px -12px rgba(0,0,0,.45); }
  `;

  return (
    <main className="min-h-screen bg-stone-200 px-4 py-6 print:bg-white print:p-0">
      <style>{pageCss}</style>
      <div className="print:hidden">
        <PrintToolbar backHref={backHref} backLabel="กลับ" />
        <div className="mx-auto mb-4 max-w-[297mm] rounded-2xl bg-white p-4 text-sm shadow">
          <h1 className="text-base font-semibold">ทะเบียนคุมทรัพย์สิน (A4 แนวนอน)</h1>
          <p className="mt-1 text-xs text-stone-600">
            {sheets.length.toLocaleString("th-TH")} แผ่น (1 แผ่นต่อ 1 รายการ) · ค่าเสื่อมราคาเริ่มคิดเดือนถัดจากวันที่ได้มา
            ปิดยอดทุก 30 กันยายน และคงเหลือมูลค่าสุทธิ 1 บาทเมื่อครบอายุการใช้งาน
          </p>
          <p className="mt-1 text-xs text-stone-600">
            ตอนพิมพ์: กระดาษ A4 แนวนอน · ขนาด (Scale) 100% · ระยะขอบ “ไม่มี” · ปิดหัวกระดาษและท้ายกระดาษ · เลือกเครื่องพิมพ์ “บันทึกเป็น PDF” เพื่อได้ไฟล์ PDF
          </p>
          {incomplete.length > 0 && (
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              <p className="font-semibold">ข้อมูลไม่ครบ {incomplete.length.toLocaleString("th-TH")} รายการ — ช่องที่ขาดจะเว้นว่างให้เขียนเพิ่มในเอกสาร</p>
              <ul className="mt-1 list-disc pl-5">
                {incomplete.slice(0, 10).map((entry) => (
                  <li key={entry.sheet.assetId}>
                    {entry.assetNumber || `#${entry.sheet.assetId}`} {entry.assetName}: ขาด {entry.sheet.missing.join(", ")}
                  </li>
                ))}
              </ul>
              {incomplete.length > 10 && <p className="mt-1">… และอีก {(incomplete.length - 10).toLocaleString("th-TH")} รายการ</p>}
            </div>
          )}
          {sheets.length === 0 && (
            <p className="mt-3 text-center text-stone-600">
              ไม่มีครุภัณฑ์ที่จะพิมพ์ — เปิดหน้านี้จากหน้าครุภัณฑ์ (พิมพ์ทะเบียนคุมทรัพย์สิน) หรือหน้าหน่วยงาน
            </p>
          )}
        </div>
      </div>

      {sheets.map((entry) => (
        <RegisterSheetView key={entry.sheet.assetId} sheet={entry.sheet} printedBy={user.fullName} printedAt={today} />
      ))}
    </main>
  );
}
