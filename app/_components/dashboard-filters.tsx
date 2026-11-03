"use client";

import { usePathname, useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";

import { AppIcon } from "@/app/_components/ui/icon";

type Option = { value: string; label: string };
type Props = {
  values: { fy: string; district: string; facility: string; category: string };
  fiscalYears: number[];
  districts: string[];
  facilities: Array<{ id: number; name: string; district: string }>;
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

  function apply(patch: Partial<Props["values"]>) {
    const next = { ...values, ...patch };
    if (patch.district !== undefined && patch.district !== values.district) next.facility = "";
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(next)) if (value) query.set(key, value);
    startTransition(() => router.push(query.size ? `${pathname}?${query}` : pathname, { scroll: false }));
  }

  const facilityOptions: Option[] = facilities
    .filter((facility) => !values.district || facility.district === values.district)
    .map((facility) => ({ value: String(facility.id), label: values.district ? facility.name : `${facility.name} · อ.${facility.district}` }));
  const activeCount = Object.values(values).filter(Boolean).length;

  return (
    <section aria-label="ตัวกรองแดชบอร์ด" aria-busy={pending} className="rounded-2xl border border-[var(--line)] bg-white p-2 sm:p-4">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className="flex min-h-11 w-full items-center gap-2 rounded-xl px-2 text-sm font-semibold text-[var(--primary-text)] sm:hidden"
      >
        <AppIcon name="layers" className="h-4 w-4" />
        ตัวกรอง{activeCount ? ` (${activeCount} ที่เลือก)` : ""}
        {pending && <span className="text-xs font-normal text-[var(--muted)]">กำลังอัปเดต…</span>}
        <AppIcon name="arrow-down" className={`ml-auto h-4 w-4 transition ${open ? "rotate-180" : ""}`} />
      </button>
      <div id={panelId} className={`${open ? "grid" : "hidden"} gap-3 p-1 pt-2 sm:grid sm:grid-cols-2 sm:p-0 xl:grid-cols-[repeat(4,minmax(0,1fr))_auto] xl:items-end`}>
        <label className="filter-label">ปีงบประมาณ (ที่ได้มา)
          <select className={control} value={values.fy} onChange={(event) => apply({ fy: event.target.value })}>
            <option value="">ทุกปีงบประมาณ</option>
            {fiscalYears.map((year) => <option key={year} value={year}>ปีงบประมาณ {year}</option>)}
          </select>
        </label>
        <label className="filter-label">อำเภอ
          <select className={control} value={values.district} disabled={lockedFacility || districts.length <= 1} onChange={(event) => apply({ district: event.target.value })}>
            <option value="">ทุกอำเภอ</option>
            {districts.map((district) => <option key={district} value={district}>อ.{district}</option>)}
          </select>
        </label>
        <label className="filter-label">หน่วยงาน
          <select className={control} value={values.facility} disabled={lockedFacility || facilityOptions.length <= 1} onChange={(event) => apply({ facility: event.target.value })}>
            <option value="">ทุกหน่วยงาน{values.district ? `ใน อ.${values.district}` : ""}</option>
            {facilityOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <label className="filter-label">ประเภทครุภัณฑ์
          <select className={control} value={values.category} onChange={(event) => apply({ category: event.target.value })}>
            <option value="">ทุกประเภท</option>
            {categories.map((category) => <option key={category.key} value={category.key}>{category.label}</option>)}
          </select>
        </label>
        <div className="flex min-h-9 items-center gap-2 sm:col-span-2 xl:col-span-1">
          <button
            type="button"
            disabled={activeCount === 0 || pending}
            onClick={() => startTransition(() => router.push(pathname, { scroll: false }))}
            className="filter-button border border-[var(--line)] font-medium text-[var(--primary-text)] transition hover:bg-[var(--primary-soft)] disabled:cursor-not-allowed disabled:text-[var(--muted)] disabled:hover:bg-transparent"
          >
            ล้างตัวกรอง{activeCount ? ` (${activeCount})` : ""}
          </button>
          <span role="status" className="text-xs text-[var(--muted)]">{pending ? "กำลังอัปเดต…" : ""}</span>
        </div>
      </div>
    </section>
  );
}
