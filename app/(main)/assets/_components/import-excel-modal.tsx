"use client";

import { useId, useRef, useState } from "react";

import { AppIcon } from "@/app/_components/ui/icon";
import type { FacilityRow } from "@/lib/assets";

export default function ImportExcelModal({ facilities }: { facilities: FacilityRow[] }) {
  const [open, setOpen] = useState(false);
  const [facilityId, setFacilityId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ inserted: number; skipped: number; errors: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const titleId = useId();

  const byDistrict = facilities.reduce<Record<string, FacilityRow[]>>((acc, f) => {
    const d = f.district_name ?? "อื่นๆ";
    (acc[d] ??= []).push(f);
    return acc;
  }, {});

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !facilityId) { setError("กรุณาเลือกไฟล์และหน่วยบริการ"); return; }
    setLoading(true);
    setError(null);
    setResult(null);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("facilityId", facilityId);
    try {
      const res = await fetch("/api/import/assets", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "เกิดข้อผิดพลาด"); return; }
      setResult(data);
    } catch {
      setError("เกิดข้อผิดพลาดในการอัปโหลด");
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
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border"
        style={{ borderColor: "var(--accent)", color: "var(--accent)" }}
      >
        <AppIcon name="download" className="h-4 w-4" /> นำเข้า Excel
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(17,49,39,0.42)" }}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="glass-panel rounded-2xl p-6 w-full max-w-lg space-y-4"
            style={{ background: "white" }}
          >
            <div className="flex items-center justify-between">
              <h2 id={titleId} className="text-lg font-bold" style={{ color: "var(--foreground)" }}>นำเข้าทรัพย์สินจาก Excel</h2>
              <button
                type="button"
                onClick={handleClose}
                aria-label="ปิดหน้าต่างนำเข้า Excel"
                className="min-h-11 min-w-11 rounded-xl text-gray-500 hover:bg-stone-100 hover:text-gray-700 text-xl"
              >
                ✕
              </button>
            </div>

            {!result ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="rounded-lg px-4 py-3 text-sm text-red-700 bg-red-50 border border-red-200">{error}</div>
                )}

                <div className="space-y-1">
                  <label className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                    หน่วยบริการ <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={facilityId}
                    onChange={(e) => setFacilityId(e.target.value)}
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                    style={{ borderColor: "var(--line)" }}
                    required
                  >
                    <option value="">-- เลือกหน่วยบริการ --</option>
                    {Object.entries(byDistrict).map(([district, facs]) => (
                      <optgroup key={district} label={"อ." + district}>
                        {facs.map((f) => (
                          <option key={f.id} value={f.id}>{f.name}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                    ไฟล์ Excel (.xlsx) <span className="text-red-500">*</span>
                  </label>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".xlsx,.xls"
                    required
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                    className="w-full text-sm"
                  />
                  <p className="text-xs" style={{ color: "var(--muted)" }}>
                    คอลัมน์ที่รองรับ: asset_registration_no, asset_name, asset_category, asset_group, device_type, manufacturer_brand, serial_number, operating_system, private_ip, public_ip, owner_name, location_detail, current_status, maintenance_end_date, usage_description
                  </p>
                </div>

                {/* Template download */}
                <div>
                  <a
                    href="/api/export/assets?template=1"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold"
                    style={{ color: "var(--accent)" }}
                  >
                    <AppIcon name="download" className="h-3.5 w-3.5" /> ดาวน์โหลด Template Excel
                  </a>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-5 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
                    style={{ background: "var(--accent)" }}
                  >
                    {loading ? "กำลังนำเข้า..." : "นำเข้าข้อมูล"}
                  </button>
                  <button
                    type="button"
                    onClick={handleClose}
                    className="px-5 py-2 rounded-lg text-sm font-semibold border"
                    style={{ borderColor: "var(--line)", color: "var(--muted)" }}
                  >
                    ยกเลิก
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="rounded-xl p-4 bg-green-50 border border-green-200 text-sm space-y-1">
                  <p className="font-bold text-green-700">✓ นำเข้าสำเร็จ</p>
                  <p className="text-green-600">บันทึกแล้ว: <strong>{result.inserted}</strong> รายการ</p>
                  <p className="text-green-600">ข้ามไป: <strong>{result.skipped}</strong> รายการ</p>
                </div>
                {result.errors.length > 0 && (
                  <div className="rounded-xl p-4 bg-red-50 border border-red-200 text-sm space-y-1">
                    <p className="font-bold text-red-700">รายการที่มีข้อผิดพลาด:</p>
                    {result.errors.map((e, i) => <p key={i} className="text-red-600 text-xs">{e}</p>)}
                  </div>
                )}
                <div className="flex gap-3">
                  <button
                    onClick={() => { handleClose(); window.location.reload(); }}
                    className="px-5 py-2 rounded-lg text-sm font-semibold text-white"
                    style={{ background: "var(--accent)" }}
                  >
                    ปิดและรีโหลด
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
