import type { DashboardSummary } from "@/lib/dashboard-summary";

export const numberFormat = new Intl.NumberFormat("th-TH");
export const percent = (value: number) => `${(value * 100).toLocaleString("th-TH", { maximumFractionDigits: 1 })}%`;
export const baht = (value: number) => value.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export function compactBaht(value: number) {
  if (value >= 1_000_000) return { value: (value / 1_000_000).toLocaleString("th-TH", { maximumFractionDigits: 2 }), unit: "ล้านบาท" };
  return { value: value.toLocaleString("th-TH", { maximumFractionDigits: 0 }), unit: "บาท" };
}

type Filters = DashboardSummary["filters"];
export function hrefWith(basePath: string, filters: Filters, patch: Partial<Filters>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...filters, ...patch })) if (value) query.set(key, value);
  return query.size ? `${basePath}?${query}` : basePath;
}

/** Hover/focus tooltip for one mark; the visible labels already carry the same numbers. */
export function Tip({ children }: { children: React.ReactNode }) {
  return (
    <span role="tooltip" className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden w-max max-w-60 -translate-x-1/2 rounded-lg bg-[#0b0b0b] px-3 py-2 text-xs leading-5 text-white shadow-lg group-hover:block group-focus-visible:block">
      {children}
    </span>
  );
}
