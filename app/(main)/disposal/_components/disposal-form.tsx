"use client";

import { useActionState } from "react";
import Link from "next/link";

import { StatusBadge } from "@/app/_components/ui/status-badge";
import { disposalAssetAction } from "@/app/(main)/disposal/actions";
import { assetStatusLabel, assetStatusTone } from "@/lib/asset-status";
import type { AssetWithFacility } from "@/lib/assets";

type Props = { asset: AssetWithFacility };

const DISPOSAL_TYPES = [
  {
    value: "Broken",
    label: "บันทึกชำรุด",
    desc: "อุปกรณ์เสียหาย ใช้งานไม่ได้ รอซ่อมหรือรอจำหน่าย",
    color: "border-rose-400 bg-rose-50 text-rose-700",
    dot: "bg-rose-500",
  },
  {
    value: "Inactive",
    label: "ระงับการใช้งาน",
    desc: "หยุดใช้งานชั่วคราว ยังไม่จำหน่ายออก",
    color: "border-amber-400 bg-amber-50 text-amber-700",
    dot: "bg-amber-500",
  },
  {
    value: "Disposed",
    label: "จำหน่ายออก",
    desc: "ตัดทรัพย์สินออกจากระบบ จำหน่ายหรือโอนออก",
    color: "border-[var(--primary-soft-strong)] bg-[var(--primary-soft)] text-[var(--primary-text)]",
    dot: "bg-[var(--primary)]",
  },
  {
    value: "Lost",
    label: "สูญหาย",
    desc: "ทรัพย์สินสูญหาย ไม่พบ ณ สถานที่ตั้ง",
    color: "border-slate-400 bg-slate-50 text-slate-700",
    dot: "bg-slate-500",
  },
] as const;

export function DisposalForm({ asset }: Props) {
  const [error, formAction, pending] = useActionState(disposalAssetAction, null);

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="assetId" value={asset.id} />

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      )}

      {/* Asset info */}
      <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">ทรัพย์สินที่ดำเนินการ</p>
        <div className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <span className="text-[var(--muted)]">ชื่อทรัพย์สิน: </span>
            <span className="font-semibold">{asset.assetName}</span>
          </div>
          <div>
            <span className="text-[var(--muted)]">เลขทะเบียน: </span>
            <span className="font-mono font-semibold">{asset.assetRegistrationNo}</span>
          </div>
          <div>
            <span className="text-[var(--muted)]">หน่วยงาน: </span>
            <span className="font-semibold">{asset.facilityName}</span>
          </div>
          <div>
            <span className="text-[var(--muted)]">สถานะปัจจุบัน: </span>
            <StatusBadge tone={assetStatusTone(asset.currentStatus)}>
              {assetStatusLabel(asset.currentStatus)}
            </StatusBadge>
          </div>
        </div>
      </div>

      {/* Disposal type */}
      <div>
        <label className="mb-2 block text-sm font-medium">
          ประเภทการดำเนินการ <span className="text-rose-500">*</span>
        </label>
        <div className="grid gap-2 sm:grid-cols-2">
          {DISPOSAL_TYPES.map((t) => (
            <label key={t.value} className={`flex cursor-pointer items-start gap-3 rounded-xl border-2 px-4 py-3 transition has-[:checked]:ring-2 has-[:checked]:ring-offset-1 has-[:checked]:ring-[var(--primary-soft-strong)] ${t.color}`}>
              <input type="radio" name="disposalType" value={t.value} required className="mt-0.5 accent-[var(--primary)]" />
              <div>
                <p className="text-sm font-semibold">{t.label}</p>
                <p className="mt-0.5 text-xs opacity-80">{t.desc}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Date */}
      <div>
        <label className="mb-1 block text-sm font-medium">วันที่ดำเนินการ</label>
        <input
          type="date"
          name="noteDate"
          defaultValue={new Date().toISOString().slice(0, 10)}
          className="rounded-xl border border-[var(--line)] bg-white/80 px-3 py-2 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15"
        />
      </div>

      {/* Reason */}
      <div>
        <label className="mb-1 block text-sm font-medium">
          เหตุผล / รายละเอียด <span className="text-rose-500">*</span>
        </label>
        <textarea
          name="reason"
          rows={4}
          required
          placeholder="ระบุเหตุผลให้ชัดเจน เช่น อุปกรณ์ไหม้เสียหายจากไฟฟ้าลัดวงจร, ครบอายุการใช้งาน 7 ปี, ไม่พบ ณ สถานที่ตั้ง…"
          className="w-full rounded-xl border border-[var(--line)] bg-white/80 px-3 py-2.5 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15"
        />
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-2">
        <Link
          href={`/assets/${asset.id}`}
          className="rounded-xl border border-[var(--line)] bg-white/80 px-5 py-2.5 text-sm font-medium text-[var(--muted)] transition hover:bg-white"
        >
          ยกเลิก
        </Link>
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-rose-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:opacity-60"
        >
          {pending ? "กำลังบันทึก…" : "บันทึกการดำเนินการ"}
        </button>
      </div>
    </form>
  );
}
