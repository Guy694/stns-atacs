"use client";

import { useRouter } from "next/navigation";

import { REPORT_VIEW_GROUPS, reportViewHref, type ReportView } from "./report-views";

type Props = {
  view: ReportView;
  fiscalYear: number;
  currentFiscalYear: number;
};

/** Mobile report picker: a native select that navigates to the same ?view= links as the desktop nav. */
export function ReportViewSelect({ view, fiscalYear, currentFiscalYear }: Props) {
  const router = useRouter();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="report-view-select" className="text-xs font-medium text-[var(--muted)]">
        เลือกรายงาน
      </label>
      <select
        id="report-view-select"
        value={view}
        onChange={(event) => router.push(reportViewHref(event.target.value as ReportView, fiscalYear, currentFiscalYear))}
        className="filter-control min-h-11 w-full text-base"
      >
        {REPORT_VIEW_GROUPS.map((group) => (
          <optgroup key={group.label} label={group.label}>
            {group.views.map((v) => (
              <option key={v.key} value={v.key}>
                {v.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  );
}
