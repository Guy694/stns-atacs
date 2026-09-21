"use client";
import { useEffect, useId, useState } from "react";
import { getAssetSubtypeOptions } from "@/app/(main)/assets/subtype-actions";
import { ASSET_DETAIL_FIELDS, type AssetExtensions, type AssetSubtype } from "@/lib/asset-details";
import { assetClassLabel } from "@/lib/asset-classes";

export function AssetSpecificFields({ assetClass, extensions = {} }: { assetClass: string; extensions?: AssetExtensions }) {
  const [options, setOptions] = useState<AssetSubtype[] | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const prefix = useId();
  useEffect(() => {
    let active = true;
    getAssetSubtypeOptions().then(items => { if (active) { setOptions(items); setError(""); } }).catch(() => { if (active) setError("โหลดประเภทย่อยไม่สำเร็จ กรุณาลองอีกครั้ง"); });
    return () => { active = false; };
  }, [attempt]);
  const fields = ASSET_DETAIL_FIELDS[assetClass];
  if (!fields) return null;
  const current = extensions[assetClass];
  const control = "mt-1 min-w-0 w-full rounded-xl border border-black/15 bg-white px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--accent)]";
  return <fieldset className="min-w-0 space-y-4 border-t border-black/10 pt-4">
    <legend className="px-1 text-base font-semibold">รายละเอียด{assetClassLabel(assetClass)}</legend>
    {!options ? <div role="status" className="text-sm">{error || "กำลังโหลดประเภทย่อย…"}{error && <button type="button" className="ml-2 underline" onClick={() => setAttempt(n => n + 1)}>ลองอีกครั้ง</button>}</div> : <label className="block text-sm font-medium">ประเภทย่อย
      <select key={assetClass} name="subtypeId" defaultValue={current?.subtypeId ?? ""} className={control}>
        <option value="">ยังไม่ระบุ</option>
        {options.filter(o => o.assetClass === assetClass && (o.isActive || o.id === current?.subtypeId)).map(o => <option key={o.id} value={o.id}>{o.name}{o.isActive ? "" : " (ปิดใช้งานแล้ว)"}</option>)}
      </select>
    </label>}
    <div className="grid gap-4 sm:grid-cols-2">{Object.entries(ASSET_DETAIL_FIELDS).map(([group, definitions]) => <div key={group} hidden={group !== assetClass} className="contents">
      {definitions.map(field => <div key={field.key} className="min-w-0" hidden={group !== assetClass}>
        <label htmlFor={`${prefix}-${group}-${field.key}`} className="text-sm font-medium">{field.label}</label>
        <input id={`${prefix}-${group}-${field.key}`} name={`detail_${field.key}`} disabled={group !== assetClass} defaultValue={extensions[group]?.details[field.key] ?? ""} type={field.type ?? "text"} min={field.type === "number" ? 0 : undefined} max={field.type === "number" ? field.max ?? 1e12 : undefined} step={field.key === "floor_count" ? 1 : "any"} maxLength={1000} className={control} />
      </div>)}
    </div>)}</div>
  </fieldset>;
}
