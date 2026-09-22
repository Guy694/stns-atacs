import { headers } from "next/headers";
import { redirect } from "next/navigation";
import QRCode from "qrcode";

import { PrintToolbar } from "@/app/print/_components/print-toolbar";
import { isTerminalAssetStatus } from "@/lib/asset-status";
import { listAssets, listAssetsByIds, type AssetWithFacility } from "@/lib/assets";
import { getCurrentUser } from "@/lib/auth";
import { listFacilityWorkGroups } from "@/lib/facility-work-groups";
import { canAccessAssetFacility } from "@/lib/permissions";
import { shortFacilityName } from "@/lib/qr-label";
import { hasPermission } from "@/lib/role-permissions";
import {
  cellPosition,
  MAX_STICKERS,
  paginateStickers,
  parseIdList,
  perSheet,
  readStickerOptions,
  STICKER_PRESETS,
  stickerQrUrl,
  type StickerPreset,
} from "@/lib/sticker-sheet";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

type Sticker = { id: number; facility: string; number: string; name: string; qrSvg: string };

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? "";

async function siteOrigin() {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, "");
  if (configured && /^https?:\/\//.test(configured)) return configured;
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  return `${protocol}://${host}`;
}

async function buildSticker(asset: AssetWithFacility, origin: string, compact: boolean): Promise<Sticker> {
  // Margin 0: the label padding is the quiet zone. ECC "M" keeps the code small and still tolerant of scuffs.
  const qrSvg = await QRCode.toString(stickerQrUrl(origin, asset.id, compact), { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#000000", light: "#ffffff" } });
  return {
    id: asset.id,
    facility: shortFacilityName(asset.facilityName || ""),
    number: asset.assetNumber || asset.assetRegistrationNo || `#${asset.id}`,
    name: asset.assetName || "",
    qrSvg,
  };
}

function StickerCell({ sticker, preset }: { sticker: Sticker; preset: StickerPreset }) {
  const pad = preset.key === "mini" ? 1 : 1.5;
  return (
    <div className="flex h-full w-full items-center overflow-hidden" style={{ padding: `${pad}mm`, gap: `${pad}mm`, fontSize: `${preset.fontPt}pt`, lineHeight: 1.15 }}>
      <div className="shrink-0 [&>svg]:block [&>svg]:h-full [&>svg]:w-full" style={{ width: `${preset.qrMm}mm`, height: `${preset.qrMm}mm` }}
        dangerouslySetInnerHTML={{ __html: sticker.qrSvg }} />
      <div className="flex min-w-0 flex-1 flex-col justify-center" style={{ gap: "0.4mm" }}>
        {sticker.facility && <p className="line-clamp-2 font-bold text-black" style={{ fontSize: `${preset.fontPt * 0.9}pt`, lineHeight: 1.3 }}>{sticker.facility}</p>}
        <p className="font-bold text-black" style={{ fontSize: `${preset.fontPt * 1.05}pt`, overflowWrap: "anywhere", letterSpacing: preset.key === "mini" ? "-0.02em" : undefined }}>{sticker.number}</p>
        {preset.nameLines > 0 && sticker.name && (
          <p className="overflow-hidden text-black" style={{ display: "-webkit-box", WebkitLineClamp: preset.nameLines, WebkitBoxOrient: "vertical", lineHeight: 1.35, paddingTop: "0.2mm" }}>{sticker.name}</p>
        )}
      </div>
    </div>
  );
}

/**
 * A4 sheets of QR stickers → print or "Save as PDF". Assets: ?ids=1,2,3 or ?facility=ID[&workGroup=ID].
 * Options: size (preset), skip (labels already used on the first sheet), copies, dx/dy printer offset (mm), outline.
 */
export default async function StickerSheetPage({ searchParams }: Props) {
  const params = await searchParams;
  const user = await getCurrentUser();
  const query = new URLSearchParams(Object.entries(params).flatMap(([key, value]) => (Array.isArray(value) ? value.map((v) => [key, v]) : value ? [[key, value]] : [])));
  if (!user) redirect(`/login?next=${encodeURIComponent(`/print/stickers?${query.toString()}`)}`);
  if (!(await hasPermission(user.role, "assets.view"))) redirect("/dashboard");

  const options = readStickerOptions(params);
  const { preset } = options;
  const ids = parseIdList(params.ids);
  const facilityId = Number(one(params.facility)) || 0;
  const workGroupId = Number(one(params.workGroup)) || 0;
  const includeInactive = one(params.all) === "1";

  let assets: AssetWithFacility[] = [];
  let scopeText = "";
  if (ids.length) {
    assets = await listAssetsByIds(ids);
    scopeText = `เลือก ${ids.length.toLocaleString("th-TH")} รายการ`;
  } else if (facilityId) {
    if (!canAccessAssetFacility(user, facilityId)) redirect("/facilities");
    assets = await listAssets({ facilityId, ...(workGroupId ? { workGroupId } : {}) });
    scopeText = assets[0]?.facilityName ?? `หน่วยงาน #${facilityId}`;
  }
  // Only assets the user may see; disposed/lost assets are left out unless explicitly asked for.
  assets = assets.filter((asset) => canAccessAssetFacility(user, asset.facilityId) && (includeInactive || !isTerminalAssetStatus(asset.currentStatus)));
  const truncated = assets.length > MAX_STICKERS;
  assets = assets.slice(0, MAX_STICKERS);

  const workGroups = facilityId && !ids.length ? await listFacilityWorkGroups(facilityId) : [];
  const origin = await siteOrigin();
  const stickers = await Promise.all(assets.map((asset) => buildSticker(asset, origin, preset.key === "mini")));
  const pages = paginateStickers(stickers, preset, options.skip, options.copies);
  const backHref = ids.length === 1 ? `/assets/${ids[0]}` : facilityId ? `/facilities/${facilityId}` : "/assets";

  const pageCss = `
    @page { size: A4 portrait; margin: 0; }
    @media print {
      html, body { background: #fff !important; margin: 0 !important; padding: 0 !important; }
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .sticker-sheet { box-shadow: none !important; margin: 0 !important; break-after: page; page-break-after: always; }
      .sticker-sheet:last-child { break-after: auto; page-break-after: auto; }
    }`;

  return (
    <main className="min-h-screen bg-stone-200 px-4 py-6 print:bg-white print:p-0">
      <style>{pageCss}</style>
      <PrintToolbar backHref={backHref} backLabel="กลับ" />

      <form method="get" className="mx-auto mb-4 grid max-w-[210mm] gap-3 rounded-2xl bg-white p-4 text-sm shadow print:hidden sm:grid-cols-2">
        {ids.length > 0 && <input type="hidden" name="ids" value={ids.join(",")} />}
        {!ids.length && facilityId > 0 && <input type="hidden" name="facility" value={facilityId} />}
        <div className="sm:col-span-2">
          <h1 className="text-base font-semibold">พิมพ์สติ๊กเกอร์ QR เป็นชุด (A4)</h1>
          <p className="mt-1 text-xs text-stone-600">
            {scopeText || "ยังไม่ได้เลือกครุภัณฑ์"} · {stickers.length.toLocaleString("th-TH")} รายการ × {options.copies} ชุด = {pages.length.toLocaleString("th-TH")} แผ่น
            {truncated ? ` (แสดง ${MAX_STICKERS.toLocaleString("th-TH")} รายการแรก)` : ""}
          </p>
        </div>
        <label className="sm:col-span-2">
          <span className="text-xs font-medium text-stone-600">ขนาดสติ๊กเกอร์</span>
          <select name="size" defaultValue={preset.key} className="mt-1 min-h-11 w-full rounded-xl border border-stone-300 px-3">
            {STICKER_PRESETS.map((entry) => <option key={entry.key} value={entry.key}>{entry.label} — {entry.hint}</option>)}
          </select>
        </label>
        {workGroups.length > 0 && (
          <label>
            <span className="text-xs font-medium text-stone-600">กลุ่มงาน</span>
            <select name="workGroup" defaultValue={workGroupId || ""} className="mt-1 min-h-11 w-full rounded-xl border border-stone-300 px-3">
              <option value="">ทุกกลุ่มงาน</option>
              {workGroups.map((group) => <option key={group.id} value={group.id}>{group.workGroupName}</option>)}
            </select>
          </label>
        )}
        <label>
          <span className="text-xs font-medium text-stone-600">เว้นดวงที่ใช้ไปแล้วในแผ่นแรก (0–{perSheet(preset) - 1})</span>
          <input type="number" name="skip" min={0} max={perSheet(preset) - 1} defaultValue={options.skip} className="mt-1 min-h-11 w-full rounded-xl border border-stone-300 px-3" />
        </label>
        <label>
          <span className="text-xs font-medium text-stone-600">จำนวนชุดต่อรายการ</span>
          <input type="number" name="copies" min={1} max={5} defaultValue={options.copies} className="mt-1 min-h-11 w-full rounded-xl border border-stone-300 px-3" />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label>
            <span className="text-xs font-medium text-stone-600">เลื่อนซ้าย–ขวา (มม.)</span>
            <input type="number" name="dx" step={0.5} min={-10} max={10} defaultValue={options.offsetXMm} className="mt-1 min-h-11 w-full rounded-xl border border-stone-300 px-3" />
          </label>
          <label>
            <span className="text-xs font-medium text-stone-600">เลื่อนขึ้น–ลง (มม.)</span>
            <input type="number" name="dy" step={0.5} min={-10} max={10} defaultValue={options.offsetYMm} className="mt-1 min-h-11 w-full rounded-xl border border-stone-300 px-3" />
          </label>
        </div>
        <div className="flex flex-col justify-end gap-2">
          <label className="flex min-h-11 items-center gap-2">
            <input type="checkbox" name="outline" value="1" defaultChecked={options.outline} className="h-4 w-4" /> แสดงกรอบดวง (ทดลองพิมพ์บนกระดาษธรรมดา)
          </label>
          {!ids.length && (
            <label className="flex min-h-11 items-center gap-2">
              <input type="checkbox" name="all" value="1" defaultChecked={includeInactive} className="h-4 w-4" /> รวมรายการที่จำหน่าย/สูญหายแล้ว
            </label>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          <button type="submit" className="min-h-11 rounded-xl border border-stone-300 bg-stone-50 px-5 font-semibold hover:bg-stone-100">ปรับตัวอย่าง</button>
          <p className="text-xs text-stone-600">
            ตอนพิมพ์: กระดาษ A4 · ขนาด (Scale) 100% / “ขนาดจริง” · ระยะขอบ “ไม่มี” · ปิดหัวกระดาษและท้ายกระดาษ · เลือกเครื่องพิมพ์ “บันทึกเป็น PDF” เพื่อได้ไฟล์ PDF
            ควรทดลองพิมพ์ 1 แผ่นบนกระดาษธรรมดาแล้วทาบกับแผ่นสติ๊กเกอร์ก่อน หากเลื่อนให้ปรับ “เลื่อนซ้าย–ขวา / ขึ้น–ลง”
          </p>
        </div>
      </form>

      {!pages.length && (
        <p className="mx-auto max-w-[210mm] rounded-2xl bg-white p-6 text-center text-sm text-stone-600 shadow print:hidden">
          ไม่มีครุภัณฑ์ที่จะพิมพ์ — เปิดหน้านี้จากหน้าหน่วยงาน (พิมพ์สติ๊กเกอร์ A4) หรือหน้าครุภัณฑ์
        </p>
      )}

      {pages.map((cells, pageIndex) => (
        <section key={pageIndex} aria-label={`แผ่นที่ ${pageIndex + 1}`}
          className="sticker-sheet relative mx-auto mb-6 overflow-hidden bg-white shadow-lg"
          style={{ width: "210mm", height: "297mm" }}>
          {cells.map((sticker, index) => {
            const position = cellPosition(preset, index, options.offsetXMm, options.offsetYMm);
            const guide = options.outline || preset.cutGuides;
            return (
              <div key={index} className="absolute"
                style={{
                  left: `${position.left}mm`, top: `${position.top}mm`, width: `${preset.widthMm}mm`, height: `${preset.heightMm}mm`,
                  outline: guide ? `0.1mm ${preset.cutGuides && !options.outline ? "dashed #bbb" : "solid #999"}` : undefined,
                  outlineOffset: "-0.05mm",
                  borderRadius: preset.cutGuides ? 0 : "1.5mm",
                }}>
                {sticker && <StickerCell sticker={sticker} preset={preset} />}
              </div>
            );
          })}
        </section>
      ))}
    </main>
  );
}
