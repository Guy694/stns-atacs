"use client";
import { useActionState } from "react";
import { saveAssetSubtype } from "../subtype-actions";
import { ASSET_CLASS_OPTIONS } from "@/lib/asset-classes";
import type { AssetSubtype } from "@/lib/asset-details";

export function SubtypeForm({ item }: { item?: AssetSubtype }) {
  const [error, action, pending] = useActionState(saveAssetSubtype, null);
  const control = "rounded-lg border border-black/15 bg-white px-3 py-2 text-sm text-[var(--foreground)]";
  return <form action={action} className="flex flex-wrap items-end gap-3 border-b border-black/10 py-4">
    {item && <input type="hidden" name="id" value={item.id} />}
    <label className="grid gap-1 text-sm">กลุ่มครุภัณฑ์
      {item ? <><input type="hidden" name="assetClass" value={item.assetClass} /><span className="py-2">{ASSET_CLASS_OPTIONS.find(o => o.value === item.assetClass)?.shortLabel}</span></> : <select name="assetClass" className={control} required>{ASSET_CLASS_OPTIONS.filter(o => o.value !== "IT").map(o => <option key={o.value} value={o.value}>{o.shortLabel}</option>)}</select>}
    </label>
    <label className="grid flex-1 gap-1 text-sm">ชื่อประเภทย่อย<input name="name" defaultValue={item?.name ?? ""} maxLength={150} required className={control} /></label>
    {item && <label className="flex items-center gap-2 py-2 text-sm"><input type="checkbox" name="isActive" value="1" defaultChecked={item.isActive} />เปิดใช้งาน</label>}
    <button disabled={pending} className="rounded-lg bg-[var(--accent-strong)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{pending ? "กำลังบันทึก…" : item ? "บันทึก" : "เพิ่มประเภทย่อย"}</button>
    {error && <p role="alert" className="w-full text-sm text-red-700">{error}</p>}
  </form>;
}
