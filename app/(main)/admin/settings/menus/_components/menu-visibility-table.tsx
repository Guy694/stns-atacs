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
      // Sort by the saved state: sorting by the live checkbox made rows jump away while being toggled.
      status: (row) => (row.enabled ? 0 : 1),
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
            <tr key={item.key} className="align-middle">
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
                <label className="inline-flex min-h-11 cursor-pointer items-center justify-end gap-2" title={enabled ? "แสดงในเมนู — กดเพื่อซ่อน" : "ซ่อนจากเมนู — กดเพื่อแสดง"}>
                  <span className="sr-only">เปิดใช้งานเมนู {item.label}</span>
                  <span className="relative inline-flex h-6 w-11 shrink-0">
                    <input
                      type="checkbox"
                      role="switch"
                      name={`menu:${item.key}`}
                      checked={enabled}
                      onChange={(event) => setChecked((current) => ({ ...current, [item.key]: event.target.checked }))}
                      className="peer sr-only"
                    />
                    <span
                      aria-hidden="true"
                      className="absolute inset-0 rounded-full border border-[var(--state-neutral-border)] bg-[var(--state-neutral-bg)] transition-colors duration-200 peer-checked:border-[var(--accent-strong)] peer-checked:bg-[var(--accent-strong)] peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--accent)]"
                    />
                    <span aria-hidden="true" className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 peer-checked:translate-x-5" />
                  </span>
                </label>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
