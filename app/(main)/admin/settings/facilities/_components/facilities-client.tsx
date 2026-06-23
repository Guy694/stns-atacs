"use client";

import { useActionState, useRef, useState, useTransition } from "react";

import { StatusBadge, activeTone } from "@/app/_components/ui/status-badge";
import { createFacilityAction, toggleFacilityActiveAction, updateFacilityAction } from "../actions";
import type { FacilityAdminRow } from "@/lib/assets";

const TYPECODES = ["รพ.ทั่วไป", "รพ.ชุมชน", "รพ.สต.", "ศสช.", "สสจ.", "สสอ.", "สอน."];
const DISTRICTS = ["เมืองสตูล", "ควนโดน", "ควนกาหลง", "ท่าแพ", "ละงู", "ทุ่งหว้า", "มะนัง"];

function FacilityModal({
  mode,
  facility,
  onClose,
}: {
  mode: "create" | "edit";
  facility?: FacilityAdminRow;
  onClose: () => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const action = mode === "create" ? createFacilityAction : updateFacilityAction;

  const [error, formAction, pending] = useActionState(
    async (prev: string | null, fd: FormData) => {
      const res = await action(prev, fd);
      if (!res) { onClose(); formRef.current?.reset(); }
      return res;
    },
    null
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg overflow-y-auto rounded-2xl bg-[var(--surface-strong)] p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{mode === "create" ? "เพิ่มหน่วยงานใหม่" : `แก้ไข: ${facility?.name}`}</h2>
          <button onClick={onClose} className="text-[var(--muted)] hover:text-[var(--foreground)]">✕</button>
        </div>

        {error && <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}

        <form ref={formRef} action={formAction} className="mt-4 space-y-3">
          {mode === "edit" && <input type="hidden" name="id" value={facility?.id} />}

          <div>
            <label className="block text-sm font-medium">ชื่อหน่วยงาน <span className="text-rose-500">*</span></label>
            <input name="name" defaultValue={facility?.name ?? ""} required
              className="mt-1 w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium">ประเภท <span className="text-rose-500">*</span></label>
              <select name="typecode" defaultValue={facility?.typecode ?? "รพ.สต."} required
                className="mt-1 w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm outline-none focus:border-[var(--accent)]">
                {TYPECODES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium">อำเภอ <span className="text-rose-500">*</span></label>
              <select name="districtName" defaultValue={facility?.district_name ?? ""} required
                className="mt-1 w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm outline-none focus:border-[var(--accent)]">
                <option value="">-- เลือกอำเภอ --</option>
                {DISTRICTS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium">ตำบล</label>
            <input name="tambon" defaultValue={facility?.tambon ?? ""}
              className="mt-1 w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium">ละติจูด (lat)</label>
              <input name="lat" type="number" step="any" defaultValue={facility?.lat ?? ""}
                className="mt-1 w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm font-mono outline-none focus:border-[var(--accent)]" />
            </div>
            <div>
              <label className="block text-sm font-medium">ลองจิจูด (lon)</label>
              <input name="lon" type="number" step="any" defaultValue={facility?.lon ?? ""}
                className="mt-1 w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm font-mono outline-none focus:border-[var(--accent)]" />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="rounded-xl border border-black/10 bg-white/80 px-5 py-2 text-sm font-medium hover:bg-white">
              ยกเลิก
            </button>
            <button type="submit" disabled={pending}
              className="rounded-xl bg-[var(--accent-strong)] px-6 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
              {pending ? "กำลังบันทึก…" : mode === "create" ? "เพิ่มหน่วยงาน" : "บันทึก"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function FacilityRow({ f }: { f: FacilityAdminRow }) {
  const [editOpen, setEditOpen] = useState(false);
  const [togglePending, startToggle] = useTransition();

  return (
    <>
      <tr className="border-b border-black/5 transition hover:bg-white/40">
        <td className="px-4 py-3">
          <p className="font-medium text-sm">{f.name}</p>
          <p className="text-xs text-[var(--muted)]">{f.tambon || "–"}</p>
        </td>
        <td className="px-4 py-3 text-xs">{f.typecode}</td>
        <td className="px-4 py-3 text-xs">{f.district_name}</td>
        <td className="px-4 py-3 text-center text-xs font-medium">{f.asset_count}</td>
        <td className="px-4 py-3">
          <StatusBadge tone={activeTone(!!f.is_active)}>
            {f.is_active ? "ใช้งาน" : "ปิด"}
          </StatusBadge>
        </td>
        <td className="px-4 py-3 text-right">
          <div className="inline-flex gap-2">
            <button onClick={() => setEditOpen(true)}
              className="rounded-lg border border-[var(--primary-soft-strong)] bg-[var(--primary-soft)] px-3 py-1 text-xs font-medium text-[var(--primary-text)] hover:bg-[var(--primary-soft-strong)]">
              แก้ไข
            </button>
            <button
              onClick={() => startToggle(() => toggleFacilityActiveAction(f.id, !f.is_active))}
              disabled={togglePending}
              className={`rounded-lg border px-3 py-1 text-xs font-medium transition disabled:opacity-50 ${f.is_active ? "border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100" : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"}`}>
              {togglePending ? "…" : f.is_active ? "ปิด" : "เปิด"}
            </button>
          </div>
        </td>
      </tr>
      {editOpen && <FacilityModal mode="edit" facility={f} onClose={() => setEditOpen(false)} />}
    </>
  );
}

export function FacilitiesClient({ facilities }: { facilities: FacilityAdminRow[] }) {
  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [districtFilter, setDistrictFilter] = useState("");

  const filtered = facilities.filter((f) => {
    const q = search.toLowerCase();
    const matchSearch = !q || f.name.toLowerCase().includes(q) || (f.tambon ?? "").toLowerCase().includes(q);
    const matchDistrict = !districtFilter || f.district_name === districtFilter;
    return matchSearch && matchDistrict;
  });

  return (
    <>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="ค้นหาชื่อหน่วยงาน..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm outline-none focus:border-[var(--accent)] w-56"
        />
        <select
          value={districtFilter}
          onChange={(e) => setDistrictFilter(e.target.value)}
          className="rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
        >
          <option value="">ทุกอำเภอ</option>
          {DISTRICTS.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <span className="text-sm text-[var(--muted)]">{filtered.length} หน่วยงาน</span>
        <div className="ml-auto">
          <button
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-2 rounded-full bg-[var(--accent-strong)] px-5 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            + เพิ่มหน่วยงาน
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="glass-panel overflow-hidden rounded-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-black/6 bg-stone-50/60 text-xs text-[var(--muted)]">
                <th className="px-4 py-2.5 text-left font-medium">ชื่อหน่วยงาน</th>
                <th className="px-4 py-2.5 text-left font-medium">ประเภท</th>
                <th className="px-4 py-2.5 text-left font-medium">อำเภอ</th>
                <th className="px-4 py-2.5 text-center font-medium">ทรัพย์สิน</th>
                <th className="px-4 py-2.5 text-left font-medium">สถานะ</th>
                <th className="px-4 py-2.5 text-right font-medium">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((f) => <FacilityRow key={f.id} f={f} />)}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="py-10 text-center text-sm text-[var(--muted)]">ไม่พบหน่วยงาน</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {createOpen && <FacilityModal mode="create" onClose={() => setCreateOpen(false)} />}
    </>
  );
}
