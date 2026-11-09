"use client";

import { usePathname, useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";

import { FacilitySelect } from "@/app/_components/ui/facility-select";
import { AppIcon } from "@/app/_components/ui/icon";

type Props = {
  values: { fy: string; district: string; facility: string; category: string };
  fiscalYears: number[];
  districts: string[];
  /** `typecode` lets the facility dropdown group สสจ. → สสอ. → รพท. → รพช. → รพ.สต.; without it names are used. */
  facilities: Array<{ id: number; name: string; district: string; typecode?: string | null }>;
  categories: Array<{ key: string; label: string }>;
  lockedFacility?: boolean;
};

const control = "filter-control";

/**
 * Filters sit in one row above every chart; each change re-renders the server summary.
 * Below `sm` the panel is collapsed behind one toggle so the numbers stay on the first screen.
 */
export function DashboardFilters({ values, fiscalYears, districts, facilities, categories, lockedFacility = false }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  // U4: keep the user's latest selection locally — the server `values` only catch up after the navigation,
  // so building the next query from them would drop a change made while the previous one was still loading.
  const valuesKey = JSON.stringify(values);
  const [current, setCurrent] = useState(values);
  const [syncedKey, setSyncedKey] = useState(valuesKey);
  if (!pending && syncedKey !== valuesKey) {
    setSyncedKey(valuesKey);
    setCurrent(values);
  }

  function navigate(next: Props["values"]) {
    setCurrent(next);
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(next)) if (value) query.set(key, value);
    startTransition(() => router.push(query.size ? `${pathname}?${query}` : pathname, { scroll: false }));
  }

  function apply(patch: Partial<Props["values"]>) {
    const next = { ...current, ...patch };
    if (patch.district !== undefined && patch.district !== current.district) next.facility = "";
    navigate(next);
  }

  const facilityOptions = facilities
    .filter((facility) => !current.district || facility.district === current.district)
    .map((facility) => ({ id: facility.id, name: facility.name, typecode: facility.typecode, districtName: current.district ? "" : `อ.${facility.district}` }));
  const activeCount = Object.values(current).filter(Boolean).length;

  return (
    <section aria-label="ตัวกรองแดชบอร์ด" aria-busy={pending} className="rounded-2xl border border-[var(--line)] bg-white p-2 sm:p-4">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className="flex min-h-11 w-full items-center gap-2 rounded-xl px-2 text-sm font-semibold text-[var(--primary-text)] sm:hidden"
      >
        <AppIcon name="filter" className="h-4 w-4" />
        ตัวกรอง{activeCount ? ` (${activeCount} ที่เลือก)` : ""}
        {pending && <span className="text-xs font-normal text-[var(--muted)]">กำลังอัปเดต…</span>}
        <AppIcon name="chevron-down" className={`ml-auto h-4 w-4 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      <div id={panelId} className={`${open ? "grid" : "hidden"} gap-3 p-1 pt-2 sm:grid sm:grid-cols-2 sm:p-0 xl:grid-cols-[repeat(4,minmax(0,1fr))_auto] xl:items-end`}>
        <label className="filter-label">ปีงบประมาณ (ที่ได้มา)
          <select className={control} value={current.fy} onChange={(event) => apply({ fy: event.target.value })}>
            <option value="">ทุกปีงบประมาณ</option>
            {fiscalYears.map((year) => <option key={year} value={year}>ปีงบประมาณ {year}</option>)}
          </select>
        </label>
        <label className="filter-label">อำเภอ
          <select className={control} value={current.district} disabled={lockedFacility || districts.length <= 1} onChange={(event) => apply({ district: event.target.value })}>
            <option value="">ทุกอำเภอ</option>
            {districts.map((district) => <option key={district} value={district}>อ.{district}</option>)}
          </select>
        </label>
        <div className="filter-label">
          <span>หน่วยงาน</span>
          <FacilitySelect
            className="mt-1"
            facilities={facilityOptions}
            value={current.facility}
            onChange={(facility) => apply({ facility })}
            emptyLabel={`ทุกหน่วยงาน${current.district ? `ใน อ.${current.district}` : ""}`}
            disabled={lockedFacility || facilityOptions.length <= 1}
            aria-label="หน่วยงาน"
          />
        </div>
        <label className="filter-label">ประเภทครุภัณฑ์
          <select className={control} value={current.category} onChange={(event) => apply({ category: event.target.value })}>
            <option value="">ทุกประเภท</option>
            {categories.map((category) => <option key={category.key} value={category.key}>{category.label}</option>)}
          </select>
        </label>
        <div className="flex min-h-9 items-center gap-2 sm:col-span-2 xl:col-span-1">
          <button
            type="button"
            disabled={activeCount === 0 || pending}
            onClick={() => navigate({ fy: "", district: "", facility: "", category: "" })}
            className="filter-button border border-[var(--line)] font-medium text-[var(--primary-text)] transition-colors duration-200 hover:bg-[var(--primary-soft)] disabled:cursor-not-allowed disabled:text-[var(--muted)] disabled:hover:bg-transparent"
          >
            <AppIcon name="undo" className="h-4 w-4" />
            ล้างตัวกรอง{activeCount ? ` (${activeCount})` : ""}
          </button>
          <span role="status" className="text-xs text-[var(--muted)]">{pending ? "กำลังอัปเดต…" : ""}</span>
        </div>
      </div>
    </section>
  );
}
