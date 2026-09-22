"use client";

import { useState } from "react";
import { ASSET_CREATE_CLASS_OPTIONS, ASSET_CLASS_OPTIONS, assetClassLabel } from "@/lib/asset-classes";
import type { AssetSubtype } from "@/lib/asset-details";

type Values = Record<string, string | number | undefined>;
type Props = {
  values: Values;
  resetHref: string;
  subtypes: AssetSubtype[];
  deviceTypes: { name: string; category?: string }[];
  facilities?: { id: number; facility_name: string; district_name?: string | null }[];
  districts?: string[];
  workGroups?: { id: number; workGroupName: string; facilityId: number; facilityName?: string }[];
  paginate?: boolean;
};
const control = "mt-1 min-h-11 w-full min-w-0 rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]";
const label = "min-w-0 text-sm font-medium";

export function AssetFilters({ values, resetHref, subtypes, deviceTypes, facilities, districts, workGroups = [], paginate = false }: Props) {
  const text = (key: string) => String(values[key] ?? "");
  const [assetClass, setAssetClass] = useState(text("assetClass"));
  const [subtype, setSubtype] = useState(text("subtype"));
  const [deviceType, setDeviceType] = useState(text("deviceType"));
  const [group, setGroup] = useState(text("group"));
  const [district, setDistrict] = useState(text("district"));
  const [facility, setFacility] = useState(text("facility"));
  const [workGroup, setWorkGroup] = useState(text("workGroup"));
  const advancedKeys = ["district", "facility", "workGroup", "maDays", "group", "sort"];
  const advancedCount = advancedKeys.filter(key => values[key]).length;
  const activeCount = ["search", "status", "assetClass", "subtype", "deviceType", ...advancedKeys].filter(key => values[key]).length;
  const itFields = !assetClass || assetClass === "IT";
  const availableSubtypes = subtypes.filter(item => item.assetClass === assetClass && (item.isActive || String(item.id) === subtype));
  const availableFacilities = facilities?.filter(item => !district || item.district_name === district);
  const availableWorkGroups = workGroups.filter(item => !facility || String(item.facilityId) === facility);

  return <form method="GET" action={resetHref} className="min-w-0 space-y-4 rounded-xl border border-[var(--line)] bg-white p-4 sm:p-5" aria-label="ค้นหาและกรองครุภัณฑ์">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-base font-semibold">ค้นหาและกรองครุภัณฑ์</h2>
      {activeCount > 0 && <a href={resetHref} className="inline-flex min-h-11 items-center text-sm text-[var(--primary-text)] underline underline-offset-4">ล้างตัวกรอง ({activeCount})</a>}
    </div>
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)_minmax(0,1fr)]">
      <label className={label}>คำค้นหา<input className={control} type="search" name="search" defaultValue={text("search")} placeholder="ชื่อครุภัณฑ์ เลขทะเบียน หรือ Serial Number" /></label>
      <label className={label}>ประเภททรัพย์สิน<select aria-label="ประเภททรัพย์สิน" className={control} name="assetClass" value={assetClass} onChange={event => { setAssetClass(event.target.value); setSubtype(""); setDeviceType(""); setGroup(""); }}>
        <option value="">ทุกประเภท</option>
        <optgroup label="20 ประเภทตามเอกสาร">{ASSET_CREATE_CLASS_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.categoryId}. {option.label}</option>)}</optgroup>
        <optgroup label="กลุ่มเดิมที่ยังไม่ได้จำแนก">{ASSET_CLASS_OPTIONS.filter(option => !option.categoryId).map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</optgroup>
      </select></label>
      <label className={label}>สถานะ<select aria-label="สถานะ" className={control} name="status" defaultValue={text("status")}><option value="">ทุกสถานะ</option><option value="Active">พร้อมใช้งาน</option><option value="Broken">ชำรุด</option><option value="Inactive">ไม่ใช้งาน</option><option value="Disposed">จำหน่ายแล้ว</option><option value="Lost">สูญหาย</option></select></label>
    </div>
    <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
      {itFields ? <label className={label}>ประเภทอุปกรณ์ IT<select aria-label="ประเภทอุปกรณ์ IT" className={control} name="deviceType" value={deviceType} onChange={event => setDeviceType(event.target.value)}>
        <option value="">ทุกประเภทอุปกรณ์ IT</option>{deviceTypes.filter(item => (!group || !item.category || item.category === group) && (assetClass !== "IT" || !item.category || item.category === "Hardware")).map(item => <option key={item.name} value={item.name}>{item.name}</option>)}
      </select></label> : <label className={label}>ประเภทย่อย<select aria-label="ประเภทย่อย" className={control} name="subtype" value={subtype} onChange={event => setSubtype(event.target.value)}><option value="">ทุกประเภทย่อย</option>{availableSubtypes.map(item => <option key={item.id} value={item.id}>{item.name}{item.isActive ? "" : " (ปิดใช้งาน)"}</option>)}</select></label>}
      <button type="submit" className="min-h-11 rounded-lg bg-[var(--accent-strong)] px-6 py-2 text-sm font-semibold text-white hover:bg-[var(--primary-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]">ค้นหา</button>
    </div>
    <details open={advancedCount > 0 || (paginate && Boolean(values.perPage))} className="border-t border-[var(--line)] pt-3">
      <summary className="w-fit cursor-pointer py-2 text-sm font-medium text-[var(--primary-text)] focus-visible:outline-2 focus-visible:outline-[var(--accent)]">ตัวกรองเพิ่มเติม{advancedCount > 0 ? ` · ใช้อยู่ ${advancedCount} เงื่อนไข` : ""}</summary>
      <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {districts && <label className={label}>อำเภอ<select aria-label="อำเภอ" className={control} name="district" value={district} onChange={event => {setDistrict(event.target.value); setFacility(""); setWorkGroup("");}}><option value="">ทุกอำเภอ</option>{districts.map(item => <option key={item}>{item}</option>)}</select></label>}
        {facilities && <label className={label}>หน่วยงาน<select aria-label="หน่วยงาน" className={control} name="facility" value={facility} onChange={event => {setFacility(event.target.value); setWorkGroup("");}}><option value="">ทุกหน่วยงาน</option>{availableFacilities?.map(item => <option key={item.id} value={item.id}>{item.facility_name}</option>)}</select></label>}
        {workGroups.length > 0 && <label className={label}>กลุ่มงาน<select aria-label="กลุ่มงาน" className={control} name="workGroup" value={workGroup} onChange={event => setWorkGroup(event.target.value)}><option value="">ทุกกลุ่มงาน</option>{availableWorkGroups.map(item => <option key={item.id} value={item.id}>{item.workGroupName}{!facility && facilities && item.facilityName ? ` · ${item.facilityName}` : ""}</option>)}</select></label>}
        {!assetClass && <label className={label}>ลักษณะ IT<select aria-label="ลักษณะ IT" className={control} name="group" value={group} onChange={event => {setGroup(event.target.value); setDeviceType("");}}><option value="">ทั้งฮาร์ดแวร์และซอฟต์แวร์เดิม</option><option value="Hardware">ฮาร์ดแวร์</option><option value="Software">ซอฟต์แวร์ (ข้อมูล IT เดิม)</option></select></label>}
        <label className={label}>สัญญาบำรุงรักษา (MA)<select aria-label="สัญญาบำรุงรักษา (MA)" className={control} name="maDays" defaultValue={text("maDays")}><option value="">ทุกช่วงเวลา</option>{[30,60,90].map(days => <option key={days} value={days}>ใกล้หมดภายใน {days} วัน</option>)}</select></label>
        <label className={label}>เรียงลำดับ<select aria-label="เรียงลำดับ" className={control} name="sort" defaultValue={text("sort")}><option value="">ค่าเริ่มต้น</option><option value="updated_desc">อัปเดตล่าสุดก่อน</option><option value="updated_asc">อัปเดตเก่าสุดก่อน</option><option value="name_asc">ชื่อ ก–ฮ / A–Z</option><option value="name_desc">ชื่อย้อนลำดับ</option><option value="ma_soon">MA ใกล้หมดก่อน</option></select></label>
        {paginate && <label className={label}>จำนวนต่อหน้า<select aria-label="จำนวนต่อหน้า" className={control} name="perPage" defaultValue={text("perPage") || "25"}>{[10,25,50,100].map(count => <option key={count} value={count}>{count} รายการ</option>)}</select></label>}
      </div>
    </details>
    {activeCount > 0 && <p className="text-sm leading-6 text-[var(--muted)]">กำลังแสดง: {text("assetClass") ? assetClassLabel(text("assetClass"), "full") : "ทุกประเภท"}{text("search") ? ` · คำค้น “${text("search")}”` : ""} · {activeCount} เงื่อนไข</p>}
  </form>;
}
