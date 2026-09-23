"use client";

import { useId, useState } from "react";
import type { CategoryCounts, DepreciationRow } from "@/lib/asset-depreciation";

type Props = { rows: DepreciationRow[]; unclassified: CategoryCounts; total: number };
const number = new Intl.NumberFormat("th-TH");

export function AssetCategorySummary({ rows, unclassified, total }: Props) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [onlyPopulated, setOnlyPopulated] = useState(false);
  const search = query.trim().toLocaleLowerCase("th");
  const visible = rows.filter(row => (!onlyPopulated || row.total > 0) &&
    `${row.id} ${row.label} ${row.rates.map(rate => rate.label).join(" ")}`.toLocaleLowerCase("th").includes(search));
  const populated = rows.filter(row => row.total > 0).length;
  const share = (count: number) => total > 0 ? number.format(Math.round(count / total * 1000) / 10) : "0";
  const numericCell = "whitespace-nowrap px-3 py-3 text-right tabular-nums";

  function countsCells(counts: CategoryCounts) {
    return <>
      <td className={`${numericCell} font-semibold`}>{number.format(counts.total)}</td>
      <td className={`${numericCell} text-[var(--muted)]`}>{share(counts.total)}%</td>
      <td className={`${numericCell} text-emerald-800`}>{number.format(counts.active)}</td>
      <td className={`${numericCell} text-rose-800`}>{number.format(counts.broken)}</td>
      <td className={`${numericCell} text-[var(--muted)]`}>{number.format(counts.inactive)}</td>
    </>;
  }

  return (
    <section className="min-w-0 rounded-2xl border border-[var(--line)] bg-white" aria-labelledby={`${id}-heading`}>
      <div className="flex flex-col gap-3 border-b border-[var(--line)] p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
        <div className="min-w-0">
          <h2 id={`${id}-heading`} className="text-xl font-semibold">ครุภัณฑ์ตามประเภททรัพย์สิน</h2>
          <p className="mt-1 max-w-[70ch] text-sm leading-6 text-[var(--muted)]">20 ประเภทตามตารางอายุการใช้งานและอัตราค่าเสื่อมราคา สำนักงานปลัดกระทรวงสาธารณสุข</p>
        </div>
        <a href="/references/asset-useful-life.pdf" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg border border-[var(--line)] px-3 text-sm font-medium text-[var(--primary-text)] hover:bg-[var(--primary-soft)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]">เปิดเอกสารอ้างอิง <span className="sr-only">PDF ในแท็บใหม่</span><span aria-hidden="true" className="ml-2">↗</span></a>
      </div>

      <div className="flex flex-col gap-3 px-5 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
        <p className="text-sm text-[var(--muted)]"><strong className="font-semibold text-[var(--foreground)]">{number.format(total)} รายการ</strong> ตามตัวกรองปัจจุบัน · พบข้อมูล {populated} จาก 20 ประเภท</p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="flex min-h-9 items-center gap-2 text-xs">
            <input type="checkbox" checked={onlyPopulated} onChange={event => setOnlyPopulated(event.target.checked)} className="h-4 w-4 accent-[var(--accent-strong)]" />
            เฉพาะประเภทที่มีข้อมูล
          </label>
          <label className="min-w-0 sm:w-60">
            <span className="sr-only">ค้นหาประเภททรัพย์สิน</span>
            <input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="ค้นหาประเภททรัพย์สิน" className="filter-control w-full" />
          </label>
        </div>
      </div>

      {total === 0 && <p className="mx-5 mb-4 rounded-lg bg-[var(--neutral-bg)] p-3 text-sm text-[var(--neutral-text)] sm:mx-6">ยังไม่มีทรัพย์สินตามตัวกรองนี้ ตารางแสดงเกณฑ์อ้างอิงครบทุกประเภท ลองเปลี่ยนตัวกรองเพื่อดูจำนวนรายการ</p>}
      {unclassified.total > 0 && <p className="mx-5 mb-4 rounded-lg bg-amber-50 p-3 text-sm leading-6 text-amber-900 sm:mx-6">รอตรวจสอบประเภท {number.format(unclassified.total)} รายการ: กลุ่มหรือประเภทย่อยที่บันทึกยังเทียบกับเอกสารไม่ได้ โปรดตรวจสอบประเภทในทะเบียนทรัพย์สิน</p>}
      <p id={`${id}-scroll`} className="px-5 pb-2 text-xs text-[var(--muted)] sm:px-6 lg:hidden">เลื่อนตารางแนวนอนเพื่อดูสถานะและเกณฑ์ค่าเสื่อมราคา</p>
      <div className="overflow-x-auto focus-visible:outline-2 focus-visible:outline-[var(--accent)]" role="region" aria-label="ตารางสรุปประเภททรัพย์สิน" aria-describedby={`${id}-scroll`} tabIndex={0}>
        <table className="w-full min-w-[920px] text-sm">
          <caption className="sr-only">จำนวนทรัพย์สินตามประเภทและสถานะ พร้อมอายุการใช้งานและอัตราค่าเสื่อมราคาอ้างอิง</caption>
          <thead className="border-y border-[var(--line)] bg-[var(--neutral-bg)] text-xs text-[var(--neutral-text)]">
            <tr>
              <th scope="col" className="px-5 py-3 text-left sm:px-6">ประเภททรัพย์สิน</th>
              {["จำนวน", "สัดส่วน", "พร้อมใช้งาน", "ชำรุด", "ไม่ใช้งาน", "อายุ (ปี)", "ค่าเสื่อม (%/ปี)"].map(label => <th key={label} scope="col" className="whitespace-nowrap px-3 py-3 text-right font-medium">{label}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--line)]">
            {visible.map(row => {
              const multiple = row.rates.length > 1;
              return <tr key={row.id} className="align-top hover:bg-[var(--neutral-bg)]/60">
                <th scope="row" className="min-w-72 px-5 py-3 text-left font-medium sm:px-6">
                  <div className="flex gap-3"><span className="w-5 shrink-0 tabular-nums text-[var(--muted)]">{row.id}</span><div>
                    {row.label}
                    <p aria-hidden="true" className="mt-1 text-xs font-normal text-[var(--muted)] lg:hidden">{number.format(row.total)} รายการ · {share(row.total)}% ของทั้งหมด</p>
                    {multiple && <details className="mt-1 text-xs font-normal">
                      <summary className="w-fit cursor-pointer py-1 text-[var(--primary-text)] focus-visible:outline-2 focus-visible:outline-[var(--accent)]">ดูเกณฑ์ย่อย {row.rates.length} รายการ</summary>
                      <ul className="mt-2 max-w-md space-y-3 pb-2 text-[var(--neutral-text)]">
                        {row.rates.map(rate => <li key={rate.label}><p className="leading-5">{rate.label}</p><p className="mt-0.5 font-medium">{rate.years === null ? "กำหนดอายุและอัตราค่าเสื่อมเป็นรายกรณี" : `${rate.years} ปี · ${rate.rate}% ต่อปี`}</p></li>)}
                      </ul>
                    </details>}
                  </div></div>
                </th>
                {countsCells(row)}
                {multiple ? <td colSpan={2} className={`${numericCell} text-[var(--muted)]`}>ตามเกณฑ์ย่อย</td> : <><td className={numericCell}>{row.rates[0].years}</td><td className={numericCell}>{row.rates[0].rate}</td></>}
              </tr>;
            })}
            {visible.length === 0 && <tr><td colSpan={8} className="px-6 py-8 text-center text-[var(--muted)]">ไม่พบประเภทที่ตรงกับการค้นหา ลองใช้คำอื่นหรือปิดตัวเลือกเฉพาะประเภทที่มีข้อมูล</td></tr>}
            {unclassified.total > 0 && <tr className="bg-amber-50/60"><th scope="row" className="px-5 py-3 text-left font-medium text-amber-900 sm:px-6">รอตรวจสอบประเภท</th>{countsCells(unclassified)}<td colSpan={2} className={`${numericCell} text-amber-900`}>ยังระบุเกณฑ์ไม่ได้</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="space-y-1 border-t border-[var(--line)] px-5 py-4 text-xs leading-5 text-[var(--muted)] sm:px-6">
        <p role="status" aria-live="polite">แสดง {visible.length} จาก 20 ประเภท · สัดส่วนคิดจากทรัพย์สินทั้งหมดตามตัวกรอง รวมรายการรอตรวจสอบประเภท</p>
        <p>จัดกลุ่มจากประเภทที่บันทึกในทะเบียน อายุและอัตราค่าเสื่อมเป็นเกณฑ์อ้างอิงตามเอกสาร ไม่ใช่อายุคงเหลือหรือค่าเสื่อมที่คำนวณรายรายการ</p>
      </div>
    </section>
  );
}
