"use client";

import Link from "next/link";
import { useId, useRef, useState } from "react";

import { AppIcon } from "@/app/_components/ui/icon";
import type { FacilityRow } from "@/lib/assets";
import type { FacilityWorkGroupOption } from "@/lib/facility-work-groups";

type ImportResult = {
  created: number;
  updated: number;
  skipped: number;
  errors: Array<{ row: number; message: string }>;
};

export default function ImportExcelModal({
  facilities,
  workGroups,
}: {
  facilities: FacilityRow[];
  workGroups: FacilityWorkGroupOption[];
}) {
  const [open, setOpen] = useState(false);
  const [facilityId, setFacilityId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const titleId = useId();

  const byDistrict = facilities.reduce<Record<string, FacilityRow[]>>((acc, facility) => {
    const district = facility.district_name ?? "อื่นๆ";
    (acc[district] ??= []).push(facility);
    return acc;
  }, {});
  const selectedFacility = facilities.find((facility) => String(facility.id) === facilityId);
  const selectedWorkGroups = facilityId
    ? workGroups.filter((workGroup) => String(workGroup.facilityId) === facilityId)
    : [];

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!file || !facilityId) {
      setError("กรุณาเลือกไฟล์และหน่วยบริการ");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("facilityId", facilityId);

    try {
      const response = await fetch("/api/import/assets", { method: "POST", body: formData });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "เกิดข้อผิดพลาดในการนำเข้า");
        return;
      }
      setResult(data);
    } catch {
      setError("เกิดข้อผิดพลาดในการอัปโหลดไฟล์");
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    setOpen(false);
    setFile(null);
    setResult(null);
    setError(null);
    setFacilityId("");
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold"
        style={{ borderColor: "var(--accent)", color: "var(--accent)" }}
      >
        <AppIcon name="download" className="h-4 w-4" /> นำเข้า CSV
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(17,49,39,0.42)" }}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="glass-panel max-h-[calc(100vh-2rem)] w-full max-w-2xl space-y-4 overflow-y-auto rounded-2xl p-6"
            style={{ background: "white" }}
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 id={titleId} className="text-lg font-bold" style={{ color: "var(--foreground)" }}>นำเข้าครุภัณฑ์จาก CSV</h2>
                <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>รองรับ CSV เป็นหลัก และรองรับ Excel (.xlsx, .xls) เพื่อใช้งานกับไฟล์เดิม</p>
              </div>
              <button
                type="button"
                onClick={handleClose}
                aria-label="ปิดหน้าต่างนำเข้า CSV"
                className="min-h-11 min-w-11 rounded-xl text-xl text-gray-500 hover:bg-stone-100 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            {!result ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

                <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-950">
                  <p className="font-bold">การใช้คอลัมน์ <code className="rounded bg-white px-1 py-0.5">id</code></p>
                  <p className="mt-1 leading-6"><strong>เว้นว่าง</strong> สำหรับเพิ่มครุภัณฑ์ใหม่ ระบบจะสร้าง id ให้เองหลังบันทึกข้อมูล ส่วนการ <strong>แก้ไขรายการเดิม</strong> ต้องใส่ id ที่ได้จากการ Export CSV ของระบบ และ id นั้นต้องอยู่ในหน่วยบริการที่เลือกเท่านั้น</p>
                  <p className="mt-1 text-xs leading-5">ห้ามคาดเดาหรือกรอก id ใหม่เอง เพราะระบบจะไม่พบรายการสำหรับอัปเดตและจะข้ามแถวนั้น</p>
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                    หน่วยบริการ <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={facilityId}
                    onChange={(event) => setFacilityId(event.target.value)}
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                    style={{ borderColor: "var(--line)" }}
                    required
                  >
                    <option value="">-- เลือกหน่วยบริการ --</option>
                    {Object.entries(byDistrict).map(([district, facilityRows]) => (
                      <optgroup key={district} label={`อ.${district}`}>
                        {facilityRows.map((facility) => <option key={facility.id} value={facility.id}>{facility.name}</option>)}
                      </optgroup>
                    ))}
                  </select>
                </div>

                {facilityId && (
                  <section aria-live="polite" className="overflow-hidden rounded-xl border border-amber-200 bg-amber-50">
                    <div className="border-b border-amber-200 px-4 py-3">
                      <p className="text-sm font-bold text-amber-950">Work Group ของ {selectedFacility?.name ?? "หน่วยบริการที่เลือก"}</p>
                      <p className="mt-1 text-xs leading-5 text-amber-900">ใช้ตัวเลขในคอลัมน์ <code className="rounded bg-white px-1 py-0.5">work_group_id</code> ของไฟล์ CSV เฉพาะเมื่อหน่วยบริการนี้มีกลุ่มงาน</p>
                    </div>
                    {selectedWorkGroups.length > 0 ? (
                      <div className="max-h-44 overflow-y-auto bg-white">
                        <table className="w-full text-left text-sm">
                          <thead className="sticky top-0 bg-amber-50 text-xs text-amber-950">
                            <tr>
                              <th className="px-4 py-2 font-semibold">work_group_id</th>
                              <th className="px-4 py-2 font-semibold">ชื่อกลุ่มงาน</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedWorkGroups.map((workGroup) => (
                              <tr key={workGroup.id} className="border-t border-stone-100">
                                <td className="px-4 py-2"><code className="rounded bg-stone-100 px-2 py-1 font-semibold text-stone-800">{workGroup.id}</code></td>
                                <td className="px-4 py-2 text-stone-700">{workGroup.workGroupName}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="px-4 py-3 text-sm text-amber-900">หน่วยบริการนี้ยังไม่มีกลุ่มงานที่เปิดใช้งาน จึงเว้นคอลัมน์ <code className="rounded bg-white px-1 py-0.5">work_group_id</code> ว่างได้</p>
                    )}
                  </section>
                )}

                <div className="space-y-1">
                  <label className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                    ไฟล์ CSV หรือ Excel <span className="text-red-500">*</span>
                  </label>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    required
                    onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                    className="w-full text-sm"
                  />
                  <p className="text-xs leading-5" style={{ color: "var(--muted)" }}>
                    คอลัมน์สำคัญ: id, work_group_id, asset_registration_no, asset_name, asset_class, asset_category, device_type, serial_number และข้อมูลรายละเอียดอื่น ๆ ตามไฟล์ตัวอย่าง
                  </p>
                </div>

                <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs font-semibold">
                  <a href="/api/export/assets?template=csv" className="inline-flex items-center gap-1.5" style={{ color: "var(--accent)" }}>
                    <AppIcon name="download" className="h-3.5 w-3.5" /> ดาวน์โหลดไฟล์ CSV ตัวอย่าง
                  </a>
                  <Link href="/assets/import-guide" className="inline-flex items-center gap-1.5" style={{ color: "var(--accent)" }}>
                    อ่านคู่มือการนำเข้าและการใช้ id
                  </Link>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="rounded-lg px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
                    style={{ background: "var(--accent)" }}
                  >
                    {loading ? "กำลังนำเข้า..." : "นำเข้าข้อมูล"}
                  </button>
                  <button
                    type="button"
                    onClick={handleClose}
                    className="rounded-lg border px-5 py-2 text-sm font-semibold"
                    style={{ borderColor: "var(--line)", color: "var(--muted)" }}
                  >
                    ยกเลิก
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm">
                  <p className="font-bold text-green-700">นำเข้าไฟล์เสร็จสิ้น</p>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                    <p className="rounded-lg bg-white px-2 py-2 text-green-700">เพิ่มใหม่<br /><strong>{result.created}</strong> รายการ</p>
                    <p className="rounded-lg bg-white px-2 py-2 text-green-700">แก้ไข<br /><strong>{result.updated}</strong> รายการ</p>
                    <p className="rounded-lg bg-white px-2 py-2 text-amber-700">ข้าม<br /><strong>{result.skipped}</strong> รายการ</p>
                  </div>
                </div>
                {result.errors.length > 0 && (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm">
                    <p className="font-bold text-red-700">แถวที่มีข้อผิดพลาด</p>
                    <ul className="mt-2 space-y-1 text-xs text-red-600">
                      {result.errors.map((item) => <li key={`${item.row}-${item.message}`}>แถว {item.row}: {item.message}</li>)}
                    </ul>
                  </div>
                )}
                <button
                  onClick={() => { handleClose(); window.location.reload(); }}
                  className="rounded-lg px-5 py-2 text-sm font-semibold text-white"
                  style={{ background: "var(--accent)" }}
                >
                  ปิดและรีโหลด
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
