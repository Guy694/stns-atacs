"use client";

import { useMemo, useState, useTransition } from "react";

import { ActionIconButton } from "@/app/_components/ui/action-icon-button";
import { SortableTh, TablePagination } from "@/app/_components/ui/data-table";
import { FacilitySelect } from "@/app/_components/ui/facility-select";
import { AppIcon } from "@/app/_components/ui/icon";
import { EmptyState } from "@/app/(main)/admin/_components/page-hero";
import { StatusBadge, activeTone } from "@/app/_components/ui/status-badge";
import { approveUsersAction } from "@/app/(main)/admin/users/actions";
import { UserRowActions } from "@/app/(main)/admin/users/_components/user-row-actions";
import { useTableState } from "@/app/_components/ui/use-table-state";
import { formatThaiDateTime } from "@/lib/date-format";

export type ManagedUser = {
  id: number;
  thaid_cid: string | null;
  full_name: string;
  officer_position: string | null;
  email: string | null;
  username: string | null;
  role: "admin" | "officer" | "viewer";
  facility_id: number | null;
  is_active: number;
  last_login_at: Date | string | null;
  /** SEC-04: 1 = ผู้ดูแลระบบอนุญาตให้ผูก ThaiD ครั้งแรกด้วยชื่อ-นามสกุล */
  thaid_link_enabled?: number | null;
};

type FacilityOption = {
  id: number;
  facility_name: string;
  district_name: string | null;
  typecode?: string | null;
};

type Props = {
  users: ManagedUser[];
  facilities: FacilityOption[];
  currentUserId: number;
  /** SEC-04: false เมื่อยังไม่ได้รัน database/add_thaid_link_approval.sql */
  thaidLinkColumnAvailable?: boolean;
};

function formatDate(value: Date | string | null) {
  if (!value) return "ยังไม่เคยเข้าใช้งาน";
  return formatThaiDateTime(value);
}

function roleLabel(role: ManagedUser["role"]) {
  if (role === "admin") return "ผู้ดูแลระบบ";
  if (role === "viewer") return "ผู้ดูข้อมูล";
  return "เจ้าหน้าที่";
}

const roleRank: Record<ManagedUser["role"], number> = { admin: 0, officer: 1, viewer: 2 };

function isoOrNull(value: Date | string | null) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : String(value);
}

function UserActions({ user, facilities, currentUserId, thaidLinkColumnAvailable }: { user: ManagedUser; facilities: FacilityOption[]; currentUserId: number; thaidLinkColumnAvailable: boolean }) {
  return (
    <UserRowActions
      userId={user.id}
      fullName={user.full_name}
      officerPosition={user.officer_position}
      email={user.email}
      username={user.username}
      thaidCid={user.thaid_cid}
      currentFacilityId={user.facility_id}
      facilities={facilities}
      currentActive={!!user.is_active}
      currentRole={user.role}
      hasUsername={!!user.username}
      isSelf={user.id === currentUserId}
      thaidLinkEnabled={Number(user.thaid_link_enabled ?? 0) === 1}
      thaidLinkColumnAvailable={thaidLinkColumnAvailable}
    />
  );
}

export function UsersManagementClient({ users, facilities, currentUserId, thaidLinkColumnAvailable = false }: Props) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all");
  const [facilityFilter, setFacilityFilter] = useState("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [successMessage, setSuccessMessage] = useState("");
  const [approvePending, startApprove] = useTransition();

  const facilityOptions = useMemo(
    () => facilities.map((facility) => ({ id: facility.id, name: facility.facility_name, typecode: facility.typecode, districtName: facility.district_name })),
    [facilities]
  );
  const pendingRegistrations = users.filter((user) => !user.is_active && !user.last_login_at);
  const systemUsers = users.filter((user) => user.is_active || user.last_login_at);
  const facilityNameById = new Map(
    facilities.map((facility) => [
      facility.id,
      `${facility.facility_name}${facility.district_name ? ` · อ.${facility.district_name}` : ""}`,
    ])
  );

  const filteredUsers = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("th");
    return systemUsers.filter((user) => {
      const matchesStatus =
        status === "all" || (status === "active" ? !!user.is_active : !user.is_active);
      if (!matchesStatus) return false;
      if (facilityFilter && String(user.facility_id ?? "") !== facilityFilter) return false;
      if (!normalizedQuery) return true;
      return [user.full_name, user.officer_position, user.email, user.username, user.thaid_cid]
        .filter(Boolean)
        .some((value) => String(value).toLocaleLowerCase("th").includes(normalizedQuery));
    });
  }, [query, status, facilityFilter, systemUsers]);

  function facilityLabel(user: ManagedUser) {
    return user.facility_id ? facilityNameById.get(user.facility_id) ?? `หน่วยงาน #${user.facility_id}` : null;
  }

  const pendingTable = useTableState(pendingRegistrations, {
    name: (user) => user.full_name,
    contact: (user) => user.email ?? user.username,
    facility: facilityLabel,
  });

  const usersTable = useTableState(filteredUsers, {
    name: (user) => user.full_name,
    account: (user) => user.email ?? user.username,
    facility: (user) => (user.role === "officer" ? facilityLabel(user) : null),
    role: (user) => roleRank[user.role],
    status: (user) => (user.is_active ? 0 : 1),
    lastLogin: (user) => isoOrNull(user.last_login_at),
  });

  const allPendingSelected =
    pendingRegistrations.length > 0 && pendingRegistrations.every((user) => selectedIds.includes(user.id));

  function toggleSelected(userId: number) {
    setSelectedIds((current) =>
      current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId]
    );
  }

  function approveSelected(ids: number[]) {
    if (ids.length === 0) return;
    const confirmed = window.confirm(`ยืนยันอนุมัติผู้ลงทะเบียน ${ids.length} รายการให้เข้าใช้งานระบบ?`);
    if (!confirmed) return;
    startApprove(async () => {
      await approveUsersAction(ids);
      setSelectedIds([]);
      setSuccessMessage(`อนุมัติผู้ลงทะเบียน ${ids.length} รายการเรียบร้อยแล้ว`);
    });
  }

  return (
    <div className="space-y-10">
      <p aria-live="polite" className="sr-only">{successMessage}</p>
      <section aria-labelledby="pending-users-heading" className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id="pending-users-heading" className="text-xl font-semibold">ผู้ลงทะเบียนรออนุมัติ</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">ตรวจสอบข้อมูลและเลือกอนุมัติรายคนหรือหลายรายการพร้อมกัน</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-[var(--state-warning-bg)] px-3 py-1 text-sm font-semibold text-[var(--state-warning-fg)]">
              {pendingRegistrations.length} รายการ
            </span>
            {selectedIds.length > 0 && (
              <button
                type="button"
                disabled={approvePending}
                onClick={() => approveSelected(selectedIds)}
                className="primary-action action-sm"
              >
                <AppIcon name="check" size={16} />
                {approvePending ? "กำลังอนุมัติ..." : `อนุมัติที่เลือก (${selectedIds.length})`}
              </button>
            )}
          </div>
        </div>

        {pendingRegistrations.length === 0 ? (
          <EmptyState
            icon="check"
            tone="success"
            title="ไม่มีผู้ลงทะเบียนที่รออนุมัติ"
            description="รายการใหม่จะแสดงที่นี่และแจ้งจำนวนใน Sidebar"
            className="rounded-2xl border border-[var(--line)] bg-white py-10"
          />
        ) : (
          <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-white">
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full text-sm">
                <thead className="text-xs">
                  <tr>
                    <th className="px-4 py-3 w-14 text-right font-medium">ลำดับ</th>
                    <th className="w-12 px-4 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={allPendingSelected}
                        onChange={() => setSelectedIds(allPendingSelected ? [] : pendingRegistrations.map((user) => user.id))}
                        aria-label="เลือกผู้ลงทะเบียนทั้งหมด"
                        className="h-4 w-4 accent-[var(--accent-strong)]"
                      />
                    </th>
                    <SortableTh label="ผู้ลงทะเบียน" sortKey="name" sort={pendingTable.sort} onSort={pendingTable.onSort} className="px-4 py-3 font-semibold" />
                    <SortableTh label="ข้อมูลติดต่อ" sortKey="contact" sort={pendingTable.sort} onSort={pendingTable.onSort} className="px-4 py-3 font-semibold" />
                    <SortableTh label="หน่วยงาน" sortKey="facility" sort={pendingTable.sort} onSort={pendingTable.onSort} className="px-4 py-3 font-semibold" />
                    <th className="px-4 py-3 text-right font-semibold">ดำเนินการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {pendingTable.rows.map((user, rowIndex) => (
                    <tr key={user.id}>
                      <td className="px-4 py-4 text-right tabular-nums text-[var(--muted)]">{(pendingTable.start + rowIndex).toLocaleString("th-TH")}</td>
                      <td className="px-4 py-4">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(user.id)}
                          onChange={() => toggleSelected(user.id)}
                          aria-label={`เลือก ${user.full_name}`}
                          className="h-4 w-4 accent-[var(--accent-strong)]"
                        />
                      </td>
                      <td className="px-4 py-4">
                        <p className="font-semibold">{user.full_name}</p>
                        <p className="mt-0.5 text-xs text-[var(--muted)]">{user.officer_position ?? "ยังไม่ระบุตำแหน่ง"}</p>
                      </td>
                      <td className="px-4 py-4 text-[var(--muted)]">
                        <p>{user.email ?? "ไม่มีอีเมล"}</p>
                        <p className="mt-0.5 font-mono text-xs">{user.username ? `@${user.username}` : "ยืนยันตัวตนภายนอก"}</p>
                      </td>
                      <td className="px-4 py-4 text-[var(--muted)]">
                        {facilityLabel(user) ?? "ยังไม่ระบุ"}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <ActionIconButton
                          icon="check"
                          tone="primary"
                          label={`อนุมัติ ${user.full_name}`}
                          disabled={approvePending}
                          onClick={() => approveSelected([user.id])}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-stone-100 lg:hidden">
              {pendingTable.rows.map((user) => (
                <article key={user.id} className="space-y-3 p-4">
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(user.id)}
                      onChange={() => toggleSelected(user.id)}
                      aria-label={`เลือก ${user.full_name}`}
                      className="mt-1 h-5 w-5 accent-[var(--accent-strong)]"
                    />
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold">{user.full_name}</h3>
                      <p className="text-sm text-[var(--muted)]">{user.officer_position ?? "ยังไม่ระบุตำแหน่ง"}</p>
                    </div>
                  </div>
                  <dl className="grid gap-2 text-sm">
                    <div><dt className="text-xs text-[var(--muted)]">อีเมล</dt><dd className="break-all">{user.email ?? "ไม่มีอีเมล"}</dd></div>
                    <div><dt className="text-xs text-[var(--muted)]">หน่วยงาน</dt><dd>{facilityLabel(user) ?? "ยังไม่ระบุ"}</dd></div>
                  </dl>
                  <button
                    type="button"
                    disabled={approvePending}
                    onClick={() => approveSelected([user.id])}
                    className="primary-action w-full"
                  >
                    <AppIcon name="check" size={16} />
                    อนุมัติผู้ลงทะเบียนรายนี้
                  </button>
                </article>
              ))}
            </div>

            <TablePagination {...pendingTable} onPage={pendingTable.onPage} label="แบ่งหน้าผู้ลงทะเบียนรออนุมัติ" className="border-t border-black/6" />
          </div>
        )}
      </section>

      <section aria-labelledby="system-users-heading" className="space-y-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h2 id="system-users-heading" className="text-xl font-semibold">ผู้ใช้งานระบบ</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">บัญชีที่อนุมัติแล้วและบัญชีที่ถูกปิดใช้งาน</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-[minmax(0,16rem)_minmax(0,16rem)_auto]">
            <label className="sr-only" htmlFor="user-search">ค้นหาผู้ใช้งาน</label>
            <div className="relative">
              <AppIcon name="search" size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
              <input
                id="user-search"
                type="search"
                value={query}
                onChange={(event) => { setQuery(event.target.value); usersTable.resetPage(); }}
                placeholder="ค้นหาชื่อ อีเมล Username หรือ ThaiD"
                className="filter-control pl-9"
              />
            </div>
            <FacilitySelect
              facilities={facilityOptions}
              value={facilityFilter}
              onChange={(next) => { setFacilityFilter(next); usersTable.resetPage(); }}
              emptyLabel="ทุกหน่วยงาน"
              aria-label="กรองตามหน่วยงาน"
            />
            <label className="sr-only" htmlFor="user-status">กรองสถานะผู้ใช้งาน</label>
            <select
              id="user-status"
              value={status}
              onChange={(event) => { setStatus(event.target.value as typeof status); usersTable.resetPage(); }}
              className="filter-control sm:w-auto"
            >
              <option value="all">ทุกสถานะ</option>
              <option value="active">ใช้งานอยู่</option>
              <option value="inactive">ปิดใช้งาน</option>
            </select>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-white">
          <div className="hidden overflow-x-auto xl:block">
            <table className="w-full text-sm">
              <thead className="text-xs">
                <tr>
                  <th className="px-4 py-3 w-14 text-right font-medium">ลำดับ</th>
                  <SortableTh label="ผู้ใช้งาน" sortKey="name" sort={usersTable.sort} onSort={usersTable.onSort} className="px-4 py-3 font-semibold" />
                  <SortableTh label="บัญชี" sortKey="account" sort={usersTable.sort} onSort={usersTable.onSort} className="px-4 py-3 font-semibold" />
                  <SortableTh label="หน่วยงาน" sortKey="facility" sort={usersTable.sort} onSort={usersTable.onSort} className="px-4 py-3 font-semibold" />
                  <SortableTh label="สิทธิ์" sortKey="role" sort={usersTable.sort} onSort={usersTable.onSort} className="px-4 py-3 font-semibold" />
                  <SortableTh label="สถานะ" sortKey="status" sort={usersTable.sort} onSort={usersTable.onSort} className="px-4 py-3 font-semibold" />
                  <SortableTh label="เข้าใช้งานล่าสุด" sortKey="lastLogin" sort={usersTable.sort} onSort={usersTable.onSort} className="px-4 py-3 font-semibold" />
                  <th className="px-4 py-3 text-right font-semibold">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {usersTable.rows.map((user, rowIndex) => (
                  <tr key={user.id} className="hover:bg-stone-50/70">
                    <td className="px-4 py-4 text-right tabular-nums text-[var(--muted)]">{(usersTable.start + rowIndex).toLocaleString("th-TH")}</td>
                    <td className="px-4 py-4">
                      <p className="font-semibold">{user.full_name}</p>
                      <p className="mt-0.5 text-xs text-[var(--muted)]">{user.officer_position ?? "–"}</p>
                    </td>
                    <td className="px-4 py-4 text-[var(--muted)]">
                      <p className="break-all">{user.email ?? "ไม่มีอีเมล"}</p>
                      <p className="mt-0.5 font-mono text-xs">{user.username ? `@${user.username}` : "ThaiD / Google"}</p>
                    </td>
                    <td className="px-4 py-4 text-[var(--muted)]">
                      {(user.role === "officer" && facilityLabel(user)) || "–"}
                    </td>
	                    <td className="px-4 py-4"><StatusBadge tone="info">{roleLabel(user.role)}</StatusBadge></td>
	                    <td className="px-4 py-4">
	                      <StatusBadge tone={activeTone(!!user.is_active)}>
	                        {user.is_active ? "ใช้งานอยู่" : "ปิดใช้งาน"}
	                      </StatusBadge>
                    </td>
                    <td className="px-4 py-4 text-xs text-[var(--muted)]">{formatDate(user.last_login_at)}</td>
                    <td className="px-4 py-4 text-right"><UserActions user={user} facilities={facilities} currentUserId={currentUserId} thaidLinkColumnAvailable={thaidLinkColumnAvailable} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="divide-y divide-stone-100 xl:hidden">
            {usersTable.rows.map((user) => (
              <article key={user.id} className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-semibold">{user.full_name}</h3>
                    <p className="text-sm text-[var(--muted)]">{user.officer_position ?? roleLabel(user.role)}</p>
                  </div>
                  <UserActions user={user} facilities={facilities} currentUserId={currentUserId} thaidLinkColumnAvailable={thaidLinkColumnAvailable} />
                </div>
                <div className="flex flex-wrap gap-2">
	                  <StatusBadge tone="info">{roleLabel(user.role)}</StatusBadge>
	                  <StatusBadge tone={activeTone(!!user.is_active)}>
	                    {user.is_active ? "ใช้งานอยู่" : "ปิดใช้งาน"}
	                  </StatusBadge>
                </div>
                <dl className="grid gap-2 text-sm sm:grid-cols-2">
                  <div><dt className="text-xs text-[var(--muted)]">บัญชี</dt><dd className="break-all">{user.email ?? user.username ?? "ThaiD / Google"}</dd></div>
                  <div><dt className="text-xs text-[var(--muted)]">เข้าใช้งานล่าสุด</dt><dd>{formatDate(user.last_login_at)}</dd></div>
                </dl>
              </article>
            ))}
          </div>

          {filteredUsers.length === 0 && (
            <EmptyState icon="search" title="ไม่พบผู้ใช้งานตามเงื่อนไข" description="ลองเปลี่ยนคำค้นหา หน่วยงาน หรือสถานะ">
              <button type="button" onClick={() => { setQuery(""); setStatus("all"); setFacilityFilter(""); usersTable.resetPage(); }} className="secondary-action action-sm gap-2">
                <AppIcon name="undo" size={15} />
                ล้างตัวกรอง
              </button>
            </EmptyState>
          )}

          <TablePagination {...usersTable} onPage={usersTable.onPage} label="แบ่งหน้าผู้ใช้งานระบบ" className="border-t border-black/6" />
        </div>
      </section>
    </div>
  );
}
