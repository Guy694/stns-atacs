"use client";

import { SortableTh, TablePagination } from "@/app/_components/ui/data-table";
import { StatusBadge, activeTone } from "@/app/_components/ui/status-badge";
import { useTableState } from "@/app/_components/ui/use-table-state";
import { roleLabel } from "@/lib/app-brand";
import type { AppRole } from "@/lib/permission-definitions";

export type EffectivePermissionUser = {
  id: number;
  fullName: string;
  role: AppRole;
  isActive: boolean;
  granted: string[];
};

const ROLE_RANK: Record<AppRole, number> = { admin: 0, officer: 1, viewer: 2 };

/** สิทธิ์ที่มีผลจริงรายผู้ใช้ — แบ่งหน้าด้วย TablePagination เหมือนรายการอื่นทั้งระบบ */
export function EffectivePermissionsTable({ users, total }: { users: EffectivePermissionUser[]; total: number }) {
  const t = useTableState(users, {
    name: (account) => account.fullName,
    role: (account) => ROLE_RANK[account.role],
    status: (account) => (account.isActive ? 0 : 1),
    allowed: (account) => account.granted.length,
  });

  return (
    <div className="glass-panel overflow-hidden rounded-2xl">
      <div className="border-b border-black/6 px-5 py-4">
        <h2 className="text-lg font-semibold">สิทธิ์ที่มีผลจริงรายผู้ใช้</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          แสดงสิทธิ์ตามบทบาทปัจจุบันของผู้ใช้แต่ละบัญชี เพื่อช่วยตรวจสอบผลกระทบก่อนเปลี่ยนนโยบาย
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-black/6 text-xs text-[var(--muted)]">
              <th className="w-14 px-4 py-3 text-right font-medium">ลำดับ</th>
              <SortableTh label="ผู้ใช้" sortKey="name" sort={t.sort} onSort={t.onSort} className="px-4 py-3 font-medium" />
              <SortableTh label="บทบาท" sortKey="role" sort={t.sort} onSort={t.onSort} className="px-4 py-3 font-medium" />
              <SortableTh label="สถานะ" sortKey="status" sort={t.sort} onSort={t.onSort} className="px-4 py-3 font-medium" />
              <SortableTh label="อนุญาต" sortKey="allowed" sort={t.sort} onSort={t.onSort} className="px-4 py-3 font-medium" />
              <th className="px-4 py-3 text-left font-medium">สิทธิ์สำคัญ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/4">
            {t.rows.map((account, rowIndex) => (
              <tr key={account.id}>
                <td className="px-4 py-3 text-right tabular-nums text-[var(--muted)]">{(t.start + rowIndex).toLocaleString("th-TH")}</td>
                <td className="px-4 py-3 font-medium">{account.fullName}</td>
                <td className="px-4 py-3">
                  <StatusBadge tone="info">{roleLabel(account.role)}</StatusBadge>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge tone={activeTone(account.isActive)}>{account.isActive ? "ใช้งานอยู่" : "ปิดใช้งาน"}</StatusBadge>
                </td>
                <td className="px-4 py-3 font-semibold tabular-nums text-[var(--foreground)]">
                  {account.granted.length} / {total}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1.5">
                    {account.granted.slice(0, 4).map((key) => (
                      <code key={key} className="rounded-md bg-[var(--primary-soft)] px-2 py-0.5 text-[11px] text-[var(--primary-text)]">
                        {key}
                      </code>
                    ))}
                    {account.granted.length > 4 && (
                      <span className="rounded-md bg-[var(--state-neutral-bg)] px-2 py-0.5 text-[11px] font-medium text-[var(--state-neutral-fg)]">
                        +{account.granted.length - 4}
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <TablePagination {...t} onPage={t.onPage} label="แบ่งหน้าสิทธิ์รายผู้ใช้" className="border-t border-black/6" />
    </div>
  );
}
