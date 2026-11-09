"use client";

import { useActionState, useState, useId } from "react";
import { transferAssetAction } from "@/app/(main)/transfer/actions";
import type { AssetWithFacility } from "@/lib/assets";
import { todayBangkok } from "@/lib/local-date";
import { submitWithoutReset } from "@/app/_components/ui/submit-without-reset";
import { ActionIconLink } from "@/app/_components/ui/action-icon-button";
import { FacilitySelect } from "@/app/_components/ui/facility-select";
import { AppIcon } from "@/app/_components/ui/icon";

type SurveyOption = {
  id: number;
  facility_id: number;
  facility_name: string | null;
  district_name: string | null;
};

type WorkGroupOption = { id: number; facilityId: number; workGroupName: string };

type Props = {
  asset: AssetWithFacility;
  surveys: SurveyOption[];
  workGroups: WorkGroupOption[];
};

const inputClass = "w-full rounded-xl border border-[var(--line)] bg-white/80 px-3 py-2.5 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15";

export function TransferForm({ asset, surveys, workGroups }: Props) {
  const fieldId = useId();
  const [error, formAction, pending] = useActionState(transferAssetAction, null);
  const [surveyId, setSurveyId] = useState("");
  const destinationFacilityId = surveys.find((s) => String(s.id) === surveyId)?.facility_id;
  const destinationGroups = workGroups.filter((group) => group.facilityId === destinationFacilityId);
  const today = todayBangkok();

  // One survey per facility: the option value is the survey id, shown by facility name.
  const destinations = surveys.map((s) => ({ id: s.id, name: s.facility_name ?? `หน่วยงาน #${s.facility_id}`, districtName: s.district_name }));

  return (
    <form onSubmit={submitWithoutReset(formAction)} className="space-y-5">
      <input type="hidden" name="assetId" value={asset.id} />

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      )}

      {/* Current asset info */}
      <div className="rounded-xl border border-[var(--primary-soft-strong)] bg-[var(--primary-soft)] p-4">
        <p className="text-xs font-semibold text-[var(--primary-text)] mb-2">ทรัพย์สินที่จะโอนย้าย</p>
        <div className="grid gap-2 sm:grid-cols-2 text-sm">
          <div>
            <span className="text-[var(--muted)]">ชื่อทรัพย์สิน: </span>
            <span className="font-semibold">{asset.assetName}</span>
          </div>
          <div>
            <span className="text-[var(--muted)]">เลขทะเบียน: </span>
            <span className="font-mono font-semibold">{asset.assetNumber}</span>
          </div>
          <div>
            <span className="text-[var(--muted)]">หน่วยงานปัจจุบัน: </span>
            <span className="font-semibold">{asset.facilityName}</span>
          </div>
          <div>
            <span className="text-[var(--muted)]">ผู้ครอบครองปัจจุบัน: </span>
            <span className="font-semibold">{asset.ownerName || "–"}</span>
          </div>
          <div className="sm:col-span-2">
            <span className="text-[var(--muted)]">ตำแหน่งปัจจุบัน: </span>
            <span className="font-semibold">{asset.locationDetail || "–"}</span>
          </div>
        </div>
      </div>

      {/* New facility */}
      <div>
        <label htmlFor={`${fieldId}-newSurveyId`} className="block text-sm font-medium mb-1">
          หน่วยงานปลายทาง <span className="text-rose-500">*</span>
        </label>
        <FacilitySelect
          id={`${fieldId}-newSurveyId`}
          name="newSurveyId"
          required
          facilities={destinations}
          placeholder="พิมพ์ค้นหาหน่วยงานปลายทาง…"
          value={surveyId}
          onChange={setSurveyId}
        />
      </div>

      {/* Work group of the destination facility */}
      {destinationFacilityId !== undefined && (
        <div>
          <label htmlFor={`${fieldId}-newWorkGroupId`} className="block text-sm font-medium mb-1">
            กลุ่มงานปลายทาง {destinationGroups.length > 0 && <span className="text-rose-500">*</span>}
          </label>
          {destinationGroups.length > 0 ? (
            <select id={`${fieldId}-newWorkGroupId`}
              key={destinationFacilityId}
              name="newWorkGroupId"
              required
              defaultValue={destinationFacilityId === asset.facilityId && asset.workGroupId ? String(asset.workGroupId) : ""}
              className={inputClass}
            >
              <option value="" disabled>-- เลือกกลุ่มงาน --</option>
              {destinationGroups.map((group) => (
                <option key={group.id} value={group.id}>{group.workGroupName}</option>
              ))}
            </select>
          ) : (
            <>
              <input type="hidden" name="newWorkGroupId" value="" />
              <p className="rounded-xl border border-[var(--line)] bg-white/60 px-3 py-2.5 text-sm text-[var(--muted)]">หน่วยงานนี้ยังไม่มีกลุ่มงาน</p>
            </>
          )}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`${fieldId}-transferDate`} className="block text-sm font-medium mb-1">วันที่โอนย้าย <span className="text-rose-500">*</span></label>
          <input id={`${fieldId}-transferDate`} type="date" name="transferDate" required defaultValue={today} max={today} className={inputClass} />
        </div>
        <div>
          <label htmlFor={`${fieldId}-documentNo`} className="block text-sm font-medium mb-1">เลขที่หนังสือ / ใบโอน</label>
          <input id={`${fieldId}-documentNo`} name="documentNo" type="text" placeholder="เช่น สต 0033.001/123" className={inputClass} />
        </div>
      </div>

      {/* New owner */}
      <div>
        <label htmlFor={`${fieldId}-newOwnerName`} className="block text-sm font-medium mb-1">ผู้ครอบครองใหม่</label>
        <input id={`${fieldId}-newOwnerName`}
          name="newOwnerName"
          type="text"
          placeholder="ชื่อ-นามสกุล ผู้ครอบครองใหม่"
          defaultValue={asset.ownerName}
          className="w-full rounded-xl border border-[var(--line)] bg-white/80 px-3 py-2.5 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15"
        />
      </div>

      {/* New location */}
      <div>
        <label htmlFor={`${fieldId}-newLocationDetail`} className="block text-sm font-medium mb-1">ตำแหน่งติดตั้งใหม่</label>
        <input id={`${fieldId}-newLocationDetail`}
          name="newLocationDetail"
          type="text"
          placeholder="อาคาร / ชั้น / ห้อง"
          defaultValue={asset.locationDetail}
          className="w-full rounded-xl border border-[var(--line)] bg-white/80 px-3 py-2.5 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15"
        />
      </div>

      {/* Reason */}
      <div>
        <label htmlFor={`${fieldId}-reason`} className="block text-sm font-medium mb-1">เหตุผลในการโอนย้าย</label>
        <textarea id={`${fieldId}-reason`}
          name="reason"
          rows={3}
          placeholder="ระบุเหตุผลในการโอนย้าย เช่น ปรับโครงสร้างหน่วยงาน, เพิ่มอุปกรณ์ประจำสาขา…"
          className="w-full rounded-xl border border-[var(--line)] bg-white/80 px-3 py-2.5 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15"
        />
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-2">
        <ActionIconLink href={`/assets/${asset.id}`} icon="close" label="ยกเลิก" />
        <button
          type="submit"
          disabled={pending}
          className="primary-action"
        >
          <AppIcon name="repeat" className="h-4 w-4" />
          {pending ? "กำลังบันทึก…" : "บันทึกการโอนย้าย"}
        </button>
      </div>
    </form>
  );
}
