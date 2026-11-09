"use client";

import { startTransition, useActionState, useEffect, useState, type FormEvent, useId } from "react";

import { SortableTh, TablePagination } from "@/app/_components/ui/data-table";
import { useTableState } from "@/app/_components/ui/use-table-state";

import { StatusBadge } from "@/app/_components/ui/status-badge";
import { ActionIconLink } from "@/app/_components/ui/action-icon-button";
import { FacilitySelect } from "@/app/_components/ui/facility-select";
import { AppIcon } from "@/app/_components/ui/icon";
import { assetClassLabel } from "@/lib/asset-classes";
import { withBasePath } from "@/lib/base-path";
import { assetStatusLabel, assetStatusTone } from "@/lib/asset-status";
import type { FacilityRow } from "@/lib/assets";
import { createInspectionAction } from "../actions";
import { CommitteeRow } from "./committee-form";
import { todayBangkok } from "@/lib/local-date";

type Asset = {
  id: number;
  assetName: string;
  assetRegistrationNo: string;
  deviceType: string;
  assetClass?: string;
  assetGroup: string;
  currentStatus: string;
  workGroupId?: number | null;
  assetNumber?: string;
};

type WorkGroup = { id: number; facilityId: number; workGroupName: string };



export default function NewInspectionForm({ facilities, workGroups = [] }: { facilities: FacilityRow[]; workGroups?: WorkGroup[] }) {
  const fieldId = useId();
  const today = todayBangkok();
  const [error, formAction, pending] = useActionState(createInspectionAction, null);
  const [selectedFacilityId, setSelectedFacilityId] = useState<number | null>(null);
  const [allAssets, setAssets] = useState<Asset[]>([]);
  const [loadState, setLoadState] = useState<{ status: "idle" | "loading" | "error"; message?: string }>({ status: "idle" });
  const [workGroupId, setWorkGroupId] = useState("");
  const facilityGroups = workGroups.filter((group) => group.facilityId === selectedFacilityId);
  // Mirrors the server: disposed/lost items are excluded, and a work group narrows the round.
  const assets = allAssets.filter((asset) => asset.currentStatus !== "Disposed" && asset.currentStatus !== "Lost" && (!workGroupId || String(asset.workGroupId ?? "") === workGroupId));
  const table = useTableState(assets, {
    number: (a) => a.assetNumber || a.assetRegistrationNo,
    name: (a) => a.assetName,
    type: (a) => `${assetClassLabel(a.assetClass)} ${a.deviceType || a.assetGroup}`,
    status: (a) => assetStatusLabel(a.currentStatus),
  });

  useEffect(() => {
    if (!selectedFacilityId) return;
    // A newer facility choice cancels the older request so its list can never overwrite the new one.
    const controller = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loading flag for the request started here
    setLoadState({ status: "loading" });
    fetch(withBasePath(`/api/assets/?facilityId=${selectedFacilityId}`), { signal: controller.signal })
      .then(async (r) => {
        const data: unknown = await r.json().catch(() => null);
        if (r.status === 401) throw new Error("เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่");
        if (!r.ok || !Array.isArray(data)) {
          const message = data && typeof data === "object" && "error" in data ? String((data as { error: unknown }).error) : "";
          throw new Error(message || "โหลดรายการครุภัณฑ์ไม่สำเร็จ");
        }
        setAssets(data as Asset[]);
        setLoadState({ status: "idle" });
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setAssets([]);
        setLoadState({ status: "error", message: err instanceof Error ? err.message : "โหลดรายการครุภัณฑ์ไม่สำเร็จ" });
      });
    return () => controller.abort();
  }, [selectedFacilityId]);

  // Submitting through startTransition (not the form `action` prop) keeps what the user typed
  // when the server returns an error; React only auto-resets forms that use `action`.
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="rounded-lg px-4 py-3 text-sm font-semibold text-red-700 bg-red-50 border border-red-200">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {/* Facility */}
        <div className="space-y-1">
          <label htmlFor={`${fieldId}-facilityId`} className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
            หน่วยบริการ <span className="text-red-500">*</span>
          </label>
          <FacilitySelect
            id={`${fieldId}-facilityId`}
            name="facilityId"
            required
            facilities={facilities}
            placeholder="พิมพ์ค้นหาหน่วยบริการ…"
            value={selectedFacilityId ? String(selectedFacilityId) : ""}
            onChange={(next) => {
              const nextId = next ? Number(next) : null;
              setSelectedFacilityId(nextId);
              setWorkGroupId("");
              table.resetPage();
              if (!nextId) {
                setAssets([]);
              }
            }}
          />
        </div>

        {/* Work group */}
        <div className="space-y-1">
          <label className="text-sm font-semibold" style={{ color: "var(--foreground)" }} htmlFor="inspection-work-group">
            กลุ่มงานที่ตรวจนับ
          </label>
          <select
            id="inspection-work-group"
            name="workGroupId"
            value={workGroupId}
            onChange={(e) => { setWorkGroupId(e.target.value); table.resetPage(); }}
            disabled={!selectedFacilityId || facilityGroups.length === 0}
            className="w-full rounded-lg border px-3 py-2 text-sm disabled:bg-slate-50"
            style={{ borderColor: "var(--line)", color: "var(--foreground)" }}
          >
            <option value="">{selectedFacilityId && facilityGroups.length === 0 ? "หน่วยงานนี้ยังไม่มีกลุ่มงาน (ตรวจทั้งหน่วยงาน)" : "ทุกกลุ่มงาน (ตรวจทั้งหน่วยงาน)"}</option>
            {facilityGroups.map((group) => <option key={group.id} value={group.id}>{group.workGroupName}</option>)}
          </select>
        </div>

        {/* Round name */}
        <div className="space-y-1">
          <label htmlFor={`${fieldId}-roundName`} className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
            ชื่อรอบการตรวจนับ <span className="text-red-500">*</span>
          </label>
          <input id={`${fieldId}-roundName`}
            name="roundName"
            required
            placeholder="เช่น การตรวจสอบพัสดุประจำปี 2569"
            className="w-full rounded-lg border px-3 py-2 text-sm"
            style={{ borderColor: "var(--line)", color: "var(--foreground)" }}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor={`${fieldId}-startDate`} className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
            วันที่เริ่มตรวจ <span className="text-red-500">*</span>
          </label>
          <input id={`${fieldId}-startDate`}
            type="date"
            name="startDate"
            required
            defaultValue={today}
            className="w-full rounded-lg border px-3 py-2 text-sm"
            style={{ borderColor: "var(--line)", color: "var(--foreground)" }}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor={`${fieldId}-endDate`} className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
            วันที่สิ้นสุด <span className="text-red-500">*</span>
          </label>
          <input id={`${fieldId}-endDate`}
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
        <label htmlFor={`${fieldId}-note`} className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
          หมายเหตุ
        </label>
        <textarea id={`${fieldId}-note`}
          name="note"
          rows={2}
          placeholder="บันทึกเพิ่มเติม (ไม่บังคับ)"
          className="w-full rounded-lg border px-3 py-2 text-sm"
          style={{ borderColor: "var(--line)", color: "var(--foreground)" }}
        />
      </div>

      {/* Committee */}
      <fieldset className="space-y-2 rounded-xl border p-4" style={{ borderColor: "var(--line)" }}>
        <legend className="px-1 text-sm font-semibold" style={{ color: "var(--foreground)" }}>คณะกรรมการตรวจนับ</legend>
        <p className="text-xs" style={{ color: "var(--muted)" }}>ชื่อและตำแหน่งจะพิมพ์เป็นช่องลงนามท้ายใบตรวจนับ แก้ไขภายหลังได้ในหน้ารอบตรวจ</p>
        <p className="text-xs" style={{ color: "var(--muted)" }}>เลือกประธานกรรมการ 1 คน ที่เหลือเป็นกรรมการ</p>
        {[0, 1, 2, 3].map((index) => <CommitteeRow key={index} index={index} defaultRole={index === 0 ? "chair" : "member"} />)}
      </fieldset>

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
          {loadState.status === "loading" ? (
            <div role="status" className="rounded-xl border border-dashed border-black/15 bg-[var(--neutral-bg)] px-4 py-8 text-center text-sm" style={{ color: "var(--muted)" }}>
              กำลังโหลดรายการครุภัณฑ์…
            </div>
          ) : loadState.status === "error" ? (
            <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-6 text-center text-sm text-red-700">
              {loadState.message}
            </div>
          ) : assets.length === 0 ? (
            <div className="rounded-xl border border-dashed border-black/15 bg-[var(--neutral-bg)] px-4 py-8 text-center text-sm" style={{ color: "var(--muted)" }}>
              ไม่พบครุภัณฑ์ในหน่วยบริการนี้
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border" style={{ borderColor: "var(--line)" }}>
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr style={{ background: "rgba(99,102,241,0.04)", borderBottom: "1px solid var(--line)" }}>
                    <th className="px-3 py-2 w-14 text-right font-medium">ลำดับ</th>
                    {([["number", "ทะเบียน"], ["name", "ชื่อทรัพย์สิน"], ["type", "กลุ่ม / ประเภท"], ["status", "สถานะปัจจุบัน"]] as const).map(([key, label]) => (
                      <SortableTh key={key} label={label} sortKey={key} sort={table.sort} onSort={table.onSort} className="px-3 py-2 font-semibold text-[var(--muted)]" />
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {table.rows.map((a, rowIndex) => (
                    <tr key={a.id} style={{ borderBottom: "1px solid var(--line)" }}>
                      <td className="px-3 py-2 text-right tabular-nums text-[var(--muted)]">{(table.start + rowIndex).toLocaleString("th-TH")}</td>
                      <td className="px-3 py-2 font-mono text-xs" style={{ color: "var(--muted)" }}>
                        {a.assetNumber || a.assetRegistrationNo}
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
              <TablePagination {...table} onPage={table.onPage} label="แบ่งหน้ารายการครุภัณฑ์" className="border-t border-black/6" />
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending || !selectedFacilityId}
          className="primary-action"
        >
          <AppIcon name="check" className="h-4 w-4" />
          {pending ? "กำลังบันทึก..." : "บันทึกรอบตรวจนับ"}
        </button>
        <ActionIconLink href="/inspection" icon="close" label="ยกเลิก" />
      </div>
    </form>
  );
}
