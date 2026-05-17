"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";

import type { FacilityRow } from "@/lib/assets";
import { createInspectionAction } from "../actions";

type Asset = {
  id: number;
  assetName: string;
  assetRegistrationNo: string;
  deviceType: string;
  assetGroup: string;
  currentStatus: string;
};

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
          <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
            รายการทรัพย์สินในหน่วยบริการ ({assets.length} รายการ)
          </p>
          {assets.length === 0 ? (
            <div className="text-sm" style={{ color: "var(--muted)" }}>ไม่พบทรัพย์สินในหน่วยบริการนี้</div>
          ) : (
            <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--line)" }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: "rgba(99,102,241,0.04)", borderBottom: "1px solid var(--line)" }}>
                    <th className="px-3 py-2 text-left font-semibold" style={{ color: "var(--muted)" }}>ทะเบียน</th>
                    <th className="px-3 py-2 text-left font-semibold" style={{ color: "var(--muted)" }}>ชื่อทรัพย์สิน</th>
                    <th className="px-3 py-2 text-left font-semibold" style={{ color: "var(--muted)" }}>ประเภท</th>
                    <th className="px-3 py-2 text-center font-semibold" style={{ color: "var(--muted)" }}>พบ</th>
                    <th className="px-3 py-2 text-left font-semibold" style={{ color: "var(--muted)" }}>หมายเหตุ</th>
                  </tr>
                </thead>
                <tbody>
                  {assets.map((a) => (
                    <tr key={a.id} style={{ borderBottom: "1px solid var(--line)" }}>
                      <input type="hidden" name="assetId" value={a.id} />
                      <td className="px-3 py-2 font-mono text-xs" style={{ color: "var(--muted)" }}>
                        {a.assetRegistrationNo}
                      </td>
                      <td className="px-3 py-2" style={{ color: "var(--foreground)" }}>
                        {a.assetName}
                      </td>
                      <td className="px-3 py-2 text-xs" style={{ color: "var(--muted)" }}>
                        {a.deviceType}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <select
                          name={"found_" + a.id}
                          className="rounded px-2 py-1 text-xs border"
                          style={{ borderColor: "var(--line)" }}
                          defaultValue="1"
                        >
                          <option value="1">✓ พบ</option>
                          <option value="0">✗ ไม่พบ</option>
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <input
                          name={"conditionNote_" + a.id}
                          placeholder="สภาพ/หมายเหตุ"
                          className="w-full rounded border px-2 py-1 text-xs"
                          style={{ borderColor: "var(--line)" }}
                        />
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
