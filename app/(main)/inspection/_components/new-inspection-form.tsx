"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";

import { StatusBadge } from "@/app/_components/ui/status-badge";
import { assetClassLabel } from "@/lib/asset-classes";
import { assetStatusLabel, assetStatusTone } from "@/lib/asset-status";
import type { FacilityRow } from "@/lib/assets";
import { createInspectionAction } from "../actions";

type Asset = {
  id: number;
  assetName: string;
  assetRegistrationNo: string;
  deviceType: string;
  assetClass?: string;
  assetGroup: string;
  currentStatus: string;
};

const today = new Date().toISOString().slice(0, 10);

export default function NewInspectionForm({ facilities }: { facilities: FacilityRow[] }) {
  const [error, formAction, pending] = useActionState(createInspectionAction, null);
  const [selectedFacilityId, setSelectedFacilityId] = useState<number | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);

  useEffect(() => {
    if (!selectedFacilityId) return;
    fetch(`/api/assets?facilityId=${selectedFacilityId}`)
      .then((r) => r.json())
      .then((data) => setAssets(data))
      .catch(() => setAssets([]));
  }, [selectedFacilityId]);

  // Group facilities by district
  const byDistrict = facilities.reduce<Record<string, FacilityRow[]>>((acc, f) => {
    const d = f.district_name ?? "อื่นๆ";
    (acc[d] ??= []).push(f);
    return acc;
  }, {});

  return (
    <form action={formAction} className="space-y-5">
      {error && (
        <div className="rounded-lg px-4 py-3 text-sm font-semibold text-red-700 bg-red-50 border border-red-200">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {/* Facility */}
        <div className="space-y-1">
          <label className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
            หน่วยบริการ <span className="text-red-500">*</span>
          </label>
          <select
            name="facilityId"
            required
            className="w-full rounded-lg border px-3 py-2 text-sm"
            style={{ borderColor: "var(--line)", color: "var(--foreground)" }}
            value={selectedFacilityId ?? ""}
            onChange={(e) => {
              const nextId = e.target.value ? Number(e.target.value) : null;
              setSelectedFacilityId(nextId);
              if (!nextId) {
                setAssets([]);
              }
            }}
          >
            <option value="">-- เลือกหน่วยบริการ --</option>
            {Object.entries(byDistrict).map(([district, facs]) => (
              <optgroup key={district} label={`อ.${district}`}>
                {facs.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        {/* Round name */}
        <div className="space-y-1">
          <label className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
            ชื่อรอบการตรวจนับ <span className="text-red-500">*</span>
          </label>
          <input
            name="roundName"
            required
            placeholder="เช่น ตรวจนับ Q1/2569"
            className="w-full rounded-lg border px-3 py-2 text-sm"
            style={{ borderColor: "var(--line)", color: "var(--foreground)" }}
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
            วันที่เริ่มตรวจ <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            name="startDate"
            required
            defaultValue={today}
            className="w-full rounded-lg border px-3 py-2 text-sm"
            style={{ borderColor: "var(--line)", color: "var(--foreground)" }}
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
            วันที่สิ้นสุด <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            name="endDate"
            required
            defaultValue={today}
            className="w-full rounded-lg border px-3 py-2 text-sm"
            style={{ borderColor: "var(--line)", color: "var(--foreground)" }}
          />
        </div>
      </div>

      {/* Note */}
      <div className="space-y-1">
        <label className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
          หมายเหตุ
        </label>
        <textarea
          name="note"
          rows={2}
          placeholder="บันทึกเพิ่มเติม (ไม่บังคับ)"
          className="w-full rounded-lg border px-3 py-2 text-sm"
          style={{ borderColor: "var(--line)", color: "var(--foreground)" }}
        />
      </div>

      {/* Assets checklist */}
      {selectedFacilityId && (
        <div className="space-y-2">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                รายการครุภัณฑ์ที่จะเปิดให้ตรวจ ({assets.length} รายการ)
              </p>
              <p className="text-xs" style={{ color: "var(--muted)" }}>
                เมื่อบันทึกรอบ ระบบจะสร้างรายการทั้งหมดเป็นสถานะรอตรวจ แล้วไปอัปเดตผลตรวจในหน้ารายละเอียดรอบ
              </p>
            </div>
          </div>
          {assets.length === 0 ? (
            <div className="rounded-xl border border-dashed border-black/15 bg-[var(--neutral-bg)] px-4 py-8 text-center text-sm" style={{ color: "var(--muted)" }}>
              ไม่พบครุภัณฑ์ในหน่วยบริการนี้
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border" style={{ borderColor: "var(--line)" }}>
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr style={{ background: "rgba(99,102,241,0.04)", borderBottom: "1px solid var(--line)" }}>
                    <th className="px-3 py-2 text-left font-semibold" style={{ color: "var(--muted)" }}>ทะเบียน</th>
                    <th className="px-3 py-2 text-left font-semibold" style={{ color: "var(--muted)" }}>ชื่อทรัพย์สิน</th>
                    <th className="px-3 py-2 text-left font-semibold" style={{ color: "var(--muted)" }}>กลุ่ม / ประเภท</th>
                    <th className="px-3 py-2 text-left font-semibold" style={{ color: "var(--muted)" }}>สถานะปัจจุบัน</th>
                  </tr>
                </thead>
                <tbody>
                  {assets.map((a) => (
                    <tr key={a.id} style={{ borderBottom: "1px solid var(--line)" }}>
                      <td className="px-3 py-2 font-mono text-xs" style={{ color: "var(--muted)" }}>
                        {a.assetRegistrationNo}
                      </td>
                      <td className="px-3 py-2" style={{ color: "var(--foreground)" }}>
                        {a.assetName}
                      </td>
                      <td className="px-3 py-2 text-xs" style={{ color: "var(--muted)" }}>
                        <StatusBadge tone="primary">{assetClassLabel(a.assetClass)}</StatusBadge>
                        <p className="mt-1">{a.deviceType || a.assetGroup}</p>
                      </td>
                      <td className="px-3 py-2">
                        <StatusBadge tone={assetStatusTone(a.currentStatus)}>
                          {assetStatusLabel(a.currentStatus)}
                        </StatusBadge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={pending || !selectedFacilityId}
          className="px-5 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
          style={{ background: "var(--accent)" }}
        >
          {pending ? "กำลังบันทึก..." : "บันทึกรอบตรวจนับ"}
        </button>
        <Link
          href="/inspection"
          className="px-5 py-2 rounded-lg text-sm font-semibold border"
          style={{ borderColor: "var(--line)", color: "var(--muted)" }}
        >
          ยกเลิก
        </Link>
      </div>
    </form>
  );
}
