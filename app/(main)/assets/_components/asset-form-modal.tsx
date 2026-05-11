"use client";

import { useActionState, useRef, useState } from "react";

import { createAssetAction, updateAssetAction } from "@/app/(main)/assets/actions";
import type { AssetWithFacility } from "@/lib/assets";

type SurveyOption = { id: number; facility_id: number; facility_name: string | null; district_name: string | null };

type Props = {
  surveys: SurveyOption[];
  updaterName: string;
  mode: "create" | "edit";
  asset?: AssetWithFacility;
  children: React.ReactNode;
};

const INITIAL: string | null = null;

export function AssetFormModal({ surveys, mode, asset, children }: Props) {
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const action = mode === "create" ? createAssetAction : updateAssetAction;
  const [error, formAction, pending] = useActionState(
    async (prev: string | null, fd: FormData) => {
      const result = await action(prev, fd);
      if (!result) {
        setOpen(false);
        formRef.current?.reset();
      }
      return result;
    },
    INITIAL
  );

  const title = mode === "create" ? "เพิ่มทรัพย์สินใหม่" : `แก้ไข: ${asset?.assetName ?? ""}`;

  return (
    <>
      <span onClick={() => setOpen(true)} className="cursor-pointer">{children}</span>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative z-10 max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-[var(--surface-strong)] p-6 shadow-2xl sm:p-8">
            <div className="flex items-center justify-between">
              <h2 className="section-title text-xl font-semibold">{title}</h2>
              <button onClick={() => setOpen(false)} className="text-[var(--muted)] hover:text-[var(--foreground)]">✕</button>
            </div>

            {error && (
              <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
            )}

            <form ref={formRef} action={formAction} className="mt-5 space-y-4">
              {mode === "edit" && <input type="hidden" name="assetId" value={asset?.id} />}

              {/* Survey / หน่วยงาน */}
              <div>
                <label className="block text-sm font-medium">หน่วยงาน <span className="text-rose-500">*</span></label>
                <select
                  name="surveyId"
                  defaultValue={asset?.surveyId ?? ""}
                  required
                  className="mt-1 w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                >
                  <option value="">-- เลือกหน่วยงาน --</option>
                  {surveys.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.facility_name} ({s.district_name})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {/* เลขทะเบียน */}
                <div>
                  <label className="block text-sm font-medium">เลขทะเบียนทรัพย์สิน <span className="text-rose-500">*</span></label>
                  <input
                    name="assetRegistrationNo"
                    defaultValue={asset?.assetRegistrationNo ?? ""}
                    required
                    placeholder="เช่น SAT-HW-0001"
                    className="mt-1 w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                  />
                </div>
                {/* ชื่อ */}
                <div>
                  <label className="block text-sm font-medium">ชื่อทรัพย์สิน <span className="text-rose-500">*</span></label>
                  <input
                    name="assetName"
                    defaultValue={asset?.assetName ?? ""}
                    required
                    placeholder="เช่น Core Firewall"
                    className="mt-1 w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {/* หมวด */}
                <div>
                  <label className="block text-sm font-medium">หมวดทรัพย์สิน <span className="text-rose-500">*</span></label>
                  <select
                    name="assetCategory"
                    defaultValue={asset?.assetGroup ?? "Hardware"}
                    required
                    className="mt-1 w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                  >
                    <option value="Hardware">Hardware</option>
                    <option value="Software">Software</option>
                  </select>
                </div>
                {/* ประเภทอุปกรณ์ */}
                <div>
                  <label className="block text-sm font-medium">ประเภทอุปกรณ์</label>
                  <input
                    name="deviceType"
                    defaultValue={asset?.deviceType ?? ""}
                    placeholder="เช่น Firewall, Server, Switch"
                    className="mt-1 w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {/* OS */}
                <div>
                  <label className="block text-sm font-medium">Operating System</label>
                  <input
                    name="operatingSystem"
                    defaultValue={asset?.operatingSystem ?? ""}
                    className="mt-1 w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                  />
                </div>
                {/* Private IP */}
                <div>
                  <label className="block text-sm font-medium">Private IP</label>
                  <input
                    name="privateIp"
                    defaultValue={asset?.privateIp ?? ""}
                    placeholder="10.x.x.x"
                    className="mt-1 w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2 font-mono text-sm outline-none focus:border-[var(--accent)]"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {/* Owner */}
                <div>
                  <label className="block text-sm font-medium">ผู้รับผิดชอบ</label>
                  <input
                    name="ownerName"
                    defaultValue={asset?.ownerName ?? ""}
                    className="mt-1 w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                  />
                </div>
                {/* Location */}
                <div>
                  <label className="block text-sm font-medium">ที่ตั้ง / Location</label>
                  <input
                    name="locationDetail"
                    defaultValue={asset?.locationDetail ?? ""}
                    className="mt-1 w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                {/* Serial */}
                <div>
                  <label className="block text-sm font-medium">Serial Number</label>
                  <input
                    name="serialNumber"
                    defaultValue={asset?.serialNumber ?? ""}
                    className="mt-1 w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2 font-mono text-sm outline-none focus:border-[var(--accent)]"
                  />
                </div>
                {/* MA Start */}
                <div>
                  <label className="block text-sm font-medium">วันเริ่มสัญญา</label>
                  <input
                    type="date"
                    name="maintenanceStartDate"
                    defaultValue={""}
                    className="mt-1 w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                  />
                </div>
                {/* MA End */}
                <div>
                  <label className="block text-sm font-medium">วันสิ้นสุดสัญญา</label>
                  <input
                    type="date"
                    name="maintenanceEndDate"
                    defaultValue={asset?.maintenanceEndDate ?? ""}
                    className="mt-1 w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                  />
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="block text-sm font-medium">สถานะ</label>
                <select
                  name="currentStatus"
                  defaultValue={asset?.currentStatus ?? "Active"}
                  className="mt-1 w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                >
                  <option value="Active">พร้อมใช้งาน (Active)</option>
                  <option value="Inactive">ไม่ใช้งาน (Inactive)</option>
                  <option value="Broken">ชำรุด (Broken)</option>
                </select>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium">คำอธิบายการใช้งาน</label>
                <textarea
                  name="usageDescription"
                  defaultValue={asset?.usageDescription ?? ""}
                  rows={2}
                  className="mt-1 w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-xl border border-black/10 bg-white/80 px-5 py-2 text-sm font-medium hover:bg-white"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-xl bg-[var(--accent-strong)] px-6 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                >
                  {pending ? "กำลังบันทึก…" : mode === "create" ? "เพิ่มทรัพย์สิน" : "บันทึกการแก้ไข"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
