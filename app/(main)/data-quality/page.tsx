import Link from "next/link";
import { redirect } from "next/navigation";

import { AppIcon } from "@/app/_components/ui/icon";
import { StatusBadge } from "@/app/_components/ui/status-badge";
import { numberFormat, percent } from "@/app/_components/overview-format";
import { listFacilities } from "@/lib/assets";
import { assetStatusLabel } from "@/lib/asset-status";
import { getCurrentUser } from "@/lib/auth";
import { QUALITY_CHECKS, QUALITY_GRADE_LABELS, qualityCheck, type QualityGrade } from "@/lib/data-quality";
import { getDataQuality, listIncompleteAssets, listSerialDuplicates } from "@/lib/data-quality-db";
import { getAssetFacilityScopeIds } from "@/lib/facility-scope";
import { hasPermission } from "@/lib/role-permissions";
import { SortableTh, TablePagination } from "@/app/_components/ui/data-table";
import { pageHref, paginate, readPage, readSort, sortHref, sortRows } from "@/lib/table-sort";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const read = (params: Record<string, string | string[] | undefined>, key: string) => {
  const value = params[key];
  return ((Array.isArray(value) ? value[0] : value) ?? "").trim();
};

const GRADE_TONES: Record<QualityGrade, "success" | "warning" | "danger"> = { good: "success", fair: "warning", poor: "danger" };
const LIST_CAP = 2000;
const barColor = (rate: number) => (rate >= 0.9 ? "#0ca30c" : rate >= 0.7 ? "#fab219" : "#d03b3b");

/** How complete each facility's register is, with drill-down to the assets missing a given field. */
export default async function DataQualityPage({ searchParams }: Props) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!(await hasPermission(user.role, "assets.view"))) redirect("/dashboard");
  const scopeIds = getAssetFacilityScopeIds(user);
  if (scopeIds === null) redirect("/profile");

  const params = await searchParams;
  const facilities = await listFacilities(scopeIds ? { facilityIds: scopeIds } : undefined);
  const districts = [...new Set(facilities.map((f) => f.district_name).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), "th"));
  const district = districts.includes(read(params, "district")) ? read(params, "district") : "";
  const facilityParam = Number(read(params, "facility"));
  const selected = facilities.filter((f) => (facilityParam ? f.id === facilityParam : !district || f.district_name === district));
  const facilityId = facilityParam && selected.length ? facilityParam : 0;
  const facilityIds = !scopeIds && !facilityId && !district ? null : selected.map((f) => f.id);
  const check = qualityCheck(read(params, "check"));

  const [quality, duplicates, incomplete] = await Promise.all([
    getDataQuality(selected.map((f) => ({ id: f.id, name: f.name, district: f.district_name ?? "" })), facilityIds),
    listSerialDuplicates(facilityIds),
    check ? listIncompleteAssets(check.key, facilityIds, LIST_CAP) : Promise.resolve(null),
  ]);
  const hrefFor = (patch: Record<string, string>) => {
    const query = new URLSearchParams();
    const values = { district, facility: facilityId ? String(facilityId) : "", check: check?.key ?? "", ...patch };
    for (const [key, value] of Object.entries(values)) if (value) query.set(key, value);
    return `/data-quality${query.size ? `?${query}` : ""}#${patch.check ? "incomplete" : "top"}`;
  };
  const scopeLabel = facilityId ? selected[0]?.name : district ? `อำเภอ${district}` : "ทุกหน่วยงานในขอบเขตของคุณ";
  const available = QUALITY_CHECKS.filter((c) => quality.availableKeys.includes(c.key));

  // ตารางรายการที่ขาดข้อมูล: ?sort=&dir=&page=
  const sort = readSort(params, ["number", "name", "facility", "workGroup", "price"]);
  const incompleteSorted = sortRows(incomplete?.rows ?? [], sort, {
    number: (row) => row.assetNumber,
    name: (row) => row.assetName,
    facility: (row) => row.facilityName,
    workGroup: (row) => row.workGroupName,
    price: (row) => row.purchasePrice,
  });
  const paged = paginate(incompleteSorted, readPage(params));
  const th = (key: string, label: string, align: "left" | "right" = "left") => (
    <SortableTh key={key} label={label} sortKey={key} sort={sort} align={align} className="px-4 py-2.5 font-semibold" href={sortHref("/data-quality", params, key, sort)} />
  );

  // ตารางคะแนนรายหน่วยงาน (เรียงอย่างเดียว ไม่แบ่งหน้า): ?fsort=&fdir=
  const fsort = readSort(params, ["facility", "assets", "score", ...available.map((c) => `check-${c.key}`)], null, "f");
  const facilityRows = sortRows(quality.facilities, fsort, {
    facility: (row) => row.facilityName,
    assets: (row) => row.assets,
    score: (row) => row.score,
    ...Object.fromEntries(available.map((c) => [`check-${c.key}`, (row: (typeof quality.facilities)[number]) => row.checks[c.key]?.missing ?? 0])),
  });
  const fth = (key: string, label: string, align: "left" | "right" = "right", className = "px-3 py-2.5 font-semibold") => (
    <SortableTh key={key} label={label} sortKey={key} sort={fsort} align={align} className={className} href={sortHref("/data-quality", params, key, fsort, "f", key === "facility" ? "asc" : "desc")} />
  );

  return (
    <div id="top" className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-5">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold"><AppIcon name="check" className="h-6 w-6 text-[var(--primary)]" /> ความครบถ้วนของข้อมูลครุภัณฑ์</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">{scopeLabel} · นับเฉพาะครุภัณฑ์ที่ยังอยู่ในทะเบียน เลือกหัวข้อเพื่อดูรายการที่ต้องเติม</p>
      </header>

      {quality.missingMigrations && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">ฐานข้อมูลยังไม่มีบางคอลัมน์ ระบบจึงข้ามหัวข้อที่เกี่ยวข้อง (รัน database/add_asset_codes_and_inspection_committee.sql และ database/add_registry_completeness.sql เพื่อตรวจครบทุกหัวข้อ)</p>
      )}

      <form method="GET" className="grid gap-3 rounded-2xl border border-[var(--line)] bg-white p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
        {check && <input type="hidden" name="check" value={check.key} />}
        {sort && <input type="hidden" name="sort" value={sort.key} />}
        {sort && <input type="hidden" name="dir" value={sort.dir} />}
        {fsort && <input type="hidden" name="fsort" value={fsort.key} />}
        {fsort && <input type="hidden" name="fdir" value={fsort.dir} />}
        <label className="text-xs">
          <span className="mb-1 block text-xs text-[var(--muted)]">อำเภอ</span>
          <select name="district" defaultValue={district} className="filter-control w-full">
            <option value="">ทุกอำเภอ</option>
            {districts.map((name) => <option key={name} value={name ?? ""}>{name}</option>)}
          </select>
        </label>
        <label className="text-xs">
          <span className="mb-1 block text-xs text-[var(--muted)]">หน่วยงาน</span>
          <select name="facility" defaultValue={facilityId ? String(facilityId) : ""} className="filter-control w-full">
            <option value="">ทุกหน่วยงาน</option>
            {facilities.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </label>
        <button type="submit" className="min-h-9 self-end rounded-xl bg-[var(--primary)] px-4 text-xs font-semibold text-white">แสดง</button>
      </form>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <section aria-labelledby="score-heading" className="rounded-2xl border border-[var(--line)] bg-white p-5">
          <h2 id="score-heading" className="text-sm font-medium text-[var(--muted)]">คะแนนความครบถ้วนรวม</h2>
          <p className="mt-2 text-5xl font-bold tabular-nums">{percent(quality.total.score)}</p>
          <p className="mt-2 text-sm"><StatusBadge tone={GRADE_TONES[quality.total.grade]}>{QUALITY_GRADE_LABELS[quality.total.grade]}</StatusBadge></p>
          <p className="mt-3 text-xs leading-5 text-[var(--muted)]">
            ครุภัณฑ์ {numberFormat.format(quality.total.assets)} รายการ · ช่องข้อมูลที่ต้องมี {numberFormat.format(quality.total.applicable)} ช่อง · ยังว่าง {numberFormat.format(quality.total.missing)} ช่อง
            <br />เกณฑ์: 90% ขึ้นไป ครบถ้วนดี · 70–89% ควรเติมข้อมูล · ต่ำกว่า 70% ข้อมูลไม่ครบ
          </p>
        </section>

        <section aria-labelledby="checks-heading" className="rounded-2xl border border-[var(--line)] bg-white p-5">
          <h2 id="checks-heading" className="mb-3 text-base font-semibold">ความครบถ้วนรายหัวข้อ</h2>
          <ul className="space-y-2.5">
            {quality.checkTotals.map((item) => (
              <li key={item.key}>
                <Link href={hrefFor({ check: item.key })} className={`block rounded-lg px-2 py-1.5 transition hover:bg-[var(--primary-soft)] ${check?.key === item.key ? "bg-[var(--primary-soft)]" : ""}`}>
                  <span className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="font-medium">{item.label}</span>
                    <span className="whitespace-nowrap tabular-nums text-xs text-[var(--muted)]">ขาด {numberFormat.format(item.missing)} · <b className="text-[var(--foreground)]">{percent(item.rate)}</b></span>
                  </span>
                  <span className="mt-1 block h-2 overflow-hidden rounded-full bg-[#eef3f8]" aria-hidden>
                    <span className="block h-full rounded-full" style={{ width: `${item.rate * 100}%`, background: barColor(item.rate) }} />
                  </span>
                  <span className="mt-0.5 block text-xs text-[var(--muted)]">{item.hint}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {check && incomplete && (
        <section id="incomplete" aria-labelledby="incomplete-heading" className="overflow-hidden rounded-2xl border border-[var(--line)] bg-white">
          <div className="flex flex-wrap items-end justify-between gap-2 border-b border-[var(--line)] px-5 py-4">
            <div>
              <h2 id="incomplete-heading" className="text-base font-semibold">รายการที่ยังไม่มี “{check.label}” ({numberFormat.format(incomplete.total)} รายการ)</h2>
              <p className="mt-0.5 text-xs text-[var(--muted)]">เปิดรายการเพื่อแก้ไข หรือเติมหลายรายการพร้อมกันด้วยการนำเข้า CSV{incomplete.total > incomplete.rows.length ? ` · แสดง ${numberFormat.format(incomplete.rows.length)} รายการแรก` : ""}</p>
            </div>
            <Link href={hrefFor({ check: "" })} className="text-xs text-[var(--primary-text)] underline">ปิดรายการ</Link>
          </div>
          {incomplete.rows.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-[var(--muted)]">ไม่มีรายการที่ขาดข้อมูลนี้</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="bg-[var(--neutral-bg)] text-left text-xs text-[var(--muted)]">
                  <tr>
                    <th className="px-4 py-2.5 font-semibold">ลำดับ</th>
                    {th("number", "เลขครุภัณฑ์")}
                    {th("name", "รายการ")}
                    {th("facility", "หน่วยงาน")}
                    {th("workGroup", "กลุ่มงาน")}
                    {th("price", "มูลค่า (บาท)", "right")}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--line)]">
                  {paged.rows.map((row, rowIndex) => (
                    <tr key={row.id}>
                      <td className="px-4 py-2.5 tabular-nums text-[var(--muted)]">{(paged.start + rowIndex).toLocaleString("th-TH")}</td>
                      <td className="px-4 py-2.5 font-mono text-xs">{row.assetNumber}</td>
                      <td className="px-4 py-2.5"><Link href={`/assets/${row.id}`} className="font-medium text-[var(--primary-text)] hover:underline">{row.assetName}</Link></td>
                      <td className="px-4 py-2.5">{row.facilityName}</td>
                      <td className="px-4 py-2.5 text-[var(--muted)]">{row.workGroupName || "-"}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{row.purchasePrice === null ? "-" : row.purchasePrice.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <TablePagination {...paged} hrefFor={(page) => pageHref("/data-quality", params, page)} label="แบ่งหน้ารายการที่ขาดข้อมูล" className="border-t border-black/6" />
        </section>
      )}

      <section aria-labelledby="facility-heading" className="overflow-hidden rounded-2xl border border-[var(--line)] bg-white">
        <div className="border-b border-[var(--line)] px-5 py-4">
          <h2 id="facility-heading" className="text-base font-semibold">คะแนนรายหน่วยงาน</h2>
          <p className="mt-0.5 text-xs text-[var(--muted)]">{fsort ? "กดหัวตารางเพื่อเปลี่ยนการเรียง" : "เรียงจากคะแนนต่ำสุด"} · ตัวเลขในตารางคือจำนวนรายการที่ยังขาดข้อมูล</p>
        </div>
        {quality.facilities.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-[var(--muted)]">ไม่มีครุภัณฑ์ในขอบเขตที่เลือก</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="bg-[var(--neutral-bg)] text-xs text-[var(--muted)]">
                <tr>
                  <th className="px-4 py-2.5 w-14 text-right font-medium">ลำดับ</th>
                  {fth("facility", "หน่วยงาน", "left", "px-4 py-2.5 font-semibold")}
                  {fth("assets", "รายการ")}
                  {fth("score", "คะแนน")}
                  {available.map((c) => fth(`check-${c.key}`, c.label.replace(/ \(.*\)$/, "")))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {facilityRows.map((row, rowIndex) => (
                  <tr key={row.facilityId}>
                    <td className="px-3 py-2.5 text-right tabular-nums text-[var(--muted)]">{(rowIndex + 1).toLocaleString("th-TH")}</td>
                    <th scope="row" className="px-4 py-2.5 text-left font-medium">
                      <Link href={hrefFor({ facility: String(row.facilityId), district: "" })} className="hover:underline">{row.facilityName}</Link>
                      {row.districtName && <span className="block text-xs font-normal text-[var(--muted)]">อ.{row.districtName}</span>}
                    </th>
                    <td className="px-3 py-2.5 text-right tabular-nums">{numberFormat.format(row.assets)}</td>
                    <td className="px-3 py-2.5 text-right"><StatusBadge tone={GRADE_TONES[row.grade]}>{percent(row.score)}</StatusBadge></td>
                    {available.map((c) => {
                      const missing = row.checks[c.key]?.missing ?? 0;
                      return <td key={c.key} className={`px-3 py-2.5 text-right tabular-nums ${missing ? "text-[var(--state-danger-fg)]" : "text-[var(--muted)]"}`}>{numberFormat.format(missing)}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="serial-heading" className="overflow-hidden rounded-2xl border border-[var(--line)] bg-white">
        <div className="border-b border-[var(--line)] px-5 py-4">
          <h2 id="serial-heading" className="text-base font-semibold">Serial Number ซ้ำ ({numberFormat.format(duplicates.length)} หมายเลข)</h2>
          <p className="mt-0.5 text-xs text-[var(--muted)]">มักเกิดจากโอนย้ายแล้วลงทะเบียนใหม่ หรือนำเข้าซ้ำ ตรวจสอบแล้วโอนย้าย/แก้ไขรายการที่ถูกต้อง และลบรายการที่ซ้ำ</p>
        </div>
        {duplicates.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-[var(--muted)]">ไม่พบ Serial Number ซ้ำ</p>
        ) : (
          <ul className="divide-y divide-[var(--line)]">
            {duplicates.map((group) => (
              <li key={group.serial} className="px-5 py-3">
                <p className="text-sm"><span className="font-mono font-semibold">{group.serial}</span> <span className="text-xs text-[var(--muted)]">· {group.assets.length} รายการ{group.facilityCount > 1 ? ` ใน ${group.facilityCount} หน่วยงาน` : " ในหน่วยงานเดียวกัน"}</span></p>
                <ul className="mt-1 space-y-0.5 text-sm">
                  {group.assets.map((asset) => (
                    <li key={asset.id}>
                      <Link href={`/assets/${asset.id}`} className="text-[var(--primary-text)] hover:underline">{asset.assetNumber} {asset.assetName}</Link>
                      <span className="text-xs text-[var(--muted)]"> · {asset.facilityName} · {assetStatusLabel(asset.status)}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
