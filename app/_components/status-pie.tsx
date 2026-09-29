export type StatusPieItem = { label: string; count: number; color: string };

const numberFormat = new Intl.NumberFormat("th-TH");

/** กราฟวงกลม (donut) แสดงสัดส่วนสถานะ พร้อมรายการจำนวนและร้อยละข้างกราฟ */
export function StatusPie({ items, totalLabel = "รายการ", ariaLabel }: { items: StatusPieItem[]; totalLabel?: string; ariaLabel: string }) {
  const radius = 64;
  const circumference = 2 * Math.PI * radius;
  const total = items.reduce((sum, item) => sum + item.count, 0);
  const visible = items.filter((item) => item.count > 0);
  const gap = visible.length > 1 ? 2 : 0;
  const percent = (count: number) => (total > 0 ? `${Math.round((count / total) * 100)}%` : "0%");
  const segments = visible.map((item, index) => {
    const length = (item.count / total) * circumference;
    const offset = visible.slice(0, index).reduce((sum, previous) => sum + (previous.count / total) * circumference, 0);
    return { item, length, offset };
  });

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
      <svg viewBox="0 0 160 160" className="h-44 w-44 shrink-0" role="img" aria-label={`${ariaLabel}: ${visible.map((s) => `${s.label} ${s.count} รายการ`).join(", ") || "ไม่มีข้อมูล"}`}>
        <circle cx="80" cy="80" r={radius} fill="none" stroke="#eef2f6" strokeWidth="20" />
        {segments.map(({ item, length, offset }) => {
          const dash = Math.max(length - gap, 0.5);
          return (
            <circle key={item.label} cx="80" cy="80" r={radius} fill="none" stroke={item.color} strokeWidth="20"
              strokeDasharray={`${dash} ${circumference - dash}`} strokeDashoffset={-offset} transform="rotate(-90 80 80)">
              <title>{`${item.label}: ${numberFormat.format(item.count)} รายการ (${percent(item.count)})`}</title>
            </circle>
          );
        })}
        <text x="80" y="78" textAnchor="middle" className="fill-[#0b0b0b] text-[26px] font-bold">{numberFormat.format(total)}</text>
        <text x="80" y="98" textAnchor="middle" className="fill-[#52514e] text-[11px]">{totalLabel}</text>
      </svg>
      <ul className="w-full min-w-0 space-y-2 text-sm">
        {items.map((item) => (
          <li key={item.label} className={`flex items-center justify-between gap-3 ${item.count === 0 ? "text-[var(--muted)]" : ""}`}>
            <span className="flex min-w-0 items-center gap-2">
              <span aria-hidden className="h-3 w-3 shrink-0 rounded-sm" style={{ background: item.color }} />
              <span className="truncate">{item.label}</span>
            </span>
            <span className="whitespace-nowrap tabular-nums">
              <span className="font-semibold text-[var(--foreground)]">{numberFormat.format(item.count)}</span>{" "}
              <span className="text-xs text-[var(--muted)]">({percent(item.count)})</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** แถบแนวนอนเรียงตามจำนวน ใช้กับข้อมูลหลายหมวด (ประเภทอุปกรณ์ ระบบปฏิบัติการ ยี่ห้อ อายุเครื่อง) */
export function CountBars({ rows, color = "#2563eb", emptyText = "ยังไม่มีข้อมูล", highlight }: {
  rows: Array<{ label: string; count: number }>;
  color?: string;
  emptyText?: string;
  highlight?: (label: string) => string | undefined;
}) {
  const max = Math.max(...rows.map((row) => row.count), 0);
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  if (total === 0) return <p className="py-6 text-center text-sm text-[var(--muted)]">{emptyText}</p>;
  return (
    <ul className="space-y-2.5">
      {rows.map((row) => (
        <li key={row.label}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className={`min-w-0 truncate ${row.label === "ไม่ระบุ" || row.label === "ไม่ระบุวันที่ได้มา" ? "text-[var(--muted)]" : ""}`} title={row.label}>{row.label}</span>
            <span className="shrink-0 tabular-nums">
              <span className="font-semibold">{numberFormat.format(row.count)}</span>{" "}
              <span className="text-xs text-[var(--muted)]">({Math.round((row.count / total) * 100)}%)</span>
            </span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full" style={{ width: `${max ? (row.count / max) * 100 : 0}%`, background: highlight?.(row.label) ?? color }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
