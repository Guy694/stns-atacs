import { redirect } from "next/navigation";

import { StatusBadge } from "@/app/_components/ui/status-badge";
import { getCurrentUser } from "@/lib/auth";
import { AUDIT_SORT_KEYS, paginateAuditLogs } from "@/lib/audit";
import { SortableTh, TablePagination } from "@/app/_components/ui/data-table";
import { pageHref as tablePageHref, readSort, sortHref } from "@/lib/table-sort";
import { formatThaiDateTime } from "@/lib/date-format";
import Link from "next/link";
import { withBasePath } from "@/lib/base-path";
import { AppIcon } from "@/app/_components/ui/icon";
import { EmptyState, PageHero, SummaryCard } from "@/app/(main)/admin/_components/page-hero";

type AuditPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function readParam(p: Record<string, string | string[] | undefined>, key: string) {
  const value = p[key];
  return Array.isArray(value) ? value[0] : (value ?? "");
}

const ACTION_LABEL: Record<string, string> = {
  create: "สร้าง",
  update: "แก้ไข",
  delete: "ลบ",
  transfer: "โอนย้าย",
  dispose: "จำหน่าย/ชำรุด",
  inspect: "ตรวจนับ",
};

const ACTION_TONE = {
  create: "success",
  update: "info",
  delete: "danger",
  transfer: "primary",
  dispose: "warning",
  inspect: "neutral",
} as const;

export default async function AuditLogPage({ searchParams }: AuditPageProps) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/dashboard");

  const params = await searchParams;
  const actionFilter = readParam(params, "action") as "create" | "update" | "delete" | "transfer" | "dispose" | "inspect";
  const entityFilter = readParam(params, "entity");
  const actorFilter = readParam(params, "actor");
  const search = readParam(params, "search");
  const dateFrom = readParam(params, "dateFrom");
  const dateTo = readParam(params, "dateTo");

  const sort = readSort(params, AUDIT_SORT_KEYS, { key: "time", dir: "desc" });
  const hasFilters = Boolean(actionFilter || entityFilter || actorFilter || search || dateFrom || dateTo);
  const { logs, total, totalPages, page, pageSize } = await paginateAuditLogs({
    orderBy: sort ?? undefined,
    action: ACTION_LABEL[actionFilter] ? actionFilter : undefined,
    entity: entityFilter || undefined,
    actor: actorFilter || undefined,
    search: search || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  }, Number(readParam(params, "page")));


  const countsByAction = logs.reduce<Record<string, number>>((acc, log) => {
    acc[log.action] = (acc[log.action] ?? 0) + 1;
    return acc;
  }, {});
  const uniqueUsers = new Set(logs.map((log) => log.userName).filter(Boolean)).size;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <PageHero
        icon="audit"
        image="office-desk"
        title="ประวัติการใช้งาน (Audit Log)"
        description="บันทึกการดำเนินการล่าสุด พร้อมค้นหาและกรองเชิงลึก"
      />

      <section aria-label="สรุปรายการในหน้านี้" className="space-y-2">
        <p className="text-xs text-[var(--muted)]">สรุปรายการในหน้านี้</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <SummaryCard icon="file-text" image="office-desk" label="รายการที่แสดง" value={logs.length.toLocaleString("th-TH")} />
          <SummaryCard icon="users" image="meeting-room" label="ผู้ใช้งานที่เคลื่อนไหว" value={uniqueUsers.toLocaleString("th-TH")} />
          {([
            ["create", "plus", "success"],
            ["update", "pencil", "info"],
            ["delete", "trash", "danger"],
            ["transfer", "repeat", "neutral"],
          ] as const).map(([key, icon, tone]) => (
            <SummaryCard key={key} icon={icon} image="it-storage" label={ACTION_LABEL[key]} value={(countsByAction[key] ?? 0).toLocaleString("th-TH")} tone={(countsByAction[key] ?? 0) > 0 ? tone : "neutral"} />
          ))}
        </div>
      </section>

      <form method="GET" action={withBasePath("/admin/audit/")} className="glass-panel grid gap-2 rounded-2xl p-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_repeat(5,minmax(0,1fr))]">
        <div className="relative sm:col-span-2 lg:col-span-1">
          <AppIcon name="search" size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
          <input
            name="search"
            type="search"
            aria-label="ค้นหาจากรายละเอียด entity หรือผู้ใช้"
            defaultValue={search}
            placeholder="ค้นหาจากรายละเอียด / entity / ผู้ใช้"
            className="filter-control pl-9"
          />
        </div>
        <input name="actor" aria-label="ชื่อผู้ใช้" defaultValue={actorFilter} placeholder="ชื่อผู้ใช้" className="filter-control" />
        <input name="entity" aria-label="entity" defaultValue={entityFilter} placeholder="entity เช่น users" className="filter-control" />
        <input name="dateFrom" type="date" aria-label="ตั้งแต่วันที่" title="ตั้งแต่วันที่" defaultValue={dateFrom} className="filter-control" />
        <input name="dateTo" type="date" aria-label="ถึงวันที่" title="ถึงวันที่" defaultValue={dateTo} className="filter-control" />
        <select name="action" aria-label="การดำเนินการ" defaultValue={actionFilter} className="filter-control">
          <option value="">ทุกการดำเนินการ</option>
          {Object.entries(ACTION_LABEL).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
        <div className="flex flex-wrap items-center gap-2 sm:col-span-2 lg:col-span-6">
          <button type="submit" className="primary-action action-sm">
            <AppIcon name="search" size={15} />
            ค้นหา
          </button>
          {hasFilters && (
            <Link href="/admin/audit" className="secondary-action action-sm gap-2">
              <AppIcon name="undo" size={15} />
              ล้างตัวกรอง
            </Link>
          )}
          <a
            href={withBasePath(`/api/export/audit/?search=${encodeURIComponent(search)}&actor=${encodeURIComponent(actorFilter)}&entity=${encodeURIComponent(entityFilter)}&action=${encodeURIComponent(actionFilter)}&dateFrom=${encodeURIComponent(dateFrom)}&dateTo=${encodeURIComponent(dateTo)}`)}
            className="secondary-action action-sm ml-auto gap-2"
          >
            <AppIcon name="download" size={15} />
            ส่งออก CSV
          </a>
        </div>
      </form>

      <div className="glass-panel rounded-2xl overflow-hidden">
        {logs.length === 0 ? (
          hasFilters ? (
            <EmptyState icon="search" title="ไม่พบประวัติที่ตรงกับเงื่อนไขที่เลือก" description="ลองขยายช่วงวันที่หรือเปลี่ยนคำค้นหา">
              <Link href="/admin/audit" className="secondary-action action-sm gap-2">
                <AppIcon name="undo" size={15} />
                ล้างตัวกรอง
              </Link>
            </EmptyState>
          ) : (
            <EmptyState icon="history" title="ยังไม่มีประวัติการใช้งาน" description="เมื่อมีการสร้าง แก้ไข หรือลบข้อมูล รายการจะแสดงที่นี่" />
          )
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--line)" }}>
                <th className="px-4 py-3 text-left font-semibold" style={{ color: "var(--muted)" }}>ลำดับ</th>
                {([["time", "วันที่/เวลา"], ["user", "ผู้ใช้"], ["action", "การดำเนินการ"], ["entity", "ข้อมูล"], ["summary", "รายละเอียด"]] as const).map(([key, label]) => (
                  <SortableTh key={key} label={label} sortKey={key} sort={sort} href={sortHref("/admin/audit", params, key, sort)}
                    className="px-4 py-3 font-semibold text-[var(--muted)]" />
                ))}
              </tr>
            </thead>
            <tbody>
              {logs.map((log, rowIndex) => (
                <tr key={log.id} style={{ borderBottom: "1px solid var(--line)" }}>
                  <td className="px-4 py-3 text-xs tabular-nums text-[var(--muted)]">{((page - 1) * pageSize + rowIndex + 1).toLocaleString("th-TH")}</td>
                  <td className="px-4 py-3 text-xs font-mono" style={{ color: "var(--muted)" }}>
                    {formatThaiDateTime(log.createdAt)}
                  </td>
                  <td className="px-4 py-3 font-medium" style={{ color: "var(--foreground)" }}>
                    {log.userName || "-"}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge tone={ACTION_TONE[log.action as keyof typeof ACTION_TONE] ?? "neutral"}>
                      {ACTION_LABEL[log.action] ?? log.action}
                    </StatusBadge>
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: "var(--muted)" }}>
                    {log.entity}{log.entityId ? ` #${log.entityId}` : ""}
                  </td>
                  <td className="max-w-xl px-4 py-3 text-xs" style={{ color: "var(--foreground)" }}>
                    {log.summary}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
        <TablePagination
          page={page}
          totalPages={totalPages}
          total={total}
          start={total === 0 ? 0 : (page - 1) * pageSize + 1}
          end={Math.min(page * pageSize, total)}
          hrefFor={(target) => tablePageHref("/admin/audit", params, target)}
          label="แบ่งหน้าประวัติการใช้งาน"
          className="border-t border-black/6"
        />
      </div>
    </div>
  );
}
