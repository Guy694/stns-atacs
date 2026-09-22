"use client";
import { useEffect, useId, useRef, useState } from "react";
import { createInlineAssetSubtype, getAssetSubtypeEditor } from "@/app/(main)/assets/subtype-actions";
import { ASSET_DETAIL_FIELDS, type AssetExtensions, type AssetSubtype } from "@/lib/asset-details";
import { assetClassLabel } from "@/lib/asset-classes";

function SubtypePicker({ assetClass, current, onBusyChange }: { assetClass: string; current?: AssetExtensions[string]; onBusyChange?: (busy: boolean) => void }) {
  const [options, setOptions] = useState<AssetSubtype[] | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [saveError, setSaveError] = useState("");
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState("");
  const [selected, setSelected] = useState(String(current?.subtypeId ?? ""));
  const saving = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const prefix = useId();
  useEffect(() => {
    let active = true;
    getAssetSubtypeEditor().then(({ items, canManage }) => {
      if (active) { setOptions(items); setCanManage(canManage); setError(""); }
    }).catch(() => { if (active) setError("โหลดประเภทย่อยไม่สำเร็จ กรุณาลองอีกครั้ง"); });
    return () => { active = false; };
  }, [attempt]);
  useEffect(() => () => onBusyChange?.(false), [onBusyChange]);
  useEffect(() => { if (adding) inputRef.current?.focus(); }, [adding]);

  async function addSubtype() {
    if (saving.current) return;
    if (!name.trim()) { setSaveError("กรุณาระบุชื่อประเภทย่อย"); inputRef.current?.focus(); return; }
    saving.current = true;
    setPending(true);
    onBusyChange?.(true);
    setSaveError("");
    setNotice("");
    try {
      const result = await createInlineAssetSubtype(assetClass, name);
      if (result.error || !result.item) { setSaveError(result.error || "เพิ่มประเภทย่อยไม่สำเร็จ"); return; }
      const item = result.item;
      setOptions(items => [...(items ?? []), item]);
      setSelected(String(item.id));
      setAdding(false);
      setName("");
      setNotice(`เพิ่มและเลือก “${item.name}” แล้ว`);
      buttonRef.current?.focus();
    } catch { setSaveError("เพิ่มประเภทย่อยไม่สำเร็จ กรุณาลองอีกครั้ง"); }
    finally { saving.current = false; setPending(false); onBusyChange?.(false); }
  }

  const control = "mt-1 min-w-0 w-full rounded-xl border border-black/15 bg-white px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--accent)]";
  if (!options) return <div role="status" className="text-sm">{error || "กำลังโหลดประเภทย่อย…"}{error && <button type="button" className="ml-2 underline" onClick={() => setAttempt(n => n + 1)}>ลองอีกครั้ง</button>}</div>;
  return <div className="space-y-3">
    <div className="flex flex-wrap items-end gap-2">
      <label className="min-w-0 flex-1 text-sm font-medium">ประเภทย่อย
        <select name="subtypeId" value={selected} onChange={e => setSelected(e.target.value)} className={control}>
          <option value="">ยังไม่ระบุ</option>
          {options.filter(o => o.assetClass === assetClass && (o.isActive || o.id === current?.subtypeId)).map(o => <option key={o.id} value={o.id}>{o.name}{o.isActive ? "" : " (ปิดใช้งานแล้ว)"}</option>)}
        </select>
      </label>
      {canManage && <button ref={buttonRef} type="button" aria-expanded={adding} aria-controls={`${prefix}-add`} onClick={() => { setAdding(true); setSaveError(""); setNotice(""); }} className="rounded-xl border border-black/15 px-3 py-2 text-sm font-medium hover:bg-white">+ เพิ่มประเภทย่อย</button>}
    </div>
    {!canManage && <p className="text-sm text-[var(--muted)]">หากต้องการเพิ่มประเภทย่อย กรุณาติดต่อผู้ดูแลระบบ</p>}
    {canManage && adding && <div id={`${prefix}-add`} className="space-y-2 rounded-xl border border-black/15 p-3">
      <label htmlFor={`${prefix}-name`} className="text-sm font-medium">ชื่อประเภทย่อยใหม่ · {assetClassLabel(assetClass)}</label>
      <input ref={inputRef} id={`${prefix}-name`} value={name} onChange={e => setName(e.target.value)} maxLength={150} disabled={pending} aria-invalid={Boolean(saveError)} aria-describedby={saveError ? `${prefix}-error` : undefined} className={control} placeholder="เช่น เก้าอี้สำนักงาน" onKeyDown={e => {
        if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); void addSubtype(); }
      }} />
      {saveError && <p id={`${prefix}-error`} role="alert" className="text-sm text-red-700">{saveError}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={pending} onClick={() => void addSubtype()} className="rounded-lg bg-[var(--accent-strong)] px-3 py-2 text-sm font-medium text-white disabled:opacity-50">{pending ? "กำลังเพิ่ม…" : "เพิ่มและเลือกใช้"}</button>
        <button type="button" disabled={pending} onClick={() => { setAdding(false); setName(""); setSaveError(""); buttonRef.current?.focus(); }} className="rounded-lg border border-black/15 px-3 py-2 text-sm disabled:opacity-50">ยกเลิก</button>
      </div>
    </div>}
    {notice && <p role="status" className="text-sm">{notice}</p>}
  </div>;
}

export function AssetSpecificFields({ assetClass, extensions = {}, onBusyChange }: { assetClass: string; extensions?: AssetExtensions; onBusyChange?: (busy: boolean) => void }) {
  const prefix = useId();
  const fields = ASSET_DETAIL_FIELDS[assetClass];
  if (!fields) return null;
  const current = extensions[assetClass];
  const control = "mt-1 min-w-0 w-full rounded-xl border border-black/15 bg-white px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--accent)]";
  return <fieldset className="min-w-0 space-y-4 border-t border-black/10 pt-4">
    <legend className="px-1 text-base font-semibold">รายละเอียด{assetClassLabel(assetClass)}</legend>
    <SubtypePicker key={assetClass} assetClass={assetClass} current={current} onBusyChange={onBusyChange} />
    <div className="grid gap-4 sm:grid-cols-2">{Object.entries(ASSET_DETAIL_FIELDS).map(([group, definitions]) => <div key={group} hidden={group !== assetClass} className="contents">
      {definitions.map(field => <div key={field.key} className="min-w-0" hidden={group !== assetClass}>
        <label htmlFor={`${prefix}-${group}-${field.key}`} className="text-sm font-medium">{field.label}</label>
        <input id={`${prefix}-${group}-${field.key}`} name={`detail_${field.key}`} disabled={group !== assetClass} defaultValue={extensions[group]?.details[field.key] ?? ""} type={field.type ?? "text"} min={field.type === "number" ? 0 : undefined} max={field.type === "number" ? field.max ?? 1e12 : undefined} step={field.key === "floor_count" ? 1 : "any"} maxLength={1000} className={control} />
      </div>)}
    </div>)}</div>
  </fieldset>;
}
