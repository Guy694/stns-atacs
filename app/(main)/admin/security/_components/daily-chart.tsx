import type { DailyPoint } from "@/lib/security-dashboard";

const SERIES = [
  { key: "success", label: "เข้าสู่ระบบสำเร็จ", color: "bg-emerald-500" },
  { key: "failed", label: "รหัสผ่านผิด / ถูกล็อก", color: "bg-amber-500" },
  { key: "suspicious", label: "น่าสงสัยอื่น ๆ", color: "bg-red-500" },
  { key: "other", label: "ทั่วไป", color: "bg-slate-300" },
] as const;

const shortDay = (day: string) => {
  const [, month, date] = day.split("-").map(Number);
  return `${date}/${month}`;
};

/** Stacked daily bars in plain CSS (no chart library), with a screen-reader table. */
export function DailyChart({ series }: { series: DailyPoint[] }) {
  const totals = series.map((point) => point.success + point.failed + point.suspicious + point.other);
  const max = Math.max(1, ...totals);

  return (
    <div className="mt-4">
      <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--muted)]">
        {SERIES.map((item) => (
          <li key={item.key} className="flex items-center gap-1.5">
            <span className={`h-2.5 w-2.5 rounded-sm ${item.color}`} aria-hidden="true" />
            {item.label}
          </li>
        ))}
      </ul>
      <div className="flex h-40 items-end gap-[3px]" aria-hidden="true">
        {series.map((point, index) => (
          <div
            key={point.day}
            className="group relative flex h-full min-w-0 flex-1 flex-col justify-end"
            title={`${shortDay(point.day)} · สำเร็จ ${point.success} · ผิด ${point.failed} · น่าสงสัย ${point.suspicious} · ทั่วไป ${point.other}`}
          >
            <div className="flex flex-col-reverse overflow-hidden rounded-t-[3px]" style={{ height: `${(totals[index] / max) * 100}%` }}>
              {SERIES.map((item) =>
                point[item.key] > 0 ? <div key={item.key} className={item.color} style={{ flexGrow: point[item.key], minHeight: 2 }} /> : null
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] tabular-nums text-[var(--muted)]" aria-hidden="true">
        <span>{series[0] && shortDay(series[0].day)}</span>
        <span>สูงสุด {max.toLocaleString("th-TH")} ครั้ง/วัน</span>
        <span>{series.at(-1) && shortDay(series.at(-1)!.day)}</span>
      </div>
      <table className="sr-only">
        <caption>จำนวนเหตุการณ์ความปลอดภัยรายวัน</caption>
        <thead>
          <tr>
            <th>วันที่</th>
            {SERIES.map((item) => <th key={item.key}>{item.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {series.map((point) => (
            <tr key={point.day}>
              <td>{point.day}</td>
              {SERIES.map((item) => <td key={item.key}>{point[item.key]}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
