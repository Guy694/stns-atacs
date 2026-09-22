"use client";

import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";

type Option = { value: string; label: string };
type Props = {
  values: { fy: string; district: string; facility: string; category: string };
  fiscalYears: number[];
  districts: string[];
  facilities: Array<{ id: number; name: string; district: string }>;
  categories: Array<{ key: string; label: string }>;
  lockedFacility?: boolean;
};

const control = "mt-1 min-h-11 w-full min-w-0 rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm text-[var(--foreground)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] disabled:bg-slate-50 disabled:text-[var(--muted)]";

/** Filters sit in one row above every chart; each change re-renders the server summary. */
export function DashboardFilters({ values, fiscalYears, districts, facilities, categories, lockedFacility = false }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

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
    <section aria-label="ตัวกรองแดชบอร์ด" aria-busy={pending} className="rounded-2xl border border-[var(--line)] bg-white p-4 sm:p-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[repeat(4,minmax(0,1fr))_auto] xl:items-end">
        <label className="min-w-0 text-sm font-medium">ปีงบประมาณ (ที่ได้มา)
          <select className={control} value={values.fy} onChange={(event) => apply({ fy: event.target.value })}>
            <option value="">ทุกปีงบประมาณ</option>
            {fiscalYears.map((year) => <option key={year} value={year}>ปีงบประมาณ {year}</option>)}
          </select>
        </label>
        <label className="min-w-0 text-sm font-medium">อำเภอ
          <select className={control} value={values.district} disabled={lockedFacility || districts.length <= 1} onChange={(event) => apply({ district: event.target.value })}>
            <option value="">ทุกอำเภอ</option>
            {districts.map((district) => <option key={district} value={district}>อ.{district}</option>)}
          </select>
        </label>
        <label className="min-w-0 text-sm font-medium">หน่วยงาน
          <select className={control} value={values.facility} disabled={lockedFacility || facilityOptions.length <= 1} onChange={(event) => apply({ facility: event.target.value })}>
            <option value="">ทุกหน่วยงาน{values.district ? `ใน อ.${values.district}` : ""}</option>
            {facilityOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <label className="min-w-0 text-sm font-medium">ประเภทครุภัณฑ์
          <select className={control} value={values.category} onChange={(event) => apply({ category: event.target.value })}>
            <option value="">ทุกประเภท</option>
            {categories.map((category) => <option key={category.key} value={category.key}>{category.label}</option>)}
          </select>
        </label>
        <div className="flex min-h-11 items-center gap-3 sm:col-span-2 xl:col-span-1">
          <button
            type="button"
            disabled={activeCount === 0 || pending}
            onClick={() => startTransition(() => router.push(pathname, { scroll: false }))}
            className="min-h-11 rounded-lg border border-[var(--line)] px-4 text-sm font-medium text-[var(--primary-text)] transition hover:bg-[var(--primary-soft)] disabled:cursor-not-allowed disabled:text-[var(--muted)] disabled:hover:bg-transparent"
          >
            ล้างตัวกรอง{activeCount ? ` (${activeCount})` : ""}
          </button>
          <span role="status" className="text-xs text-[var(--muted)]">{pending ? "กำลังอัปเดต…" : ""}</span>
        </div>
      </div>
    </section>
  );
}
