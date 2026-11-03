import Link from "next/link";

import { ReportViewSelect } from "./report-view-select";
import { REPORT_VIEW_GROUPS, reportViewHref, type ReportView } from "./report-views";

type Props = {
  view: ReportView;
  fiscalYear: number;
  currentFiscalYear: number;
};

/** Report switcher: grouped segmented nav on desktop, native select on mobile. Both use the same ?view= links. */
export function ReportNav({ view, fiscalYear, currentFiscalYear }: Props) {
  return (
    <nav aria-label="เลือกรายงาน">
      <div className="md:hidden">
        <ReportViewSelect view={view} fiscalYear={fiscalYear} currentFiscalYear={currentFiscalYear} />
      </div>

      <div className="hidden flex-wrap items-stretch gap-x-5 gap-y-3 md:flex">
        {REPORT_VIEW_GROUPS.map((group) => (
          <div key={group.label} role="group" aria-labelledby={`report-group-${group.views[0].key}`} className="flex flex-col gap-1.5">
            <span id={`report-group-${group.views[0].key}`} className="px-1 text-xs font-semibold text-[var(--muted)]">
              {group.label}
            </span>
            <div className="flex flex-wrap gap-0.5 rounded-xl border border-[var(--line)] bg-white/70 p-1">
              {group.views.map((v) => {
                const isActive = v.key === view;
                return (
                  <Link
                    key={v.key}
                    href={reportViewHref(v.key, fiscalYear, currentFiscalYear)}
                    aria-current={isActive ? "page" : undefined}
                    className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                      isActive
                        ? "bg-[var(--primary)] text-white shadow-sm"
                        : "text-[var(--muted)] hover:bg-[var(--primary-soft)] hover:text-[var(--foreground)]"
                    }`}
                  >
                    {v.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </nav>
  );
}
