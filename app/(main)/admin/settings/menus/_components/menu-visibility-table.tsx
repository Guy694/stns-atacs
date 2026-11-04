"use client";

// R2: sorting happens in the browser so checkbox changes that are not saved yet survive a re-sort
// (the old server-side sort links reloaded the page and reset every checkbox).
import { useState } from "react";

import { SortableTh } from "@/app/_components/ui/data-table";
import { AppIcon, type IconName } from "@/app/_components/ui/icon";
import { StatusBadge } from "@/app/_components/ui/status-badge";
import { useTableState } from "@/app/_components/ui/use-table-state";

export type MenuVisibilityRow = {
  key: string;
  label: string;
  description: string;
  href: string;
  icon: IconName;
  groupLabel: string;
  groupRank: number;
  permissionKey: string | null;
  enabled: boolean;
};

export function MenuVisibilityTable({ rows }: { rows: MenuVisibilityRow[] }) {
  const [checked, setChecked] = useState<Record<string, boolean>>(() => Object.fromEntries(rows.map((row) => [row.key, row.enabled])));
  const table = useTableState(
    rows,
    {
      menu: (row) => row.label,
      group: (row) => row.groupRank,
      permission: (row) => row.permissionKey,
      status: (row) => (checked[row.key] ? 0 : 1),
    },
    { pageSize: Math.max(rows.length, 1) }
  );
  const th = (key: string, label: string) => (
    <SortableTh label={label} sortKey={key} sort={table.sort} onSort={table.onSort} className="px-5 py-3 font-medium" />
  );

  return (
    <table className="min-w-[820px] w-full text-left text-sm">
      <thead className="border-b border-black/8 bg-[var(--neutral-bg)] text-xs text-[var(--muted)]">
        <tr>
          {th("menu", "เมนู")}
          {th("group", "กลุ่ม")}
          {th("permission", "สิทธิ์ที่เกี่ยวข้อง")}
          {th("status", "สถานะ")}
          <th className="px-5 py-3 text-right font-medium">เปิดใช้งาน</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-black/6 bg-white/70">
        {table.rows.map((item) => {
          const enabled = checked[item.key];
          const changed = enabled !== item.enabled;
          return (
            <tr key={item.key} className="align-middle hover:bg-[var(--primary-soft)]/30">
              <td className="px-5 py-4">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="rounded-xl bg-[var(--primary-soft)] p-2 text-[var(--primary-text)]">
                    <AppIcon name={item.icon} className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="font-semibold text-[var(--foreground)]">{item.label}</p>
                    <p className="mt-0.5 text-xs leading-5 text-[var(--muted)]">{item.description}</p>
                    <p className="mt-1 font-mono text-[11px] text-[var(--muted)]">{item.href}</p>
                  </div>
                </div>
              </td>
              <td className="px-5 py-4 text-xs text-[var(--muted)]">{item.groupLabel}</td>
              <td className="px-5 py-4">
                {item.permissionKey ? (
                  <code className="rounded-lg bg-stone-100 px-2 py-1 text-xs text-[var(--foreground)]">{item.permissionKey}</code>
                ) : (
                  <span className="text-xs text-[var(--muted)]">ไม่มี</span>
                )}
              </td>
              <td className="px-5 py-4">
                <StatusBadge tone={enabled ? "success" : "neutral"}>{enabled ? "แสดงในเมนู" : "ซ่อนจากเมนู"}</StatusBadge>
                {changed && <p className="mt-1 text-[11px] font-medium text-[var(--state-warning-fg)]">ยังไม่บันทึก</p>}
              </td>
              <td className="px-5 py-4 text-right">
                <label className="inline-flex cursor-pointer items-center justify-end gap-2">
                  <span className="sr-only">เปิดใช้งานเมนู {item.label}</span>
                  <input
                    type="checkbox"
                    name={`menu:${item.key}`}
                    checked={enabled}
                    onChange={(event) => setChecked((current) => ({ ...current, [item.key]: event.target.checked }))}
                    className="h-5 w-5 rounded border-black/20 text-[var(--accent)] accent-[var(--accent)]"
                  />
                </label>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
