"use client";

import { useMemo, useState, useTransition } from "react";

import { StatusBadge, activeTone } from "@/app/_components/ui/status-badge";
import { approveUsersAction } from "@/app/(main)/admin/users/actions";
import { UserRowActions } from "@/app/(main)/admin/users/_components/user-row-actions";
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
};

type FacilityOption = {
  id: number;
  facility_name: string;
  district_name: string | null;
};

type Props = {
  users: ManagedUser[];
  facilities: FacilityOption[];
  currentUserId: number;
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

function UserActions({ user, facilities, currentUserId }: { user: ManagedUser; facilities: FacilityOption[]; currentUserId: number }) {
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
    />
  );
}

export function UsersManagementClient({ users, facilities, currentUserId }: Props) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [successMessage, setSuccessMessage] = useState("");
  const [approvePending, startApprove] = useTransition();

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
      if (!normalizedQuery) return true;
      return [user.full_name, user.officer_position, user.email, user.username, user.thaid_cid]
        .filter(Boolean)
        .some((value) => String(value).toLocaleLowerCase("th").includes(normalizedQuery));
    });
  }, [query, status, systemUsers]);

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
            <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-800">
              {pendingRegistrations.length} รายการ
            </span>
            {selectedIds.length > 0 && (
              <button
                type="button"
                disabled={approvePending}
                onClick={() => approveSelected(selectedIds)}
                className="min-h-11 rounded-xl bg-[var(--accent-strong)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--accent)] disabled:opacity-50"
              >
                {approvePending ? "กำลังอนุมัติ..." : `อนุมัติที่เลือก (${selectedIds.length})`}
              </button>
            )}
          </div>
        </div>

        {pendingRegistrations.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-emerald-200 bg-emerald-50/60 px-6 py-10 text-center">
            <p className="font-semibold text-emerald-900">ไม่มีผู้ลงทะเบียนที่รออนุมัติ</p>
            <p className="mt-1 text-sm text-emerald-800">รายการใหม่จะแสดงที่นี่และแจ้งจำนวนใน Sidebar</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-amber-200 bg-white">
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full text-sm">
                <thead className="bg-amber-50 text-xs text-amber-950">
                  <tr>
                    <th className="w-12 px-4 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={allPendingSelected}
                        onChange={() => setSelectedIds(allPendingSelected ? [] : pendingRegistrations.map((user) => user.id))}
                        aria-label="เลือกผู้ลงทะเบียนทั้งหมด"
                        className="h-4 w-4 accent-[var(--accent-strong)]"
                      />
                    </th>
                    <th className="px-4 py-3 text-left font-semibold">ผู้ลงทะเบียน</th>
                    <th className="px-4 py-3 text-left font-semibold">ข้อมูลติดต่อ</th>
                    <th className="px-4 py-3 text-left font-semibold">หน่วยงาน</th>
                    <th className="px-4 py-3 text-right font-semibold">ดำเนินการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {pendingRegistrations.map((user) => (
                    <tr key={user.id} className="hover:bg-amber-50/40">
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
                        {user.facility_id ? facilityNameById.get(user.facility_id) ?? `หน่วยงาน #${user.facility_id}` : "ยังไม่ระบุ"}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <button
                          type="button"
                          disabled={approvePending}
                          onClick={() => approveSelected([user.id])}
                          className="min-h-11 rounded-xl bg-[var(--accent-strong)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--accent)] disabled:opacity-50"
                        >
                          อนุมัติ
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-stone-100 lg:hidden">
              {pendingRegistrations.map((user) => (
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
                    <div><dt className="text-xs text-[var(--muted)]">หน่วยงาน</dt><dd>{user.facility_id ? facilityNameById.get(user.facility_id) ?? `หน่วยงาน #${user.facility_id}` : "ยังไม่ระบุ"}</dd></div>
                  </dl>
                  <button
                    type="button"
                    disabled={approvePending}
                    onClick={() => approveSelected([user.id])}
                    className="min-h-11 w-full rounded-xl bg-[var(--accent-strong)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    อนุมัติผู้ลงทะเบียนรายนี้
                  </button>
                </article>
              ))}
            </div>
          </div>
        )}
      </section>

      <section aria-labelledby="system-users-heading" className="space-y-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h2 id="system-users-heading" className="text-xl font-semibold">ผู้ใช้งานระบบ</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">บัญชีที่อนุมัติแล้วและบัญชีที่ถูกปิดใช้งาน</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="sr-only" htmlFor="user-search">ค้นหาผู้ใช้งาน</label>
            <input
              id="user-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="ค้นหาชื่อ อีเมล Username หรือ ThaiD"
              className="filter-control is-narrow"
            />
            <label className="sr-only" htmlFor="user-status">กรองสถานะผู้ใช้งาน</label>
            <select
              id="user-status"
              value={status}
              onChange={(event) => setStatus(event.target.value as typeof status)}
              className="filter-control is-auto"
            >
              <option value="all">ทุกสถานะ</option>
              <option value="active">ใช้งานอยู่</option>
              <option value="inactive">ปิดใช้งาน</option>
            </select>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
          <div className="hidden overflow-x-auto xl:block">
            <table className="w-full text-sm">
              <thead className="bg-stone-50 text-xs text-stone-700">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">ผู้ใช้งาน</th>
                  <th className="px-4 py-3 text-left font-semibold">บัญชี</th>
                  <th className="px-4 py-3 text-left font-semibold">หน่วยงาน</th>
                  <th className="px-4 py-3 text-left font-semibold">สิทธิ์</th>
                  <th className="px-4 py-3 text-left font-semibold">สถานะ</th>
                  <th className="px-4 py-3 text-left font-semibold">เข้าใช้งานล่าสุด</th>
                  <th className="px-4 py-3 text-right font-semibold">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-stone-50/70">
                    <td className="px-4 py-4">
                      <p className="font-semibold">{user.full_name}</p>
                      <p className="mt-0.5 text-xs text-[var(--muted)]">{user.officer_position ?? "–"}</p>
                    </td>
                    <td className="px-4 py-4 text-[var(--muted)]">
                      <p className="break-all">{user.email ?? "ไม่มีอีเมล"}</p>
                      <p className="mt-0.5 font-mono text-xs">{user.username ? `@${user.username}` : "ThaiD / Google"}</p>
                    </td>
                    <td className="px-4 py-4 text-[var(--muted)]">
                      {user.role === "officer" && user.facility_id ? facilityNameById.get(user.facility_id) ?? `หน่วยงาน #${user.facility_id}` : "–"}
                    </td>
	                    <td className="px-4 py-4"><StatusBadge tone="info">{roleLabel(user.role)}</StatusBadge></td>
	                    <td className="px-4 py-4">
	                      <StatusBadge tone={activeTone(!!user.is_active)}>
	                        {user.is_active ? "ใช้งานอยู่" : "ปิดใช้งาน"}
	                      </StatusBadge>
                    </td>
                    <td className="px-4 py-4 text-xs text-[var(--muted)]">{formatDate(user.last_login_at)}</td>
                    <td className="px-4 py-4 text-right"><UserActions user={user} facilities={facilities} currentUserId={currentUserId} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="divide-y divide-stone-100 xl:hidden">
            {filteredUsers.map((user) => (
              <article key={user.id} className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-semibold">{user.full_name}</h3>
                    <p className="text-sm text-[var(--muted)]">{user.officer_position ?? roleLabel(user.role)}</p>
                  </div>
                  <UserActions user={user} facilities={facilities} currentUserId={currentUserId} />
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
            <div className="px-6 py-12 text-center">
              <p className="font-semibold">ไม่พบผู้ใช้งานตามเงื่อนไข</p>
              <button type="button" onClick={() => { setQuery(""); setStatus("all"); }} className="mt-3 min-h-11 rounded-xl border border-stone-300 px-4 py-2 text-sm font-semibold">
                ล้างตัวกรอง
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
