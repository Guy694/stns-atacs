import Link from "next/link";
import { redirect } from "next/navigation";

import { AppIcon } from "@/app/_components/ui/icon";
import { ActionIconLink } from "@/app/_components/ui/action-icon-button";
import { StatusBadge } from "@/app/_components/ui/status-badge";
import { getCurrentUser } from "@/lib/auth";
import { formatThaiDate } from "@/lib/date-format";
import { listInspections } from "@/lib/inspection";
import { inspectionDeadline } from "@/lib/inspection-progress";
import { listFacilities } from "@/lib/assets";
import { getFacilityScopeId } from "@/lib/facility-scope";
import { canManageFacility } from "@/lib/permissions";
import { hasPermission } from "@/lib/role-permissions";
import { listFacilityWorkGroups } from "@/lib/facility-work-groups";
import NewInspectionForm from "./_components/new-inspection-form";

function readParam(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : (value ?? "");
}

export default async function InspectionPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const canViewInspection = await hasPermission(user.role, "inspection.view");
  if (!canViewInspection) redirect("/dashboard");
  const canMutate = user.role !== "viewer" && (await hasPermission(user.role, "inspection.create"));

  const params = await searchParams;
  const view = canMutate && params["view"] === "new" ? "new" : "list";
  const search = readParam(params, "search").trim();
  const statusFilter = readParam(params, "status");
  const facilityScopeId = getFacilityScopeId(user);
  if (facilityScopeId === null) redirect("/profile");

  const [inspections, facilities, workGroups] = await Promise.all([
    listInspections(facilityScopeId),
    listFacilities(facilityScopeId ? { facilityId: facilityScopeId } : undefined),
    listFacilityWorkGroups(facilityScopeId || undefined),
  ]);
  const facilitiesForForm = facilityScopeId
    ? facilities.filter((facility) => canManageFacility(user, facility.id))
    : facilities;
  const normalizedSearch = search.toLowerCase();
  const filteredInspections = inspections.filter((inspection) => {
    const matchesSearch = normalizedSearch
      ? [
          inspection.roundName,
          inspection.facilityName,
          inspection.districtName,
          inspection.inspectedBy,
          inspection.note,
        ].some((value) => value.toLowerCase().includes(normalizedSearch))
      : true;
    const matchesStatus =
      statusFilter === "complete"
        ? inspection.remainingItems === 0
        : statusFilter === "open"
          ? inspection.remainingItems > 0
          : true;

    return matchesSearch && matchesStatus;
  });
  const hasActiveFilters = Boolean(search || statusFilter);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold" style={{ color: "var(--foreground)" }}>
            <AppIcon name="clipboard-check" className="h-6 w-6 text-[var(--primary)]" /> ตรวจนับทรัพย์สิน
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
            เปิดรอบตรวจนับตามช่วงวันที่ และติดตามรายการที่ตรวจแล้วกับรายการคงเหลือของแต่ละหน่วยบริการ
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/inspection/coverage" className="inline-flex min-h-11 items-center rounded-xl border border-[var(--line)] bg-white px-4 text-sm font-medium hover:bg-[var(--primary-soft)]">
            ความครอบคลุมประจำปี
          </Link>
          {canMutate && view !== "new" && (
            <Link
              href="/inspection?view=new"
              className="primary-action"
            >
              + เริ่มรอบตรวจนับใหม่
            </Link>
          )}
        </div>
      </div>

      {!canMutate && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          บัญชี Viewer เข้าดูผลการตรวจนับได้ แต่ไม่สามารถเริ่มรอบตรวจนับใหม่
        </div>
      )}

      {/* New form */}
      {view === "new" && (
        <div className="glass-panel rounded-2xl p-6">
          <h2 className="text-lg font-bold mb-4" style={{ color: "var(--foreground)" }}>
            เริ่มรอบตรวจนับใหม่
          </h2>
          <NewInspectionForm facilities={facilitiesForForm} workGroups={workGroups} />
        </div>
      )}

      {/* List */}
      {view !== "new" && (
        <div className="glass-panel rounded-2xl overflow-hidden">
          <form method="GET" className="grid gap-3 border-b border-black/6 bg-[var(--neutral-bg)]/60 px-4 py-4 sm:grid-cols-[minmax(240px,1fr)_180px_auto_auto]">
            <label htmlFor="inspection-search" className="sr-only">ค้นหารอบตรวจนับ</label>
            <input
              id="inspection-search"
              name="search"
              defaultValue={search}
              placeholder="ค้นหาชื่อรอบ / หน่วยบริการ / อำเภอ / ผู้เปิดรอบ"
              className="filter-control min-w-0"
            />
            <label htmlFor="inspection-status" className="sr-only">กรองสถานะรอบตรวจ</label>
            <select
              id="inspection-status"
              name="status"
              defaultValue={statusFilter}
              className="filter-control"
            >
              <option value="">ทุกสถานะ</option>
              <option value="open">ยังตรวจไม่ครบ</option>
              <option value="complete">ตรวจครบแล้ว</option>
            </select>
            <button
              type="submit"
              className="min-h-9 rounded-xl bg-[var(--accent-strong)] px-4 py-2 text-xs font-semibold text-white transition hover:opacity-90"
            >
              ค้นหา
            </button>
            {hasActiveFilters && (
              <Link
                href="/inspection"
                className="inline-flex min-h-9 items-center justify-center rounded-xl border border-black/10 bg-white/80 px-4 py-2 text-xs text-[var(--muted)] hover:bg-white"
              >
                ล้างตัวกรอง
              </Link>
            )}
          </form>

          {inspections.length === 0 ? (
            <div className="text-center py-16" style={{ color: "var(--muted)" }}>
	              <AppIcon name="clipboard-check" className="mx-auto mb-3 h-10 w-10 text-[var(--primary)]" />
              <p className="font-semibold">ยังไม่มีรอบการตรวจนับ</p>
              <p className="text-sm mt-1">คลิก &quot;เริ่มรอบตรวจนับใหม่&quot; เพื่อบันทึกครั้งแรก</p>
            </div>
          ) : filteredInspections.length === 0 ? (
            <div className="px-5 py-14 text-center text-sm" style={{ color: "var(--muted)" }}>
              ไม่พบรายการตรวจนับที่ตรงกับเงื่อนไขค้นหา
            </div>
          ) : (
            <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead>
	                <tr style={{ borderBottom: "1px solid var(--line)", background: "var(--neutral-bg)" }}>
                  {["รอบการตรวจนับ", "หน่วยบริการ", "ช่วงวันที่", "ผู้เปิดรอบ", "สถานะ", "เช็คแล้ว/ทั้งหมด", ""].map((h) => (
                    <th key={h} className="px-4 py-3 text-left font-semibold" style={{ color: "var(--muted)" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredInspections.map((ins) => {
                  const pct = ins.totalItems > 0 ? Math.round((ins.checkedItems / ins.totalItems) * 100) : 0;
                  return (
                    <tr
                      key={ins.id}
                      style={{ borderBottom: "1px solid var(--line)" }}
	                      className="hover:bg-[var(--neutral-bg)] transition-colors"
                    >
                      <td className="px-4 py-3 font-medium" style={{ color: "var(--foreground)" }}>
                        {ins.roundName}
                        {ins.workGroupName && <p className="mt-1 text-xs font-medium text-[var(--primary-text)]">{ins.workGroupName}</p>}
                        <p className="mt-1 text-xs font-normal" style={{ color: "var(--muted)" }}>
                          เปิดเมื่อ {formatThaiDate(ins.inspectedAt)}
                        </p>
                      </td>
                      <td className="px-4 py-3" style={{ color: "var(--foreground)" }}>
                        {ins.facilityName}
                        <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>อ.{ins.districtName}</p>
                      </td>
                      <td className="px-4 py-3" style={{ color: "var(--muted)" }}>
                        {ins.startDate ? formatThaiDate(ins.startDate) : "-"} - {ins.endDate ? formatThaiDate(ins.endDate) : "-"}
                      </td>
                      <td className="px-4 py-3" style={{ color: "var(--muted)" }}>
                        {ins.inspectedBy}
                      </td>
                      <td className="px-4 py-3">
                        {ins.roundStatus === "Closed" ? (
                          <StatusBadge tone="neutral">ปิดรอบแล้ว</StatusBadge>
                        ) : ins.remainingItems === 0 ? (
                          <StatusBadge tone="success">ตรวจครบแล้ว</StatusBadge>
                        ) : (
                          <StatusBadge tone="warning">คงเหลือ {ins.remainingItems.toLocaleString("th-TH")}</StatusBadge>
                        )}
                        {(() => {
                          const deadline = inspectionDeadline({ startDate: ins.startDate || ins.inspectedAt, roundStatus: ins.roundStatus });
                          if (deadline.state === "closed" || !deadline.dueDate) return null;
                          return (
                            <p className={`mt-1 text-xs ${deadline.state === "overdue" ? "font-semibold text-rose-700" : deadline.state === "due-soon" ? "text-amber-700" : "text-[var(--muted)]"}`}>
                              ส่งรายงานภายใน {formatThaiDate(deadline.dueDate)}{deadline.state === "overdue" ? " (เกินกำหนด)" : ""}
                            </p>
                          );
                        })()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
	                          <div className="flex-1 h-2 rounded-full bg-[var(--primary-soft)] overflow-hidden w-20">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: pct + "%",
                                background: pct >= 90 ? "var(--accent)" : pct >= 70 ? "var(--warning)" : "var(--danger)",
                              }}
                            />
                          </div>
                          <span className="text-xs font-semibold" style={{ color: "var(--muted)" }}>
                            {ins.checkedItems}/{ins.totalItems}
                          </span>
                        </div>
                        <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
                          พบ {ins.foundItems} · ไม่พบ {ins.missingItems}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col items-start gap-2">
                          <Link
                            href={"/inspection/" + ins.id}
                            className="text-xs font-semibold"
                            style={{ color: "var(--accent)" }}
                          >
                            ดูรายละเอียด →
                          </Link>
                          {canMutate && ins.roundStatus !== "Closed" && (
                            <ActionIconLink
                              href={`/inspection/${ins.id}?delete=1#delete-round`}
                              icon="trash"
                              tone="danger"
                              label={`ยกเลิก / ลบรอบ ${ins.roundName}`}
                            />
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
